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
  // Leafy greens and light produce: much lighter than water per cup.
  // Values are grams per milliliter (i.e. grams per cup / 240).
  'spinach': 0.13,       // 1 cup ~30g
  'kale': 0.28,          // 1 cup ~67g
  'romaine': 0.2,        // 1 cup ~47g
  'iceberg': 0.3,        // 1 cup ~72g
  'arugula': 0.08,       // 1 cup ~20g
  'cabbage': 0.37,       // 1 cup shredded ~89g
  'brussels-sprouts': 0.37,
  'bok-choy': 0.3,
  'swiss-chard': 0.15,   // 1 cup ~36g
  'collard-greens': 0.15,
  'cilantro': 0.07,      // 1 cup ~16g
  'basil-fresh': 0.1,    // 1 cup ~24g
  'mint-fresh': 0.1,
  'parsley-dried': 0.15,
  'basil-dried': 0.15,
  'oregano': 0.15,
  'thyme': 0.15,
  'rosemary': 0.15,

  // Berries and small fruits: ~0.6 g/ml
  'blueberry': 0.62,     // 1 cup ~148g
  'strawberry': 0.63,    // 1 cup sliced ~152g
  'raspberry': 0.52,     // 1 cup ~123g
  'blackberry': 0.6,
  'cranberry': 0.5,
  'cherry': 0.65,
  'grape': 0.62,
  'cherry-tomato': 0.62, // 1 cup ~149g
  'grape-tomato': 0.62,

  // Other produce with notable density differences
  'cucumber': 0.5,       // 1 cup diced ~120g
  'zucchini': 0.5,
  'bell-pepper': 0.6,    // 1 cup diced ~150g
  'mushroom': 0.3,       // 1 cup sliced ~70g
  'portobello': 0.3,
  'leek': 0.35,
  'celery': 0.42,        // 1 cup diced ~101g
  'shallot': 0.55,
  'radish': 0.5,
  'jalapeno': 0.6,
  'poblano': 0.6,
  'okra': 0.4,
  'green-beans': 0.42,   // 1 cup ~100g
  'peas': 0.6,           // 1 cup ~145g
  'corn': 0.65,          // 1 cup ~165g
  'beet': 0.57,          // 1 cup diced ~136g
  'eggplant': 0.35,      // 1 cup diced ~82g
  'pumpkin': 0.42,       // 1 cup mashed ~100g
  'butternut-squash': 0.42,
  'acorn-squash': 0.42,
  'spaghetti-squash': 0.65, // cooked, shredded
  'artichoke': 0.7,
  'turnip': 0.54,
  'onion': 0.67,         // 1 cup diced ~160g
  'carrot': 0.53,        // 1 cup chopped ~128g
  'sweet-potato': 0.7,   // 1 cup cubed ~133g (actually 0.55)
  'potato': 0.63,        // 1 cup diced ~150g
  'tomato': 0.75,        // 1 cup chopped ~180g
  'avocado': 0.63,       // 1 cup cubed ~150g

  // Oils and liquid fats: ~0.91-0.92 g/ml
  'canola-oil': 0.92,
  'sesame-oil': 0.92,
  'avocado-oil': 0.91,
  'peanut-oil': 0.91,
  'ghee': 0.9,
  'lard': 0.92,
  'shortening': 0.85,

  // Condiments
  'ketchup': 1.05,
  'mustard': 1.05,
  'dijon': 1.05,
  'hot-sauce': 1.05,
  'bbq-sauce': 1.15,
  'ranch': 1.0,
  'italian-dressing': 0.95,
  'caesar-dressing': 0.95,
  'balsamic-vinegar': 1.04,
  'apple-cider-vinegar': 1.01,
  'red-wine-vinegar': 1.01,
  'worcestershire': 1.1,
  'fish-sauce': 1.2,
  'oyster-sauce': 1.3,
  'hoisin': 1.3,
  'miso': 1.2,
  'coconut-aminos': 1.05,
  'tomato-sauce': 1.03,
  'tomato-paste': 1.05,
  'salsa-verde': 1.0,
  'pesto': 0.95,
  'honey-mustard': 1.15,
  'mayo-light': 0.95,
  'relish': 1.15,
  'pickles': 1.0,
  'olives-black': 0.6,
  'olives-green': 0.6,
  'capers': 0.6,
  'sun-dried-tomato': 0.6,
  'nutritional-yeast': 0.5,
  'tamari': 1.15,
  'sriracha': 1.05,
  'gochujang': 1.2,

  // Nuts & seeds
  'cashews': 0.6,
  'pecans': 0.5,
  'pistachios': 0.6,
  'macadamia': 0.6,
  'hazelnuts': 0.6,
  'pine-nuts': 0.6,
  'brazil-nuts': 0.6,
  'peanuts': 0.6,
  'sunflower-seeds': 0.6,
  'pumpkin-seeds': 0.6,
  'sesame-seeds': 0.6,
  'poppy-seeds': 0.55,
  'sesame-butter': 1.08,
  'cashew-butter': 1.0,

  // Spices
  'salt': 1.2,
  'black-pepper': 0.5,
  'basil-dried': 0.2,
  'oregano': 0.2,
  'thyme': 0.2,
  'rosemary': 0.2,
  'parsley-dried': 0.2,
  'cinnamon': 0.5,
  'cumin': 0.5,
  'paprika': 0.5,
  'chili-powder': 0.5,
  'cayenne': 0.5,
  'garlic-powder': 0.5,
  'onion-powder': 0.5,
  'nutmeg': 0.5,
  'cocoa-powder': 0.5,
  'baking-powder': 0.9,
  'baking-soda': 0.9,

  // Grains
  'barley': 0.8,
  'farro': 0.8,
  'bulgur': 0.7,
  'couscous': 0.7,
  'buckwheat': 0.8,
  'millet': 0.8,
  'polenta': 0.7,
  'gnocchi': 0.9,
  'couscous-pearl': 0.8,

  // Original entries
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
 *
 * Scoring:
 *   100 = exact match
 *    85 = starts-with match (entry begins with query)
 *    70 = query contains entry, or entry contains query (substring)
 *    60 = 2+ shared tokens (multi-word overlap)
 *    <60 = single-token overlap, treated as too weak to count
 *
 * The 60 floor matters: a single shared word (like "mixed") is NOT enough
 * to consider two ingredients a match. This prevents "mixed berries" from
 * matching "mixed greens" simply because they share one word.
 */
function scoreMatch(entry, query) {
  const q = normalize(query);
  if (!q) return 0;

  const candidates = [entry.name, ...(entry.aliases || [])].map(normalize);
  let best = 0;
  const qTokens = q.split(' ').filter(Boolean);
  for (const c of candidates) {
    if (c === q) { best = Math.max(best, 100); continue; }
    if (c.startsWith(q + ' ') || c === q) { best = Math.max(best, 85); continue; }
    if (c.startsWith(q)) { best = Math.max(best, 80); continue; }
    if (c.includes(q) || q.includes(c)) { best = Math.max(best, 70); continue; }
    // Token overlap: require 2+ shared tokens (unless query is 1 token
    // and it exactly equals a token in the entry, then give a modest score).
    const cTokens = new Set(c.split(' ').filter(Boolean));
    let hits = 0;
    for (const t of qTokens) if (cTokens.has(t)) hits++;
    if (hits >= 2) {
      best = Math.max(best, 60 + (hits - 2) * 5);
    } else if (hits === 1 && qTokens.length === 1) {
      // Single-word query matching a single token in a multi-word entry:
      // weak, but useful for queries like "berries" if a bare match exists.
      best = Math.max(best, 45);
    }
  }
  return best;
}

/**
 * Search the ingredient table. Returns up to `limit` matches sorted by score.
 * Only returns matches at or above the confidence threshold (60).
 */
function searchIngredients(query, limit) {
  const pool = (window.INGREDIENTS || []);
  const scored = pool.map(e => ({ entry: e, score: scoreMatch(e, query) }))
                     .filter(x => x.score >= 60)
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