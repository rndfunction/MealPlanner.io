/**
 * RecipePickerModal
 * Modal for choosing a specific recipe to fill a meal slot.
 * Respects the current preferences (diet tags + excluded allergens).
 */
const RecipePickerModal = {
  name: 'RecipePickerModal',
  props: {
    recipes: { type: Array, required: true },
    filters: { type: Object, default: () => ({}) },
    slotLabel: { type: String, default: '' }
  },
  emits: ['pick', 'cancel'],
  data() {
    return {
      query: '',
      selectedCategory: ''
    };
  },
  computed: {
    eligible() {
      // Pass both naming conventions so this stays correct regardless of
      // which shape the caller used. filterRecipes now accepts either.
      const f = this.filters || {};
      return Nutrition.filterRecipes(this.recipes, {
        tags: f.dietTags || f.tags || [],
        allergens: f.excludeAllergens || f.allergens || []
      });
    },
    activeRestrictions() {
      const f = this.filters || {};
      const tags = f.dietTags || f.tags || [];
      const allergens = f.excludeAllergens || f.allergens || [];
      return { tags, allergens };
    },
    filtered() {
      const q = this.query.trim().toLowerCase();
      return this.eligible.filter(r => {
        if (this.selectedCategory && r.category !== this.selectedCategory) return false;
        if (!q) return true;
        return (r.name || '').toLowerCase().includes(q) ||
               (r.description || '').toLowerCase().includes(q);
      });
    },
    categories() {
      const set = new Set(this.eligible.map(r => r.category));
      return Array.from(set);
    }
  },
  methods: {
    pick(recipe) {
      this.$emit('pick', recipe);
    },
    cancel() {
      this.$emit('cancel');
    },
    fmtCal(n) { return Nutrition.formatCalories(n); },
    fmtG(n) { return Nutrition.formatGrams(n); }
  },
  template: `
    <div
      class="modal-backdrop"
      style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; overflow-y: auto;"
      @click.self="cancel">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        class="card"
        style="max-width: 760px; width: 100%; max-height: 85vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 id="picker-title" style="margin: 0; font-size: 1.25rem;">
            Pick a recipe <span v-if="slotLabel" style="color: var(--color-base); font-weight: 400;">for {{ slotLabel }}</span>
          </h2>
          <button type="button" class="btn btn-secondary btn-small" @click="cancel">Close</button>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
          <input
            type="text"
            class="form-input"
            v-model="query"
            placeholder="Search recipes..."
            aria-label="Search recipes"
            style="flex: 1 1 200px;">
          <select class="form-select" v-model="selectedCategory" style="flex: 0 0 160px;" aria-label="Filter by category">
            <option value="">All categories</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div v-if="activeRestrictions.tags.length || activeRestrictions.allergens.length"
             class="alert alert-info"
             role="status"
             style="font-size: 0.8rem;">
          <strong>Filtered by your preferences:</strong>
          <span v-if="activeRestrictions.tags.length">
            requires {{ activeRestrictions.tags.join(', ') }}
          </span>
          <span v-if="activeRestrictions.tags.length && activeRestrictions.allergens.length"> &middot; </span>
          <span v-if="activeRestrictions.allergens.length">
            excludes {{ activeRestrictions.allergens.join(', ') }}
          </span>
        </div>

        <div v-if="filtered.length === 0" class="alert alert-warning">
          No recipes match your current preferences and search.
        </div>

        <ul style="list-style: none; padding: 0; margin: 0;">
          <li
            v-for="r in filtered"
            :key="r.id"
            style="border: 1px solid var(--color-base-light); border-radius: 4px; padding: 0.75rem; margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
              <div style="flex: 1 1 60%;">
                <div style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary-dark); font-weight: 700;">
                  {{ r.category }}
                </div>
                <strong>{{ r.name }}</strong>
                <div style="color: var(--color-base-dark); font-size: 0.875rem; margin-top: 0.25rem;">
                  {{ r.description }}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.8rem;">
                  <span class="nutrition-badge"><strong>{{ fmtCal(r.calories) }}</strong></span>
                  <span class="nutrition-badge">P {{ fmtG(r.protein) }}</span>
                  <span class="nutrition-badge">C {{ fmtG(r.carbs) }}</span>
                  <span class="nutrition-badge">F {{ fmtG(r.fat) }}</span>
                </div>
                <div v-if="r.tags && r.tags.length"
                     style="display: flex; flex-wrap: wrap; gap: 0.25rem; margin-top: 0.5rem;">
                  <span
                    v-for="tag in r.tags"
                    :key="tag"
                    class="nutrition-badge"
                    style="font-size: 0.7rem; background: var(--color-primary-light);">
                    {{ tag }}
                  </span>
                </div>
                <div v-if="r.allergens && r.allergens.length"
                     style="margin-top: 0.4rem; font-size: 0.75rem; color: var(--color-error);">
                  <strong>Contains:</strong> {{ r.allergens.join(', ') }}
                </div>
              </div>
              <button
                type="button"
                class="btn btn-primary btn-small"
                @click="pick(r)">
                Use this
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  `
};

if (typeof window !== 'undefined') {
  window.RecipePickerModal = RecipePickerModal;
}