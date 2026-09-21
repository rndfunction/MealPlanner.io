/**
 * Ingredient lookup utilities.
 * Searches the offline INGREDIENTS table by name/alias, and converts
 * household amounts (cups, tbsp, etc.) into grams or milliliters so we
 * can compute nutrition contributions.
 *
 * Volume-to-weight conversions use approximate densities for common
 * ingredients; for anything unknown we fall back to water-like density
 * (1 cup = 240 ml = 240 g) which is often close enough for a rough estimate.
 */

// Unit conversions to base units: grams (mass) or milliliters (volume)
const UNIT_TO_BASE = {
  // Mass units -> grams
  'g':    { base: 'g', factor: 1 },
  'gram': { base: 'g', factor: 1 },
  'grams':{ base: 'g', factor: 1 },
  'kg':   { base: 'g', factor: 1000 },
  'oz':   { base: 'g', factor: 28.3495 },
  'ounce':{ base: 'g', factor: 28.3495 },
  'ounces':{ base: 'g', factor: 28.3495 },
  'lb':   { base: 'g', factor: 453.592 },
  'pound':{ base: 'g', factor: 453.592 },
  'pounds':{ base: 'g', factor: 453.592 },

  // Volume units -> milliliters
  'ml':   { base: 'ml', factor: 1 },
  'milliliter': { base: 'ml', factor: 1 },
  'milliliters':{ base: 'ml', factor: 1 },
  'l':    { base: 'ml', factor: 1000 },
  'liter':{ base: 'ml', factor: 1000 },
  'liters':{ base: 'ml', factor: 1000 },
  'tsp':  { base: 'ml', factor: 4.92892 },
  'teaspoon':{ base: 'ml', factor: 4.92892 },
  'teaspoons':{ base: 'ml', factor: 4.92892 },
  'tbsp': { base: 'ml', factor: 14.7868 },
  'tablespoon':{ base: 'ml', factor: 14.7868 },
  'tablespoons':{ base: 'ml', factor: 14.7868 },
  'cup':  { base: 'ml', factor: 240 },
  'cups': { base: 'ml', factor: 240 },
  'fl oz':{ base: 'ml', factor: 29.5735 },
  'pint': { base: 'ml', factor: 473.176 },
  'quart':{ base: 'ml', factor: 946.353 },
  'gallon':{ base: 'ml', factor: 3785.41 }
};

// Approximate densities (grams per milliliter) for common ingredients when
// converting volume to mass. Values are rough but reasonable.
const DENSITY_G_PER_ML = {
  'oats': 0.41,
  'rice-white': 0.85,
  'rice-brown': 0.85,
  'quinoa': 0.72,
  'pasta': 0.5,
  'bread': 0.4,
  'almonds': 0.6,
  'walnuts': 0.5,
  'chia': 0.65,
  'flax': 0.6,
  'hemp': 0.6,
  'honey': 1.42,
  'maple-syrup': 1.32,
  'peanut-butter': 1.08,
  'almond-butter': 1.08,
  'tahini': 1.08,
  'hummus': 1.0,
  'mayo': 0.91,
  'salsa': 1.0,
  'soy-sauce': 1.15,
  'olive-oil': 0.91,
  'coconut-oil': 0.92,
  'butter': 0.91,
  'greek-yogurt': 1.0,
  'cheddar': 0.55,
  'parmesan': 0.55,
  'granola': 0.4,
  'protein-powder': 0.5,
  'curry-powder': 0.5,
  'turmeric': 0.5
};

/**
 * Normalize a string for fuzzy matching: lowercase, strip punctuation,
 * collapse whitespace.
 */
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score how well `query` matches an ingredient entry. Higher is better.
 * Considers name match, alias matches, and token overlap.
 */
function scoreMatch(entry, query) {
  const q = normalize(query);
  if (!q) return 0;

  const candidates = [entry.name, ...(entry.aliases || [])].map(normalize);
  let best = 0;
  for (const c of candidates) {
    if (c === q) { best = Math.max(best, 100); continue; }
    if (c.startsWith(q)) { best = Math.max(best, 80); continue; }
    if (c.includes(q))   { best = Math.max(best, 60); continue; }
    // token overlap
    const cTokens = new Set(c.split(' '));
    const qTokens = q.split(' ');
    let hits = 0;
    for (const t of qTokens) if (cTokens.has(t)) hits++;
    if (hits > 0) best = Math.max(best, 30 + hits * 10);
  }
  return best;
}

/**
 * Search the ingredient table. Returns up to `limit` matches sorted by score.
 */
function searchIngredients(query, limit) {
  const pool = (window.INGREDIENTS || []);
  const scored = pool.map(e => ({ entry: e, score: scoreMatch(e, query) }))
                     .filter(x => x.score > 0)
                     .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit || 5).map(x => x.entry);
}

/**
 * Convert an amount + unit into the entry's base unit (grams or milliliters).
 * Returns null if the unit is unknown.
 */
function convertToBase(amount, unit, entry) {
  const u = normalize(unit);
  const conv = UNIT_TO_BASE[u];
  if (!conv) return null;

  const baseAmount = amount * conv.factor;

  if (conv.base === 'g') {
    // Already mass. If the entry is measured in ml, we need a density to go
    // the other way; but mass is mass, so use as-is for a rough estimate.
    return { base: entry.unit, value: baseAmount };
  }

  // Converted to ml. If the entry is measured in ml, we're done.
  if (entry.unit === 'ml') {
    return { base: 'ml', value: baseAmount };
  }

  // Entry is in grams; use density if known, else 1 g/ml approximation.
  const density = DENSITY_G_PER_ML[entry.id] || 1.0;
  return { base: 'g', value: baseAmount * density };
}

/**
 * Given an ingredient entry and an amount+unit, return the nutrition
 * contribution (macros) from that amount. If the unit can't be converted,
 * returns null.
 */
function nutritionForAmount(entry, amount, unit) {
  const converted = convertToBase(amount, unit, entry);
  if (!converted) return null;
  const factor = converted.value / 100; // per100 baseline
  const p = entry.per100;
  return {
    calories: Math.round(p.calories * factor * 10) / 10,
    protein:  Math.round(p.protein  * factor * 10) / 10,
    carbs:    Math.round(p.carbs    * factor * 10) / 10,
    fat:      Math.round(p.fat      * factor * 10) / 10,
    fiber:    Math.round((p.fiber || 0) * factor * 10) / 10,
    sodium:   Math.round((p.sodium || 0) * factor * 10) / 10,
    base:     converted.base,
    baseAmount: Math.round(converted.value * 10) / 10
  };
}

/**
 * Sum nutrition across an ingredient list, where each item may or may not
 * have been matched to a table entry. Items without a match are skipped.
 * Returns totals plus a count of how many items contributed.
 */
function sumIngredients(ingredients) {
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 };
  let matched = 0;
  let unmatched = 0;
  for (const ing of ingredients) {
    if (!ing.matched || !ing.entry) { unmatched++; continue; }
    const n = nutritionForAmount(ing.entry, ing.amount, ing.unit);
    if (!n) { unmatched++; continue; }
    matched++;
    totals.calories += n.calories;
    totals.protein  += n.protein;
    totals.carbs    += n.carbs;
    totals.fat      += n.fat;
    totals.fiber    += n.fiber;
    totals.sodium   += n.sodium;
  }
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return { totals, matched, unmatched };
}

if (typeof window !== 'undefined') {
  window.IngredientLookup = {
    searchIngredients,
    convertToBase,
    nutritionForAmount,
    sumIngredients,
    normalize
  };
}