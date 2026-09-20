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
    if (!entry || !entry.recipe) continue;
    const mult = entry.servings || 1;
    const r = entry.recipe;
    totals.calories += (r.calories || 0) * mult;
    totals.protein  += (r.protein  || 0) * mult;
    totals.carbs    += (r.carbs    || 0) * mult;
    totals.fat      += (r.fat      || 0) * mult;
    totals.fiber    += (r.fiber    || 0) * mult;
    totals.sugar    += (r.sugar    || 0) * mult;
    totals.sodium   += (r.sodium   || 0) * mult;
  }
  // round for display sanity
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
  return totals;
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
  const requiredTags = filters.tags || [];
  const excludedAllergens = filters.allergens || [];
  const excludedTags = filters.excludeTags || [];
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