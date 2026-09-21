/**
 * Nutrition utilities
 * Handles caloric/macro target calculation, comparison, and formatting.
 */

/**
 * Calculate macro gram targets from calories and percentage split.
 * @param {number} calories - daily calorie target
 * @param {object} split - { protein, carbs, fat } percentages summing to 100
 * @returns {{ protein: number, carbs: number, fat: number }} grams per day
 */
function calculateMacroTargets(calories, split) {
  const kcalPerGram = { protein: 4, carbs: 4, fat: 9 };
  return {
    protein: Math.round((calories * (split.protein / 100)) / kcalPerGram.protein),
    carbs: Math.round((calories * (split.carbs / 100)) / kcalPerGram.carbs),
    fat: Math.round((calories * (split.fat / 100)) / kcalPerGram.fat)
  };
}

/**
 * Compute a food's calories from macros (4/4/9 rule). Useful for validation.
 */
function caloriesFromMacros(protein, carbs, fat) {
  return (protein * 4) + (carbs * 4) + (fat * 9);
}

/**
 * Sum nutrition across an array of menu entries.
 * Each entry must have a `recipe` object and a `servings` multiplier.
 * @param {Array} entries
 * @returns {object} totals for calories, protein, carbs, fat, fiber, sugar, sodium
 */
function sumNutrition(entries) {
  const totals = {
    calories: 0, protein: 0, carbs: 0, fat: 0,
    fiber: 0, sugar: 0, sodium: 0
  };
  for (const entry of entries) {
    const macros = entryMacros(entry);
    if (!macros) continue;
    const mult = entry.servings || 1;
    totals.calories += (macros.calories || 0) * mult;
    totals.protein  += (macros.protein  || 0) * mult;
    totals.carbs    += (macros.carbs    || 0) * mult;
    totals.fat      += (macros.fat      || 0) * mult;
    totals.fiber    += (macros.fiber    || 0) * mult;
    totals.sugar    += (macros.sugar    || 0) * mult;
    totals.sodium   += (macros.sodium   || 0) * mult;
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return totals;
}

/**
 * Extract the macro object from any entry kind:
 *   - { kind: 'recipe', recipe: {...} }       -> the recipe
 *   - { kind: 'logged', logged: {...} }       -> the logged nutrition
 *   - { kind: 'empty' }                       -> null (contributes nothing)
 *   - legacy { recipe: {...} } with no kind   -> treated as recipe
 */
function entryMacros(entry) {
  if (!entry) return null;
  const kind = entry.kind || (entry.recipe ? 'recipe' : null);
  if (kind === 'recipe') return entry.recipe || null;
  if (kind === 'logged') return entry.logged || null;
  return null;
}

/**
 * Sum micronutrients across an array of menu entries. Each entry may carry
 * `micros` (from USDA or custom data) either directly on the recipe or on
 * the logged object. Empty entries are skipped and don't count toward
 * coverage.
 *
 * Returns { totals, coverage } where coverage is the fraction of
 * considered entries that had any micronutrient data (0..1).
 */
function sumMicros(entries) {
  const totals = {};
  let withData = 0;
  let considered = 0;

  for (const entry of entries) {
    const kind = entry && (entry.kind || (entry.recipe ? 'recipe' : null));
    if (!entry || kind === 'empty') continue;
    considered++;
    const mult = entry.servings || 1;
    const source = kind === 'logged' ? (entry.logged || {}) : (entry.recipe || {});
    const micros = source.micros || {};
    const keys = Object.keys(micros).filter(k => micros[k] != null && !isNaN(micros[k]));
    if (keys.length === 0) continue;
    withData++;
    for (const k of keys) {
      totals[k] = (totals[k] || 0) + (micros[k] * mult);
    }
  }

  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k] * 100) / 100;

  return {
    totals,
    coverage: considered > 0 ? withData / considered : 0,
    entriesWithData: withData,
    entriesConsidered: considered
  };
}

/**
 * Given micro totals and an RDA profile key, compute percentage of RDA per
 * nutrient and a status. Uses 70% as "close", 100%+ as "met".
 */
function compareMicrosToRDA(microTotals, profileKey) {
  const profile = (window.RDA && window.RDA[profileKey]) || {};
  const meta = window.NUTRIENT_META || [];
  const result = [];
  for (const m of meta) {
    const target = profile[m.key];
    if (!target) continue;
    const actual = microTotals[m.key] || 0;
    const percent = Math.round((actual / target) * 100);
    let status = 'under';
    if (percent >= 100) status = 'met';
    else if (percent >= 70) status = 'close';
    result.push({
      key: m.key,
      label: m.label,
      group: m.group,
      unit: m.unit,
      actual,
      target,
      percent,
      status
    });
  }
  return result;
}

/**
 * Compare actual totals to targets. Returns per-metric deltas and a status.
 * Status thresholds are tolerant: within 10% is "on-target", otherwise
 * "under" or "over".
 * @param {object} totals
 * @param {object} targets - { calories, protein, carbs, fat }
 * @returns {object} keyed by metric
 */
function compareToTargets(totals, targets) {
  const metrics = ['calories', 'protein', 'carbs', 'fat'];
  const result = {};
  for (const m of metrics) {
    const actual = totals[m] || 0;
    const target = targets[m] || 0;
    const diff = actual - target;
    const pct = target > 0 ? (actual / target) * 100 : 0;
    let status = 'on-target';
    if (pct < 90) status = 'under';
    else if (pct > 110) status = 'over';
    result[m] = {
      actual, target, diff,
      percent: Math.round(pct),
      status
    };
  }
  return result;
}

/**
 * Compute percentage of calories from each macro.
 */
function macroPercentages(totals) {
  const kcal = caloriesFromMacros(totals.protein, totals.carbs, totals.fat);
  if (kcal === 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: Math.round((totals.protein * 4 / kcal) * 100),
    carbs: Math.round((totals.carbs * 4 / kcal) * 100),
    fat: Math.round((totals.fat * 9 / kcal) * 100)
  };
}

/**
 * Class helper for formatting nutrition values for display.
 */
function formatNumber(n, decimals = 0) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  return n.toFixed(decimals);
}

function formatGrams(n) {
  return formatNumber(n, 0) + 'g';
}

function formatCalories(n) {
  return formatNumber(n, 0) + ' kcal';
}

function formatSodium(n) {
  return formatNumber(n, 0) + 'mg';
}

/**
 * Human-readable label for a status string.
 */
function statusLabel(status) {
  switch (status) {
    case 'under': return 'Below target';
    case 'over':  return 'Above target';
    case 'on-target': return 'On target';
    default: return status;
  }
}

/**
 * Map a status string to the CSS class used for color-coding.
 */
function statusClass(status) {
  switch (status) {
    case 'under': return 'status-warning';
    case 'over':  return 'status-error';
    case 'on-target': return 'status-good';
    default: return '';
  }
}

/**
 * Given a full list of recipes and a filter set, return matching recipes.
 * @param {Array} recipes
 * @param {object} filters - { tags: string[], allergens: string[], excludeTags: string[] }
 */
function filterRecipes(recipes, filters) {
  // Accept both naming conventions so callers can't accidentally pass the
  // wrong keys and get an unfiltered list back. The planner uses
  // { dietTags, excludeAllergens } while lower-level code uses
  // { tags, allergens }. Both are honored.
  const f = filters || {};
  const requiredTags = f.tags || f.dietTags || [];
  const excludedAllergens = f.allergens || f.excludeAllergens || [];
  const excludedTags = f.excludeTags || [];
  return recipes.filter(r => {
    const rTags = r.tags || [];
    const rAllergens = r.allergens || [];
    // must have every required tag
    for (const t of requiredTags) {
      if (!rTags.includes(t)) return false;
    }
    // must not contain any excluded allergen
    for (const a of excludedAllergens) {
      if (rAllergens.includes(a)) return false;
    }
    // must not contain any excluded tag
    for (const t of excludedTags) {
      if (rTags.includes(t)) return false;
    }
    return true;
  });
}

// Expose for non-module use
if (typeof window !== 'undefined') {
  window.Nutrition = {
    calculateMacroTargets,
    caloriesFromMacros,
    sumNutrition,
    entryMacros,
    sumMicros,
    compareMicrosToRDA,
    compareToTargets,
    macroPercentages,
    formatNumber,
    formatGrams,
    formatCalories,
    formatSodium,
    statusLabel,
    statusClass,
    filterRecipes
  };
}