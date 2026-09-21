/**
 * LogFoodModal
 * Modal for entering a manually-logged meal (restaurant food, pantry snack, etc.)
 * Prefills with any existing logged data if the slot already holds one.
 */
const LogFoodModal = {
  name: 'LogFoodModal',
  props: {
    slotLabel: { type: String, default: '' },
    initial: { type: Object, default: null }
  },
  emits: ['save', 'cancel'],
  data() {
    const blank = { name: '', notes: '', calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
    return {
      form: Object.assign({}, blank, this.initial || {})
    };
  },
  computed: {
    computedCalories() {
      const f = this.form;
      return Math.round((Number(f.protein) || 0) * 4 + (Number(f.carbs) || 0) * 4 + (Number(f.fat) || 0) * 9);
    },
    canSave() {
      return (this.form.name || '').trim().length > 0;
    }
  },
  methods: {
    useMacros() {
      this.form.calories = this.computedCalories;
    },
    save() {
      if (!this.canSave) return;
      const payload = {
        name: this.form.name.trim(),
        notes: (this.form.notes || '').trim(),
        calories: Number(this.form.calories) || 0,
        protein: Number(this.form.protein) || 0,
        carbs: Number(this.form.carbs) || 0,
        fat: Number(this.form.fat) || 0,
        fiber: Number(this.form.fiber) || 0,
        sugar: Number(this.form.sugar) || 0,
        sodium: Number(this.form.sodium) || 0,
        micros: {}
      };
      this.$emit('save', payload);
    },
    cancel() {
      this.$emit('cancel');
    }
  },
  template: `
    <div
      class="modal-backdrop"
      style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; overflow-y: auto;"
      @click.self="cancel">
      <form
        @submit.prevent="save"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-title"
        class="card"
        style="max-width: 640px; width: 100%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 id="log-title" style="margin: 0; font-size: 1.25rem;">
            Log food <span v-if="slotLabel" style="color: var(--color-base); font-weight: 400;">for {{ slotLabel }}</span>
          </h2>
          <button type="button" class="btn btn-secondary btn-small" @click="cancel">Cancel</button>
        </div>

        <div class="form-group">
          <label class="form-label" for="log-name">What did you eat? *</label>
          <input id="log-name" class="form-input" type="text" v-model="form.name" required
                 placeholder="e.g. Chicken burrito bowl from Chipotle">
        </div>

        <div class="form-group">
          <label class="form-label" for="log-notes">Notes (optional)</label>
          <textarea id="log-notes" class="form-input" rows="2" v-model="form.notes"></textarea>
        </div>

        <fieldset class="form-group">
          <legend class="form-label">Nutrition</legend>
          <p class="form-hint">Fill in what you know. Click "Use macros" to derive calories from protein/carbs/fat.</p>

          <div class="grid-3">
            <div>
              <label class="form-label" for="log-cal">Calories</label>
              <input id="log-cal" class="form-input" type="number" min="0" v-model.number="form.calories">
            </div>
            <div>
              <label class="form-label" for="log-p">Protein (g)</label>
              <input id="log-p" class="form-input" type="number" min="0" v-model.number="form.protein">
            </div>
            <div>
              <label class="form-label" for="log-c">Carbs (g)</label>
              <input id="log-c" class="form-input" type="number" min="0" v-model.number="form.carbs">
            </div>
            <div>
              <label class="form-label" for="log-f">Fat (g)</label>
              <input id="log-f" class="form-input" type="number" min="0" v-model.number="form.fat">
            </div>
            <div>
              <label class="form-label" for="log-fiber">Fiber (g)</label>
              <input id="log-fiber" class="form-input" type="number" min="0" v-model.number="form.fiber">
            </div>
            <div>
              <label class="form-label" for="log-sugar">Sugar (g)</label>
              <input id="log-sugar" class="form-input" type="number" min="0" v-model.number="form.sugar">
            </div>
          </div>

          <div style="margin-top: 0.75rem;">
            <label class="form-label" for="log-sodium">Sodium (mg)</label>
            <input id="log-sodium" class="form-input" type="number" min="0" v-model.number="form.sodium" style="max-width: 200px;">
          </div>

          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-small" @click="useMacros">
              Use macros ({{ computedCalories }} kcal)
            </button>
            <span style="font-size: 0.875rem; color: var(--color-base);">
              Current: {{ form.calories }} kcal
            </span>
          </div>
        </fieldset>

        <div style="display: flex; gap: 0.5rem;">
          <button type="submit" class="btn btn-primary" :disabled="!canSave">Save</button>
          <button type="button" class="btn btn-secondary" @click="cancel">Cancel</button>
        </div>
      </form>
    </div>
  `
};

if (typeof window !== 'undefined') {
  window.LogFoodModal = LogFoodModal;
}