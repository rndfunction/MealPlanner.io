/**
 * MenuDisplay component
 * Renders the day's menu as editable slots. Each slot can be:
 *   - a generated/picked recipe
 *   - a manually logged food
 *   - empty (cleared)
 *
 * Emits:
 *   reroll(index)       - replace slot with a fresh generated pick
 *   pick-recipe(index)  - user wants to pick a recipe (parent opens modal)
 *   log-food(index)     - user wants to log food (parent opens modal)
 *   clear-slot(index)   - empty the slot
 */
const MenuDisplay = {
  name: 'MenuDisplay',
  props: {
    entries: { type: Array, required: true },
    targets: { type: Object, required: true }
  },
  emits: ['reroll', 'pick-recipe', 'log-food', 'clear-slot'],
  data() {
    return {
      expandedIndex: null,
      highlightedIndex: null
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
      this.highlightedIndex = index;
      this.$emit('reroll', index);
      setTimeout(() => {
        if (this.highlightedIndex === index) this.highlightedIndex = null;
      }, 1200);
    },
    pickRecipe(index) {
      this.$emit('pick-recipe', index);
    },
    logFood(index) {
      this.$emit('log-food', index);
    },
    clearSlot(index) {
      this.$emit('clear-slot', index);
    },
    kindOf(entry) {
      return entry && entry.kind ? entry.kind : 'recipe';
    },
    // Nutrition accessors that work for both recipe and logged entries.
    kcalOf(entry) {
      if (this.kindOf(entry) === 'logged') return entry.logged.calories || 0;
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.calories || 0;
      return 0;
    },
    proteinOf(entry) {
      if (this.kindOf(entry) === 'logged') return entry.logged.protein || 0;
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.protein || 0;
      return 0;
    },
    carbsOf(entry) {
      if (this.kindOf(entry) === 'logged') return entry.logged.carbs || 0;
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.carbs || 0;
      return 0;
    },
    fatOf(entry) {
      if (this.kindOf(entry) === 'logged') return entry.logged.fat || 0;
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.fat || 0;
      return 0;
    },
    fiberOf(entry) {
      if (this.kindOf(entry) === 'logged') return entry.logged.fiber || 0;
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.fiber || 0;
      return 0;
    },
    titleOf(entry) {
      if (this.kindOf(entry) === 'logged') return entry.logged.name || 'Logged food';
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.name;
      return '(empty)';
    },
    descriptionOf(entry) {
      if (this.kindOf(entry) === 'logged') return entry.logged.notes || 'Manually logged.';
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.description || '';
      return '';
    },
    tagsOf(entry) {
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.tags || [];
      if (this.kindOf(entry) === 'logged') {
        const t = entry.logged.tags;
        return Array.isArray(t) ? t : [];
      }
      return [];
    },
    allergensOf(entry) {
      if (this.kindOf(entry) === 'recipe' && entry.recipe) return entry.recipe.allergens || [];
      return [];
    },
    diffLabel(entry) {
      if (this.kindOf(entry) === 'empty') return '';
      const target = entry.targetCalories || 0;
      const actual = this.kcalOf(entry);
      const diff = actual - target;
      if (Math.abs(diff) < 30) return 'On target for this slot';
      return diff > 0
        ? '+' + Math.round(diff) + ' kcal vs slot target'
        : Math.round(diff) + ' kcal vs slot target';
    },
    fmtCal(n) { return Nutrition.formatCalories(n); },
    fmtG(n) { return Nutrition.formatGrams(n); }
  },
  template: `
    <section class="card" aria-labelledby="menu-heading">
      <h2 class="card-header" id="menu-heading">Your Daily Menu</h2>

      <div v-if="entries.length === 0" class="alert alert-warning" role="status">
        No meals yet. Pick a recipe or log food to get started.
      </div>

      <ul class="menu-list" role="list" style="list-style: none; padding: 0; margin: 0;">
        <li
          v-for="(entry, index) in entries"
          :key="index + '-' + (entry.recipe ? entry.recipe.id : (entry.logged ? entry.logged.name : 'empty'))"
          class="menu-item"
          :class="{ 'menu-item-highlight': highlightedIndex === index }"
          style="border: 1px solid var(--color-base-light); border-radius: 4px; padding: 1rem; margin-bottom: 1rem; transition: background-color 0.4s ease, box-shadow 0.4s ease;">

          <!-- EMPTY SLOT -->
          <div v-if="kindOf(entry) === 'empty'">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div class="slot-label" style="text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: var(--color-primary-dark); font-weight: 700;">
                  {{ slotLabel(entry.slot) }}
                </div>
                <p style="margin: 0.25rem 0; color: var(--color-base);">
                  No meal planned for this slot.
                </p>
              </div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-primary btn-small" @click="reroll(index)">
                  Generate
                </button>
                <button type="button" class="btn btn-secondary btn-small" @click="pickRecipe(index)">
                  Pick a recipe
                </button>
                <button type="button" class="btn btn-secondary btn-small" @click="logFood(index)">
                  Log food
                </button>
              </div>
            </div>
          </div>

          <!-- POPULATED SLOT (recipe or logged) -->
          <div v-else>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
              <div style="flex: 1 1 60%;">
                <div class="slot-label" style="text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; color: var(--color-primary-dark); font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
                  <span>{{ slotLabel(entry.slot) }}</span>
                  <span
                    v-if="kindOf(entry) === 'logged'"
                    class="nutrition-badge"
                    style="font-size: 0.65rem; background: var(--color-warning); color: var(--color-base-darkest);">
                    Logged
                  </span>
                </div>
                <h3 style="margin: 0.25rem 0 0.5rem 0; font-size: 1.125rem;">
                  {{ titleOf(entry) }}
                </h3>
                <p v-if="descriptionOf(entry)" style="margin: 0 0 0.75rem 0; color: var(--color-base-dark);">
                  {{ descriptionOf(entry) }}
                </p>

                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <span class="nutrition-badge"><strong>{{ fmtCal(kcalOf(entry)) }}</strong></span>
                  <span class="nutrition-badge">P <strong>{{ fmtG(proteinOf(entry)) }}</strong></span>
                  <span class="nutrition-badge">C <strong>{{ fmtG(carbsOf(entry)) }}</strong></span>
                  <span class="nutrition-badge">F <strong>{{ fmtG(fatOf(entry)) }}</strong></span>
                  <span class="nutrition-badge">Fiber <strong>{{ fmtG(fiberOf(entry)) }}</strong></span>
                </div>

                <div style="font-size: 0.875rem; color: var(--color-base);">
                  <template v-if="kindOf(entry) === 'recipe'">
                    {{ entry.recipe.prepTime }} min prep &middot; {{ entry.recipe.cookTime }} min cook
                    &middot;
                  </template>
                  <em>{{ diffLabel(entry) }}</em>
                </div>

                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem;">
                  <span
                    v-for="tag in tagsOf(entry)"
                    :key="tag"
                    class="nutrition-badge"
                    style="font-size: 0.75rem; background: var(--color-primary-light);">
                    {{ tag }}
                  </span>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 0 0 auto;">
                <button
                  v-if="kindOf(entry) === 'recipe'"
                  type="button"
                  class="btn btn-secondary btn-small"
                  @click="reroll(index)"
                  :aria-label="'Replace ' + titleOf(entry) + ' with a fresh generated pick'">
                  Replace
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  @click="pickRecipe(index)">
                  Pick recipe
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  @click="logFood(index)">
                  Log food
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-small"
                  @click="clearSlot(index)">
                  Clear
                </button>
                <button
                  v-if="kindOf(entry) === 'recipe'"
                  type="button"
                  class="btn btn-secondary btn-small"
                  @click="toggleExpand(index)"
                  :aria-expanded="expandedIndex === index"
                  :aria-controls="'recipe-details-' + index">
                  {{ expandedIndex === index ? 'Hide' : 'Details' }}
                </button>
              </div>
            </div>

            <!-- RECIPE DETAILS -->
            <div
              v-if="kindOf(entry) === 'recipe' && expandedIndex === index"
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

              <div v-if="allergensOf(entry).length"
                   style="margin-top: 0.75rem; font-size: 0.875rem; color: var(--color-error);">
                <strong>Contains:</strong> {{ allergensOf(entry).join(', ') }}
              </div>
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