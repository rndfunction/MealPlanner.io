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
 * calls can return different (but still high-quality) recipes. When
 * `avoidRecipe` is provided (typically the recipe currently in the slot),
 * a similarity penalty pushes the sampler away from that recipe so re-rolls
 * feel meaningfully different even when the calorie slot is nearly unchanged.
 */
function pickForSlot(pool, category, remaining, usedIds, preferences, avoidRecipe) {
  const candidates = pool.filter(r => r.category === category && !usedIds.has(r.id));
  if (candidates.length === 0) return null;

  // Score every candidate.
  const scored = candidates.map(r => {
    let s = scoreRecipe(r, remaining, preferences);
    // Similarity penalty vs. the recipe we're trying to move away from.
    if (avoidRecipe) {
      s += similarityPenalty(r, avoidRecipe);
    }
    return { recipe: r, score: s };
  }).sort((a, b) => a.score - b.score);

  // Consider a wider window of candidates so re-rolls have room to vary.
  const windowSize = Math.min(8, scored.length);
  const topN = scored.slice(0, windowSize);

  // Weight by inverse score so the best options are still favored, but
  // worse-in-window options get a real chance.
  const weights = topN.map(s => 1 / (s.score + 0.05));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let roll = Math.random() * totalWeight;
  for (let i = 0; i < topN.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return topN[i].recipe;
  }
  return topN[0].recipe;
}

/**
 * Penalty added to a candidate's score based on how similar it is to
 * `avoid`. Normalized by calories so we can compare across recipes of
 * different sizes. Roughly: identical recipes get a big penalty; wildly
 * different ones get almost none.
 */
function similarityPenalty(candidate, avoid) {
  if (!candidate || !avoid) return 0;
  const calScale = Math.max(100, (avoid.calories || 0) * 0.5);
  const dc = (candidate.calories - (avoid.calories || 0)) / calScale;
  const dp = (candidate.protein  - (avoid.protein  || 0)) / 25;
  const dcar = (candidate.carbs  - (avoid.carbs    || 0)) / 40;
  const df = (candidate.fat      - (avoid.fat      || 0)) / 20;
  const distance = Math.sqrt(dc*dc + dp*dp + dcar*dcar + df*df);

  // Very close matches get a strong push; distant ones get none.
  const penalty = Math.max(0, 1.5 - distance) * 3;
  return penalty;
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

  // Fill pass: nudge totals toward the daily target by adjusting servings
  // on the largest meal(s) in 0.5 increments.
  closeGap(entries, targets);

  // Recompute totals from the (possibly adjusted) servings.
  const finalTotals = zeroTotals();
  for (const e of entries) {
    const r = e.recipe;
    if (!r) continue;
    const mult = e.servings || 1;
    finalTotals.calories += (r.calories || 0) * mult;
    finalTotals.protein  += (r.protein  || 0) * mult;
    finalTotals.carbs    += (r.carbs    || 0) * mult;
    finalTotals.fat      += (r.fat      || 0) * mult;
    finalTotals.fiber    += (r.fiber    || 0) * mult;
    finalTotals.sugar    += (r.sugar    || 0) * mult;
    finalTotals.sodium   += (r.sodium   || 0) * mult;
  }
  for (const k of Object.keys(finalTotals)) finalTotals[k] = Math.round(finalTotals[k]);

  return {
    entries,
    totals: finalTotals,
    remaining: {
      calories: Math.round(targets.calories - finalTotals.calories),
      protein:  Math.round(targets.protein  - finalTotals.protein),
      carbs:    Math.round(targets.carbs    - finalTotals.carbs),
      fat:      Math.round(targets.fat      - finalTotals.fat)
    }
  };
}

/**
 * Adjust servings on the largest meal(s) to bring the day's calorie total
 * within ~5% of the target. Only touches recipe-kind entries, never below
 * 0.5 servings.
 */
function closeGap(entries, targets) {
  const target = targets.calories || 0;
  if (target <= 0) return;

  const total = () => entries.reduce((sum, e) => {
    if (!e || !e.recipe) return sum;
    return sum + (e.recipe.calories || 0) * (e.servings || 1);
  }, 0);

  let guard = 20;
  while (guard-- > 0) {
    const cur = total();
    const diff = target - cur;
    const pctOff = target > 0 ? Math.abs(diff) / target : 0;
    if (pctOff < 0.05) break;

    let biggestIdx = -1;
    let biggestCal = 0;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e || !e.recipe) continue;
      const c = e.recipe.calories || 0;
      if (c > biggestCal) { biggestCal = c; biggestIdx = i; }
    }
    if (biggestIdx < 0 || biggestCal === 0) break;

    const e = entries[biggestIdx];
    const currentServings = e.servings || 1;

    if (diff > 0) {
      // Under target. Bump by 0.5 servings, but stop if that would overshoot
      // by more than the current gap (i.e. make things worse).
      const bump = biggestCal * 0.5;
      const projected = cur + bump;
      if (Math.abs(projected - target) > Math.abs(diff)) break;
      e.servings = Math.round((currentServings + 0.5) * 2) / 2;
    } else {
      // Over target. Trim 0.5 servings, floor at 0.5.
      if (currentServings <= 0.5) {
        // Try the next-largest meal if this one can't go smaller.
        let secondIdx = -1, secondCal = 0;
        for (let i = 0; i < entries.length; i++) {
          if (i === biggestIdx) continue;
          const e2 = entries[i];
          if (!e2 || !e2.recipe) continue;
          const c = e2.recipe.calories || 0;
          if (c > secondCal && (e2.servings || 1) > 0.5) { secondCal = c; secondIdx = i; }
        }
        if (secondIdx < 0) break;
        const e2 = entries[secondIdx];
        e2.servings = Math.round(((e2.servings || 1) - 0.5) * 2) / 2;
      } else {
        e.servings = Math.round((currentServings - 0.5) * 2) / 2;
      }
    }
  }
}

/**
 * Count how many recipes in the pool are eligible for a given category
 * under the active filter set. Used by the UI to warn when a slot has no
 * meaningful re-roll variety (e.g. only one vegan breakfast recipe exists).
 */
function countCandidatesForSlot(recipes, category, filters) {
  const f = filters || {};
  const pool = Nutrition.filterRecipes(recipes, {
    tags: f.dietTags || [],
    allergens: f.excludeAllergens || []
  });
  return pool.filter(r => r.category === category).length;
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

  // Collect recipe IDs used elsewhere (only recipe-kind entries count).
  const usedIds = new Set();
  dayEntries.forEach((e, i) => {
    if (i === slotIndex || !e) return;
    const kind = e.kind || (e.recipe ? 'recipe' : null);
    if (kind === 'recipe' && e.recipe && e.recipe.id) usedIds.add(e.recipe.id);
  });
  // Also exclude the current slot's recipe if it has one.
  if (targetEntry.recipe && targetEntry.recipe.id) {
    usedIds.add(targetEntry.recipe.id);
  }

  const remaining = {
    calories: Math.max(0, targets.calories - sumEntryMacro(dayEntries, slotIndex, 'calories')),
    protein:  Math.max(0, targets.protein  - sumEntryMacro(dayEntries, slotIndex, 'protein')),
    carbs:    Math.max(0, targets.carbs    - sumEntryMacro(dayEntries, slotIndex, 'carbs')),
    fat:      Math.max(0, targets.fat      - sumEntryMacro(dayEntries, slotIndex, 'fat'))
  };

  // Pass the current recipe as `avoidRecipe` so the picker actively steers
  // away from re-returning the same (or a near-identical) choice.
  const avoid = (targetEntry.kind === 'recipe' || !targetEntry.kind)
    ? (targetEntry.recipe || null)
    : null;

  const newRecipe = pickForSlot(pool, targetEntry.slot, remaining, usedIds, { cuisines }, avoid);
  if (!newRecipe) return dayEntries;

  const next = dayEntries.slice();
  next[slotIndex] = {
    slot: targetEntry.slot,
    kind: 'recipe',
    recipe: newRecipe,
    servings: 1,
    targetCalories: targetEntry.targetCalories || 0
  };
  return next;
}

/**
 * Replace the recipe in a slot with a specific recipe chosen by the user.
 * Preserves slot shape, resets servings to 1, and clears kind to 'recipe'.
 */
function setSlotRecipe(dayEntries, slotIndex, recipe) {
  if (slotIndex < 0 || slotIndex >= dayEntries.length || !recipe) return dayEntries;
  const next = dayEntries.slice();
  const slot = next[slotIndex];
  next[slotIndex] = {
    slot: slot.slot,
    kind: 'recipe',
    recipe,
    servings: 1,
    targetCalories: slot.targetCalories || 0
  };
  return next;
}

/**
 * Sum a macro across all entries except the given index. Uses
 * Nutrition.entryMacros so it handles recipe, logged, and empty entries.
 */
function sumEntryMacro(entries, excludeIndex, field) {
  let sum = 0;
  entries.forEach((e, i) => {
    if (i === excludeIndex) return;
    const macros = Nutrition.entryMacros(e);
    if (!macros) return;
    sum += (macros[field] || 0) * (e.servings || 1);
  });
  return sum;
}

function zeroTotals() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
}

/**
 * Build an array of empty slots for the given meal structure. Useful when
 * starting a day from scratch or after "clear all".
 */
function buildEmptySlots(meals, snacksPerDay, targets) {
  const slots = buildSlotList(meals, snacksPerDay);
  const perSlotCalories = distributeCalories(targets.calories, slots);
  return slots.map(slot => ({
    slot,
    kind: 'empty',
    servings: 1,
    targetCalories: Math.round(perSlotCalories[slot] || 0)
  }));
}

// Expose globally
if (typeof window !== 'undefined') {
  window.MenuGenerator = {
    buildSlotList,
    distributeCalories,
    generateDay,
    regenerateSlot,
    setSlotRecipe,
    closeGap,
    pickBestForSlot,
    buildEmptySlots,
    countCandidatesForSlot,
    zeroTotals
  };
}