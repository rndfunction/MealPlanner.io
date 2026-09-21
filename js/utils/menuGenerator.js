/**
 * Menu Generator
 * Builds a daily menu that approximates caloric and macro targets while
 * respecting dietary restrictions and (optionally) cuisine preferences.
 *
 * Strategy:
 *  1. Filter the recipe pool to only compliant recipes.
 *  2. Split the daily calorie target across meal slots using weights.
 *  3. For each slot, score every candidate recipe by how well it closes the
 *     remaining gap toward the daily target (with slight variance for variety),
 *     preferring recipes from the user's preferred cuisines when set.
 *  4. Avoid repeating a recipe within the same day.
 */

/**
 * Default slot weights by number of meals. These are rough guidance; the
 * generator still targets the full-day total.
 */
const SLOT_WEIGHTS = {
  3: { breakfast: 0.30, lunch: 0.35, dinner: 0.35 },
  4: { breakfast: 0.25, lunch: 0.30, dinner: 0.35, snack: 0.10 },
  5: { breakfast: 0.22, lunch: 0.26, dinner: 0.32, snack: 0.20 },
  6: { breakfast: 0.20, lunch: 0.22, dinner: 0.28, snack: 0.30 }
};

/**
 * Build the ordered list of meal slots for a day.
 * @param {string[]} meals - e.g. ['breakfast','lunch','dinner']
 * @param {number} snacksPerDay - number of snack slots to add
 * @returns {string[]}
 */
function buildSlotList(meals, snacksPerDay) {
  const slots = [];
  const order = ['breakfast', 'lunch', 'dinner'];
  for (const m of order) {
    if (meals.includes(m)) slots.push(m);
  }
  for (let i = 0; i < snacksPerDay; i++) slots.push('snack');
  return slots;
}

/**
 * Distribute a daily calorie total across slots by weight.
 */
function distributeCalories(totalCalories, slots) {
  const byCategory = {};
  for (const s of slots) byCategory[s] = (byCategory[s] || 0) + 1;

  const weights = {};
  let totalWeight = 0;
  for (const cat of Object.keys(byCategory)) {
    const base = SLOT_WEIGHTS[slots.length]?.[cat] ?? 0.20;
    weights[cat] = base;
    totalWeight += base * byCategory[cat];
  }
  // Normalize so total weight across all slots is 1.
  const perSlot = {};
  for (const s of slots) {
    const cat = s;
    const normalized = weights[cat] / totalWeight;
    perSlot[s] = totalCalories * normalized;
  }
  return perSlot;
}

/**
 * Score a recipe against a set of remaining targets.
 * Lower score = better fit. Uses weighted squared error so calories dominate
 * slightly but macros still matter.
 */
function scoreRecipe(recipe, remaining, preferences) {
  // If remaining calories are very low, penalize large recipes.
  const calDelta = recipe.calories - remaining.calories;
  const proDelta = recipe.protein  - remaining.protein;
  const carDelta = recipe.carbs    - remaining.carbs;
  const fatDelta = recipe.fat      - remaining.fat;

  // Weight calories most heavily, macros next.
  const wCal = 1.0;
  const wPro = 0.35;
  const wCar = 0.20;
  const wFat = 0.25;

  let score =
    wCal * (calDelta * calDelta) / 10000 +
    wPro * (proDelta * proDelta) / 100 +
    wCar * (carDelta * carDelta) / 100 +
    wFat * (fatDelta * fatDelta) / 100;

  // Slight bonus for preferred cuisines
  if (preferences.cuisines && preferences.cuisines.length > 0) {
    if (preferences.cuisines.includes(recipe.cuisine)) {
      score *= 0.85;
    }
  }

  // Slight bonus for high-protein recipes when protein is behind
  if (remaining.protein > 0 && recipe.protein >= 20) {
    score *= 0.95;
  }

  return score;
}

/**
 * Pick a recipe for a given category from the pool, given current running
 * totals and remaining targets. Excludes recipes already used today.
 *
 * Uses weighted-random sampling over the top N candidates so consecutive
 * calls can return different (but still high-quality) recipes.
 */
function pickForSlot(pool, category, remaining, usedIds, preferences) {
  const candidates = pool.filter(r => r.category === category && !usedIds.has(r.id));
  if (candidates.length === 0) return null;

  // Score every candidate.
  const scored = candidates.map(r => ({
    recipe: r,
    score: scoreRecipe(r, remaining, preferences)
  })).sort((a, b) => a.score - b.score);

  // Consider the top N (or all if fewer), weight by inverse score so the
  // best options are still favored but others can win.
  const topN = scored.slice(0, Math.min(4, scored.length));
  // Convert scores to weights. Lower score => higher weight.
  // Use 1/(score + epsilon) so we never divide by zero.
  const weights = topN.map(s => 1 / (s.score + 0.01));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < topN.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return topN[i].recipe;
  }
  // Fallback (shouldn't reach here)
  return topN[0].recipe;
}

/**
 * Deterministic pick — always returns the single best-scoring recipe.
 * Used when the caller needs to know what the "ideal" choice would be.
 */
function pickBestForSlot(pool, category, remaining, usedIds, preferences) {
  const candidates = pool.filter(r => r.category === category && !usedIds.has(r.id));
  if (candidates.length === 0) return null;
  let best = null;
  let bestScore = Infinity;
  for (const r of candidates) {
    const s = scoreRecipe(r, remaining, preferences);
    if (s < bestScore) { bestScore = s; best = r; }
  }
  return best;
}

/**
 * Generate a single day's menu.
 * @param {object} options
 * @param {object[]} options.recipes - all recipes
 * @param {string[]} options.meals - which meals to include (breakfast/lunch/dinner)
 * @param {number} options.snacksPerDay
 * @param {object} options.targets - { calories, protein, carbs, fat }
 * @param {object[]} options.dietTags - required tags e.g. ['vegetarian','gluten-free']
 * @param {object[]} options.excludeAllergens - e.g. ['dairy','tree nuts']
 * @param {object[]} options.cuisines - preferred cuisines (optional)
 * @returns {object} { entries: [...], totals, remaining }
 */
function generateDay(options) {
  const {
    recipes, meals, snacksPerDay, targets,
    dietTags = [], excludeAllergens = [], cuisines = []
  } = options;

  const pool = Nutrition.filterRecipes(recipes, {
    tags: dietTags,
    allergens: excludeAllergens
  });

  if (pool.length === 0) {
    return { entries: [], totals: zeroTotals(), poolEmpty: true };
  }

  const slots = buildSlotList(meals, snacksPerDay);
  const perSlotCalories = distributeCalories(targets.calories, slots);

  // Scale macro targets proportionally per slot based on the calorie share.
  const totals = zeroTotals();
  const entries = [];
  const usedIds = new Set();

  for (const slot of slots) {
    const share = targets.calories > 0
      ? (perSlotCalories[slot] || 0) / targets.calories
      : 0;

    const remaining = {
      calories: Math.max(0, targets.calories - totals.calories),
      protein:  Math.max(0, targets.protein  - totals.protein),
      carbs:    Math.max(0, targets.carbs    - totals.carbs),
      fat:      Math.max(0, targets.fat      - totals.fat)
    };

    const recipe = pickForSlot(pool, slot, remaining, usedIds, { cuisines });
    if (!recipe) {
      // No candidates for this slot; skip.
      continue;
    }
    usedIds.add(recipe.id);

    entries.push({
      slot,
      recipe,
      servings: 1,
      targetCalories: Math.round(perSlotCalories[slot] || 0)
    });

    totals.calories += recipe.calories;
    totals.protein  += recipe.protein;
    totals.carbs    += recipe.carbs;
    totals.fat      += recipe.fat;
    totals.fiber    += recipe.fiber;
    totals.sugar    += recipe.sugar;
    totals.sodium   += recipe.sodium;
  }

  // Round
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);

  return {
    entries,
    totals,
    remaining: {
      calories: Math.round(targets.calories - totals.calories),
      protein:  Math.round(targets.protein  - totals.protein),
      carbs:    Math.round(targets.carbs    - totals.carbs),
      fat:      Math.round(targets.fat      - totals.fat)
    }
  };
}

/**
 * Re-roll a single slot in an existing day. Recomputes totals from scratch.
 * Excludes the current recipe so the swap always produces a different recipe
 * (as long as at least one alternative exists in the pool).
 */
function regenerateSlot(options, dayEntries, slotIndex) {
  const { recipes, targets, dietTags = [], excludeAllergens = [], cuisines = [] } = options;
  const pool = Nutrition.filterRecipes(recipes, {
    tags: dietTags,
    allergens: excludeAllergens
  });

  const targetEntry = dayEntries[slotIndex];
  if (!targetEntry) return dayEntries;

  // Exclude recipes used in OTHER slots AND the current recipe itself.
  const usedIds = new Set(
    dayEntries.filter((_, i) => i !== slotIndex).map(e => e.recipe.id)
  );
  usedIds.add(targetEntry.recipe.id);

  const remaining = {
    calories: Math.max(0, targets.calories - sumEntryCalories(dayEntries, slotIndex, 'calories')),
    protein:  Math.max(0, targets.protein  - sumEntryCalories(dayEntries, slotIndex, 'protein')),
    carbs:    Math.max(0, targets.carbs    - sumEntryCalories(dayEntries, slotIndex, 'carbs')),
    fat:      Math.max(0, targets.fat      - sumEntryCalories(dayEntries, slotIndex, 'fat'))
  };

  // Try randomized pick first. If the pool has only the current recipe,
  // fall back to the same recipe (no alternative exists).
  let newRecipe = pickForSlot(pool, targetEntry.slot, remaining, usedIds, { cuisines });
  if (!newRecipe) {
    // Only the current recipe matches — keep it.
    return dayEntries;
  }

  const next = dayEntries.slice();
  next[slotIndex] = { ...targetEntry, recipe: newRecipe };
  return next;
}

function sumEntryCalories(entries, excludeIndex, field) {
  let sum = 0;
  entries.forEach((e, i) => {
    if (i === excludeIndex) return;
    sum += (e.recipe[field] || 0) * (e.servings || 1);
  });
  return sum;
}

function zeroTotals() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
}

// Expose globally
if (typeof window !== 'undefined') {
  window.MenuGenerator = {
    buildSlotList,
    distributeCalories,
    generateDay,
    regenerateSlot,
    pickBestForSlot,
    zeroTotals
  };
}