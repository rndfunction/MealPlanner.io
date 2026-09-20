/**
 * MenuDisplay component
 * Renders the day's menu, per-meal nutrition, and re-roll controls.
 */
const MenuDisplay = {
  name: 'MenuDisplay',
  props: {
    entries: { type: Array, required: true },
    targets: { type: Object, required: true }
  },
  emits: ['reroll', 'view-recipe'],
  data() {
    return {
      expandedIndex: null
    };
  },
  methods: {
    slotLabel(slot) {
      const map = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
      return map[slot] || slot;
    },
    toggleExpand(index) {
      this.expandedIndex = this.expandedIndex === index ? null : index;
    },
    reroll(index) {
      this.$emit('reroll', index);
    },
    viewRecipe(recipe) {
      this.$emit('view-recipe', recipe);
    },
    fmtCal(n) { return Nutrition.formatCalories(n); },
    fmtG(n) { return Nutrition.formatGrams(n); },
    diffLabel(recipe, targetCalories) {
      const diff = recipe.calories - targetCalories;
      if (Math.abs(diff) < 30) return 'On target';
      return diff > 0
        ? '+' + Math.round(diff) + ' kcal vs slot target'
        : Math.round(diff) + ' kcal vs slot target';
    }
  },
  template: `
    <section class="card" aria-labelledby="menu-heading">
      <h2 class="card-header" id="menu-heading">Your Daily Menu</h2>

      <div v-if="entries.length === 0" class="alert alert-warning" role="status">
        No recipes matched your preferences. Try relaxing dietary restrictions or allergens.
      </div>

      <ul class="menu-list" role="list" style="list-style: none; padding: 0; margin: 0;">
        <li
          v-for="(entry, index) in entries"
          :key="entry.recipe.id + '-' + index"
          class="menu-item"
          style="border: 1px solid var(--color-base-light); border-radius: 4px; padding: 1rem; margin-bottom: 1rem;">

          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
            <div style="flex: 1 1 60%;">
              <div class="slot-label" style="text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: var(--color-primary-dark); font-weight: 700;">
                {{ slotLabel(entry.slot) }}
              </div>
              <h3 style="margin: 0.25rem 0 0.5rem 0; font-size: 1.125rem;">
                {{ entry.recipe.name }}
              </h3>
              <p style="margin: 0 0 0.75rem 0; color: var(--color-base-dark);">
                {{ entry.recipe.description }}
              </p>

              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span class="nutrition-badge">
                  <strong>{{ fmtCal(entry.recipe.calories) }}</strong>
                </span>
                <span class="nutrition-badge">
                  P <strong>{{ fmtG(entry.recipe.protein) }}</strong>
                </span>
                <span class="nutrition-badge">
                  C <strong>{{ fmtG(entry.recipe.carbs) }}</strong>
                </span>
                <span class="nutrition-badge">
                  F <strong>{{ fmtG(entry.recipe.fat) }}</strong>
                </span>
                <span class="nutrition-badge">
                  Fiber <strong>{{ fmtG(entry.recipe.fiber) }}</strong>
                </span>
              </div>

              <div style="font-size: 0.875rem; color: var(--color-base);">
                {{ entry.recipe.prepTime }} min prep &middot; {{ entry.recipe.cookTime }} min cook
                &middot; <em>{{ diffLabel(entry.recipe, entry.targetCalories) }}</em>
              </div>

              <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem;">
                <span
                  v-for="tag in entry.recipe.tags"
                  :key="tag"
                  class="nutrition-badge"
                  style="font-size: 0.75rem; background: var(--color-primary-light);">
                  {{ tag }}
                </span>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 0 0 auto;">
              <button
                type="button"
                class="btn btn-secondary btn-small"
                @click="reroll(index)"
                :aria-label="'Replace ' + entry.recipe.name">
                Replace
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-small"
                @click="toggleExpand(index)"
                :aria-expanded="expandedIndex === index"
                :aria-controls="'recipe-details-' + index">
                {{ expandedIndex === index ? 'Hide' : 'Details' }}
              </button>
            </div>
          </div>

          <div
            v-if="expandedIndex === index"
            :id="'recipe-details-' + index"
            style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--color-base-light);">
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem;">Ingredients</h4>
            <ul style="margin: 0 0 1rem 0; padding-left: 1.25rem;">
              <li v-for="(ing, i) in entry.recipe.ingredients" :key="i">
                {{ ing.amount }} {{ ing.item }}
              </li>
            </ul>

            <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem;">Full Nutrition</h4>
            <div class="grid-3" style="gap: 0.5rem;">
              <div class="nutrition-badge">Calories: <strong>{{ fmtCal(entry.recipe.calories) }}</strong></div>
              <div class="nutrition-badge">Protein: <strong>{{ fmtG(entry.recipe.protein) }}</strong></div>
              <div class="nutrition-badge">Carbs: <strong>{{ fmtG(entry.recipe.carbs) }}</strong></div>
              <div class="nutrition-badge">Fat: <strong>{{ fmtG(entry.recipe.fat) }}</strong></div>
              <div class="nutrition-badge">Fiber: <strong>{{ fmtG(entry.recipe.fiber) }}</strong></div>
              <div class="nutrition-badge">Sugar: <strong>{{ fmtG(entry.recipe.sugar) }}</strong></div>
              <div class="nutrition-badge">Sodium: <strong>{{ Nutrition.formatSodium(entry.recipe.sodium) }}</strong></div>
              <div class="nutrition-badge">Cuisine: <strong>{{ entry.recipe.cuisine }}</strong></div>
            </div>

            <div v-if="entry.recipe.allergens && entry.recipe.allergens.length"
                 style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--color-error);">
              <strong>Contains:</strong> {{ entry.recipe.allergens.join(', ') }}
            </div>
          </div>
        </li>
      </ul>
    </section>
  `
};

if (typeof window !== 'undefined') {
  window.MenuDisplay = MenuDisplay;
}