/**
 * USDA FoodData Central client.
 * Docs: https://fdc.nal.usda.gov/api-guide.html
 *
 * Uses the API key from localStorage ('meal-planner.usda-key') if present,
 * otherwise falls back to DEMO_KEY (30 requests/hour, shared rate limit).
 *
 * Search results are cached in localStorage keyed by the query string so
 * repeat lookups for the same term don't re-hit the API. Food detail
 * (macros + micros) is cached by fdcId.
 */
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';
const USDA_KEY_STORAGE = 'meal-planner.usda-key';
const USDA_CACHE_STORAGE = 'meal-planner.usda-cache.v1';
const USDA_KEY_FOODS_STORAGE = 'meal-planner.usda-foods.v1';
const USDA_DATA_TYPES = 'Foundation,SR Legacy';

// Nutrient numbers we care about (matching FDC's nutrientNumber field).
// These IDs are stable across FDC releases.
// FDC uses two identifier systems:
//   - nutrientNumber: legacy USDA numbers ('208' = Energy) - used by SR Legacy
//   - nutrientId: modern FDC IDs (1008 = Energy) - used by Foundation Foods
// We map BOTH to our internal keys so parsing works regardless of endpoint.
const NUTRIENT_IDS = {
  // --- macros (legacy number -> key) ---
  '208': 'calories',
  '203': 'protein',
  '205': 'carbs',
  '204': 'fat',
  '291': 'fiber',
  '269': 'sugar',
  '307': 'sodium',

  // --- macros (modern FDC id -> key) ---
  '1008': 'calories',   // Energy (older / SR Legacy)
  '1003': 'protein',
  '1005': 'carbs',
  '1004': 'fat',
  '1079': 'fiber',
  '2000': 'sugar',
  '1093': 'sodium',

  // --- energy variants (Foundation Foods return these) ---
  // FDC often omits the plain '1008' Energy entry for Foundation Foods and
  // instead provides computed Atwater values. We track these separately in
  // extractNutrients and resolve to a single calorie value at the end so we
  // don't double-count.
  '957': 'calories_atwater_general',  // Energy (Atwater General Factors)
  '958': 'calories_atwater_specific', // Energy (Atwater Specific Factors)

  // --- micros (legacy number -> key) ---
  '320': 'vitaminA_ug',
  '401': 'vitaminC_mg',
  '328': 'vitaminD_ug',
  '323': 'vitaminE_mg',
  '430': 'vitaminK_ug',
  '404': 'thiamin_mg',
  '405': 'riboflavin_mg',
  '406': 'niacin_mg',
  '415': 'vitaminB6_mg',
  '417': 'folate_ug',
  '418': 'vitaminB12_ug',
  '301': 'calcium_mg',
  '303': 'iron_mg',
  '304': 'magnesium_mg',
  '305': 'phosphorus_mg',
  '306': 'potassium_mg',
  '309': 'zinc_mg',
  '317': 'selenium_ug',

  // --- micros (modern FDC id -> key) ---
  '1106': 'vitaminA_ug',
  '1162': 'vitaminC_mg',
  '1114': 'vitaminD_ug',
  '1109': 'vitaminE_mg',
  '1185': 'vitaminK_ug',
  '1165': 'thiamin_mg',
  '1166': 'riboflavin_mg',
  '1167': 'niacin_mg',
  '1175': 'vitaminB6_mg',
  '1177': 'folate_ug',
  '1178': 'vitaminB12_ug',
  '1087': 'calcium_mg',
  '1089': 'iron_mg',
  '1090': 'magnesium_mg',
  '1091': 'phosphorus_mg',
  '1092': 'potassium_mg',
  '1095': 'zinc_mg',
  '1103': 'selenium_ug'
};

function getApiKey() {
  try {
    const k = localStorage.getItem(USDA_KEY_STORAGE);
    if (k && k.trim()) return k.trim();
  } catch (e) { /* ignore */ }
  return 'DEMO_KEY';
}

function isUsingDemoKey() {
  return getApiKey() === 'DEMO_KEY';
}

function setApiKey(key) {
  try {
    if (key && key.trim()) localStorage.setItem(USDA_KEY_STORAGE, key.trim());
    else localStorage.removeItem(USDA_KEY_STORAGE);
  } catch (e) { /* ignore */ }
}

// ---- Cache helpers ----

function readCache() {
  try {
    const raw = localStorage.getItem(USDA_CACHE_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function writeCache(cache) {
  try {
    localStorage.setItem(USDA_CACHE_STORAGE, JSON.stringify(cache));
  } catch (e) { /* ignore quota errors */ }
}

function readFoodCache() {
  try {
    const raw = localStorage.getItem(USDA_KEY_FOODS_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function writeFoodCache(cache) {
  try {
    localStorage.setItem(USDA_KEY_FOODS_STORAGE, JSON.stringify(cache));
  } catch (e) { /* ignore */ }
}

// Tracks the outcome of the most recent search so UI can display status.
let lastSearchStatus = { kind: 'idle', message: '', ts: 0 };

function setSearchStatus(kind, message) {
  lastSearchStatus = { kind, message, ts: Date.now() };
}

function getSearchStatus() {
  return lastSearchStatus;
}

function cacheGet(key) {
  const cache = readCache();
  return cache[key] || null;
}

function cacheSet(key, value) {
  const cache = readCache();
  cache[key] = { value, ts: Date.now() };
  writeCache(cache);
}

function foodCacheGet(fdcId) {
  return readFoodCache()[fdcId] || null;
}

function foodCacheSet(fdcId, value) {
  const cache = readFoodCache();
  cache[fdcId] = { value, ts: Date.now() };
  writeFoodCache(cache);
}

// ---- Nutrient mapping ----

/**
 * From a FDC food object's `foodNutrients` array, extract per-100g values
 * for the nutrients we track. FDC `foodNutrients` may use `nutrientId` or
 * `nutrientNumber` depending on endpoint; we handle both.
 */
function extractNutrients(food) {
  const per100 = {};
  const micros = {};
  const list = food.foodNutrients || [];
  const macroKeys = ['calories','protein','carbs','fat','fiber','sugar','sodium'];

  // Energy may appear multiple times under different FDC IDs. Prefer the
  // plain '1008' Energy if present; otherwise use Atwater General ('957');
  // otherwise Atwater Specific ('958'). We track them separately and pick
  // one at the end so we don't accidentally sum them.
  let calPlain = null;
  let calAtwaterGeneral = null;
  let calAtwaterSpecific = null;

  for (const fn of list) {
    // FDC search results shape: { nutrientId, nutrientNumber, nutrientName, value, unitName }
    // FDC detail shape:          { nutrient: { id, number, name, unitName }, amount }
    const n = fn.nutrient || fn;
    const num = String(n.number || n.nutrientNumber || '');
    const id  = String(n.id || n.nutrientId || '');
    const target = NUTRIENT_IDS[num] || NUTRIENT_IDS[id];
    if (!target) continue;

    // Value lives under `amount` in the detail shape, `value` in search shape.
    let value = fn.amount != null ? fn.amount : fn.value;
    if (value == null) continue;
    value = Number(value);
    if (!isFinite(value)) continue;

    if (target === 'calories') {
      calPlain = value;
    } else if (target === 'calories_atwater_general') {
      calAtwaterGeneral = value;
    } else if (target === 'calories_atwater_specific') {
      calAtwaterSpecific = value;
    } else if (macroKeys.includes(target)) {
      per100[target] = Math.round(value * 10) / 10;
    } else {
      micros[target] = Math.round(value * 100) / 100;
    }
  }

  // Resolve the single calorie value, in priority order:
  //   1. Plain '1008' Energy (used by many SR Legacy foods)
  //   2. Atwater General ('957') - the standard convention for Foundation foods
  //   3. Atwater Specific ('958') - food-specific computation
  //   4. Compute from macros (4/4/9) as a last resort
  let calories = null;
  if (calPlain != null) calories = calPlain;
  else if (calAtwaterGeneral != null) calories = calAtwaterGeneral;
  else if (calAtwaterSpecific != null) calories = calAtwaterSpecific;
  else if (per100.protein || per100.carbs || per100.fat) {
    calories = (per100.protein || 0) * 4 +
               (per100.carbs   || 0) * 4 +
               (per100.fat     || 0) * 9;
  }
  per100.calories = calories != null ? Math.round(calories * 10) / 10 : 0;
  // Fill defaults so downstream code doesn't see undefined.
  per100.calories = per100.calories || 0;
  per100.protein  = per100.protein  || 0;
  per100.carbs    = per100.carbs    || 0;
  per100.fat      = per100.fat      || 0;
  per100.fiber    = per100.fiber    || 0;
  per100.sodium   = per100.sodium   || 0;
  per100.sugar    = per100.sugar    || 0;
  return { per100, micros };
}

/**
 * Normalize a FDC search result into our internal "entry" shape, which is
 * compatible with the offline INGREDIENTS table (so the form and lookup
 * utilities can treat them interchangeably).
 */
function normalizeSearchResult(food) {
  const { per100, micros } = extractNutrients(food);
  const description = food.description || 'Unknown food';
  const brand = food.brandOwner || food.brandName || '';
  const displayName = brand ? (description + ' (' + brand + ')') : description;
  return {
    id: 'usda-' + food.fdcId,
    fdcId: food.fdcId,
    source: 'usda',
    name: displayName,
    description: food.description,
    brand,
    dataType: food.dataType,
    unit: 'g',
    per100,
    micros,
    aliases: [description.toLowerCase()]
  };
}

// ---- Public API ----

/**
 * Search FDC. Returns normalized entries. Uses a localStorage cache keyed
 * by the query string (case-insensitive) so repeat searches are instant.
 * @param {string} query
 * @param {number} [pageSize]
 */
async function searchFoods(query, pageSize) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];

  const cacheKey = q.toLowerCase();
  const cached = cacheGet(cacheKey);
  if (cached) {
    setSearchStatus('cache', 'Showing cached results for "' + q + '".');
    return cached.value;
  }

  const url = new URL(USDA_BASE + '/foods/search');
  url.searchParams.set('api_key', getApiKey());
  url.searchParams.set('query', q);
  url.searchParams.set('pageSize', String(pageSize || 10));
  url.searchParams.set('dataType', USDA_DATA_TYPES);

  let response;
  try {
    response = await fetch(url.toString());
  } catch (e) {
    setSearchStatus('error', 'Network error contacting USDA. Are you online?');
    throw new Error('Network error contacting USDA. Are you online?');
  }

  if (!response.ok) {
    if (response.status === 429) {
      const msg = 'USDA rate limit reached. New searches are paused until the limit resets. Try a search you have run before, or wait and try again.';
      setSearchStatus('rate-limited', msg);
      throw new Error(msg);
    }
    if (response.status === 403) {
      const msg = 'USDA API key rejected. Check your key in Settings.';
      setSearchStatus('error', msg);
      throw new Error(msg);
    }
    const msg = 'USDA search failed: HTTP ' + response.status;
    setSearchStatus('error', msg);
    throw new Error(msg);
  }

  const data = await response.json();
  const foods = (data.foods || []).map(normalizeSearchResult);
  cacheSet(cacheKey, foods);
  setSearchStatus('live', '');
  return foods;
}

/**
 * Fetch a single food by fdcId (used to fill in full micros when a search
 * result lacks them). Returns the normalized entry, or null.
 */
async function getFood(fdcId) {
  const cached = foodCacheGet(fdcId);
  if (cached) return cached.value;

  const url = new URL(USDA_BASE + '/food/' + fdcId);
  url.searchParams.set('api_key', getApiKey());

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error('USDA food fetch failed: HTTP ' + response.status);
  }
  const data = await response.json();
  const entry = normalizeSearchResult(data);
  foodCacheSet(fdcId, entry);
  return entry;
}

function clearCache() {
  try {
    localStorage.removeItem(USDA_CACHE_STORAGE);
    localStorage.removeItem(USDA_KEY_FOODS_STORAGE);
  } catch (e) { /* ignore */ }
}

if (typeof window !== 'undefined') {
  window.USDAClient = {
    searchFoods,
    getFood,
    getApiKey,
    setApiKey,
    isUsingDemoKey,
    clearCache,
    getSearchStatus,
    NUTRIENT_IDS
  };
}