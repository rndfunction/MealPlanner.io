/**
 * LogFoodModal
 * Additive food logger: adds entries to the day's "eaten" log rather than
 * replacing a slot. Blank by default. Next step will wire in USDA lookup.
 */
const LogFoodModal = {
  name: 'LogFoodModal',
  emits: ['save', 'cancel'],
  data() {
    return {
      rework: false,
      form: {
        name: '',
        notes: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        servings: 1
      },
      // Lookup state
      suggestions: [],
      showSuggestions: false,
      searching: false,
      lookupError: '',
      lookupStatus: null,
      debounceTimer: null,
      pendingEntry: null,   // the food entry the user picked
      servingQty: 1,
      servingUnit: 'g',     // 'g' | 'ml' | 'oz' | 'cup' | 'tbsp' | 'tsp' | 'whole'
      unitOptions: ['g', 'ml', 'oz', 'cup', 'tbsp', 'tsp', 'whole']
    };
  },
  computed: {
    computedCalories() {
      const f = this.form;
      return Math.round((Number(f.protein) || 0) * 4 + (Number(f.carbs) || 0) * 4 + (Number(f.fat) || 0) * 9);
    },
    canSave() {
      return (this.form.name || '').trim().length > 0;
    },
    mergedSuggestions() {
      // Offline first (instant), then USDA deduped by name.
      const offline = (this.suggestions || []).filter(s => s.source !== 'usda');
      const online = (this.suggestions || []).filter(s => s.source === 'usda');
      const seen = new Set(offline.map(s => (s.name || '').toLowerCase()));
      const dedupedOnline = online.filter(s => !seen.has((s.name || '').toLowerCase()));
      return offline.concat(dedupedOnline);
    },
    // Preview of macros for the selected food at the chosen serving.
    servingPreview() {
      if (!this.pendingEntry) return null;
      const entry = this.pendingEntry;
      const n = window.IngredientLookup.nutritionForAmount(
        entry,
        Number(this.servingQty) || 1,
        this.servingUnit
      );
      return n ? { entry, n } : null;
    }
  },
  beforeUnmount() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  },
  methods: {
    onNameInput() {
      const q = (this.form.name || '').trim();
      // Clear pending lookup when the user edits the name after picking.
      this.pendingEntry = null;
      if (q.length < 2) {
        this.suggestions = [];
        this.showSuggestions = false;
        this.lookupError = '';
        return;
      }
      this.searchOffline(q);
      this.showSuggestions = this.suggestions.length > 0 || this.searching || !!this.lookupError;
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.searchUsda(q), 500);
    },
    searchOffline(query) {
      const results = window.IngredientLookup.searchIngredients(query, 5);
      // Tag each with source so the merged list can order them.
      this.suggestions = results.map(r => Object.assign({ source: 'offline' }, r));
    },
    async searchUsda(query) {
      if (!window.USDAClient) return;
      // Skip if the offline table already has an exact-ish match.
      const local = this.suggestions.find(s => s.source !== 'usda' &&
        window.IngredientLookup.normalize(s.name) === window.IngredientLookup.normalize(query));
      if (local) return;
      this.searching = true;
      this.lookupError = '';
      try {
        const results = await window.USDAClient.searchFoods(query, 6);
        if ((this.form.name || '').trim() !== query) return;
        const usda = results.map(r => Object.assign({ source: 'usda' }, r));
        // Merge with offline results already there.
        const offline = this.suggestions.filter(s => s.source !== 'usda');
        this.suggestions = offline.concat(usda);
        this.lookupStatus = window.USDAClient.getSearchStatus ? window.USDAClient.getSearchStatus() : null;
      } catch (e) {
        if ((this.form.name || '').trim() !== query) return;
        this.lookupError = e.message || 'USDA lookup failed.';
        this.lookupStatus = window.USDAClient.getSearchStatus ? window.USDAClient.getSearchStatus() : null;
      } finally {
        this.searching = false;
        this.showSuggestions = this.suggestions.length > 0 || this.searching || !!this.lookupError;
      }
    },
    chooseSuggestion(entry) {
      this.form.name = entry.name;
      this.pendingEntry = entry;
      // Prefer the entry's own base unit.
      this.servingUnit = entry.unit === 'ml' ? 'ml' : (entry.unit === 'g' ? 'g' : 'whole');
      this.suggestions = [];
      this.showSuggestions = false;
      this.lookupError = '';
    },
    applyServing() {
      const preview = this.servingPreview;
      if (!preview) return;
      const n = preview.n;
      // Preserve the source precision. The inputs accept decimals; display
      // formatting handles rounding at render time.
      this.form.calories = n.calories;
      this.form.protein = n.protein;
      this.form.carbs = n.carbs;
      this.form.fat = n.fat;
      this.form.fiber = n.fiber || 0;
      this.form.sodium = n.sodium || 0;
      // Serving multiplier stays 1 because we're baking the total into the
      // macros directly.
      this.form.servings = 1;
    },
    // Re-apply automatically whenever the user tweaks qty or unit, so there
    // is no separate confirm step. The button remains as a fallback.
    onServingChanged() {
      if (this.pendingEntry) this.applyServing();
    },
    // Display helper: format a number with sensible precision (whole if
    // integer, otherwise up to 2 decimals, trailing zeros trimmed).
    fmtNum(v) {
      if (v == null || isNaN(v)) return '0';
      const n = Number(v);
      if (Number.isInteger(n)) return n.toString();
      return (Math.round(n * 100) / 100).toString();
    },
    useMacros() {
      this.form.calories = this.computedCalories;
    },
    lookupStatusClass() {
      if (!this.lookupStatus) return '';
      if (this.lookupStatus.kind === 'rate-limited') return 'alert-warning';
      if (this.lookupStatus.kind === 'error') return 'alert-error';
      return 'alert-info';
    },
    save() {
      if (!this.canSave) return;
      const entry = {
        name: this.form.name.trim(),
        notes: (this.form.notes || '').trim(),
        calories: Number(this.form.calories) || 0,
        protein: Number(this.form.protein) || 0,
        carbs: Number(this.form.carbs) || 0,
        fat: Number(this.form.fat) || 0,
        fiber: Number(this.form.fiber) || 0,
        sugar: Number(this.form.sugar) || 0,
        sodium: Number(this.form.sodium) || 0,
        servings: Number(this.form.servings) || 1,
        micros: {}
      };
      this.$emit('save', { entry, rework: this.rework });
    },
    cancel() {
      this.$emit('cancel');
    }
  },
  template: `
    <div
      class="modal-backdrop"
      style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; overflow-y: auto;">
      <form
        @submit.prevent="save"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-title"
        class="card"
        style="max-width: 640px; width: 100%; max-height: 90vh; overflow-y: auto;"
        @click.stop>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 id="log-title" style="margin: 0; font-size: 1.25rem;">Log what I&rsquo;ve eaten</h2>
          <button type="button" class="btn btn-secondary btn-small" @click="cancel">Cancel</button>
        </div>

        <p style="font-size: 0.875rem; color: var(--color-base); margin-top: 0;">
          This is added on top of your planned meals. Add as many entries as you
          like &mdash; the planner will adjust what it generates for the rest of your day.
        </p>

        <div class="form-group" style="position: relative;">
          <label class="form-label" for="log-name">What did you eat? *</label>
          <p class="form-hint">
            Start typing and pick from suggestions to pull nutrition from the
            food database (offline + USDA). Or just type it and fill macros in yourself.
          </p>
          <input
            id="log-name"
            class="form-input"
            type="text"
            v-model="form.name"
            required
            autocomplete="off"
            placeholder="e.g. coffee, oatmeal, banana"
            @input="onNameInput"
            @focus="showSuggestions = suggestions.length > 0">

          <ul
            v-if="showSuggestions"
            role="listbox"
            style="position: absolute; top: 100%; left: 0; right: 0; z-index: 20;
                   background: white; border: 1px solid var(--color-base-light);
                   border-radius: 4px; margin: 0.25rem 0 0 0; padding: 0;
                   list-style: none; box-shadow: var(--shadow-md); max-height: 260px; overflow-y: auto;">
            <li
              v-for="s in mergedSuggestions"
              :key="s.id"
              role="option"
              style="padding: 0.5rem 0.75rem; cursor: pointer; border-bottom: 1px solid var(--color-base-lightest);"
              @click="chooseSuggestion(s)">
              <strong>{{ s.name }}</strong>
              <span
                v-if="s.source === 'usda'"
                class="nutrition-badge"
                style="font-size: 0.65rem; background: var(--color-primary-light); margin-left: 0.5rem;">
                USDA
              </span>
              <span style="color: var(--color-base); font-size: 0.75rem;">
                &middot; {{ s.per100.calories }} kcal/100{{ s.unit || 'g' }}
              </span>
            </li>
            <li v-if="searching" style="padding: 0.5rem 0.75rem; color: var(--color-base); font-size: 0.875rem;">
              Searching USDA&hellip;
            </li>
            <li v-if="lookupError" style="padding: 0.5rem 0.75rem; color: var(--color-error); font-size: 0.8rem;">
              {{ lookupError }}
            </li>
          </ul>
        </div>

        <div
          v-if="pendingEntry"
          class="card"
          style="background: var(--color-primary-light); padding: 0.75rem; margin-bottom: 1rem;">
          <div style="font-size: 0.85rem; margin-bottom: 0.75rem;">
            <strong>Choose serving size</strong>
            <span style="color: var(--color-base-dark); font-weight: 400; margin-left: 0.5rem;">
              using USDA: {{ pendingEntry.name }}
            </span>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end;">
            <div style="flex: 0 0 100px;">
              <label class="form-label" for="log-qty" style="font-size: 0.8rem;">Qty</label>
              <input
                id="log-qty"
                class="form-input"
                type="number"
                min="0"
                step="0.25"
                v-model.number="servingQty"
                @input="onServingChanged">
            </div>
            <div style="flex: 0 0 100px;">
              <label class="form-label" for="log-unit" style="font-size: 0.8rem;">Unit</label>
              <select id="log-unit" class="form-select" v-model="servingUnit" @change="onServingChanged">
                <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
              </select>
            </div>
            <button type="button" class="btn btn-primary btn-small" @click="applyServing">
              Use this serving
            </button>
            <button type="button" class="btn btn-secondary btn-small" @click="pendingEntry = null">
              Clear match
            </button>
          </div>
          <div v-if="servingPreview" style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--color-base-dark);">
            <strong>{{ fmtNum(servingPreview.n.calories) }} kcal</strong> &middot;
            P {{ fmtNum(servingPreview.n.protein) }}g &middot;
            C {{ fmtNum(servingPreview.n.carbs) }}g &middot;
            F {{ fmtNum(servingPreview.n.fat) }}g
            <span style="color: var(--color-base);">
              ({{ fmtNum(servingPreview.n.baseAmount) }}{{ servingPreview.n.base }})
            </span>
          </div>
        </div>

        <div
          v-if="lookupStatus && lookupStatus.message"
          class="alert"
          :class="lookupStatusClass()"
          role="status"
          style="font-size: 0.8rem; margin-bottom: 1rem;">
          {{ lookupStatus.message }}
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
              <input id="log-cal" class="form-input" type="number" min="0" step="0.01" v-model.number="form.calories">
            </div>
            <div>
              <label class="form-label" for="log-p">Protein (g)</label>
              <input id="log-p" class="form-input" type="number" min="0" step="0.01" v-model.number="form.protein">
            </div>
            <div>
              <label class="form-label" for="log-c">Carbs (g)</label>
              <input id="log-c" class="form-input" type="number" min="0" step="0.01" v-model.number="form.carbs">
            </div>
            <div>
              <label class="form-label" for="log-f">Fat (g)</label>
              <input id="log-f" class="form-input" type="number" min="0" step="0.01" v-model.number="form.fat">
            </div>
            <div>
              <label class="form-label" for="log-fiber">Fiber (g)</label>
              <input id="log-fiber" class="form-input" type="number" min="0" step="0.01" v-model.number="form.fiber">
            </div>
            <div>
              <label class="form-label" for="log-sugar">Sugar (g)</label>
              <input id="log-sugar" class="form-input" type="number" min="0" step="0.01" v-model.number="form.sugar">
            </div>
          </div>

          <div style="margin-top: 0.75rem;">
            <label class="form-label" for="log-sodium">Sodium (mg)</label>
            <input id="log-sodium" class="form-input" type="number" min="0" step="0.01" v-model.number="form.sodium" style="max-width: 200px;">
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

        <fieldset class="form-group" style="border-top: 1px solid var(--color-base-light); padding-top: 1rem;">
          <legend class="form-label">After adding</legend>
          <div class="radio-group">
            <div class="radio-item">
              <input
                type="radio"
                id="log-keep"
                name="log-mode"
                :value="false"
                v-model="rework">
              <label for="log-keep">
                Keep my menu as planned
                <span style="display: block; font-size: 0.8rem; color: var(--color-base);">
                  Totals will reflect what you've eaten. The menu stays put.
                </span>
              </label>
            </div>
            <div class="radio-item">
              <input
                type="radio"
                id="log-rework"
                name="log-mode"
                :value="true"
                v-model="rework">
              <label for="log-rework">
                Rework my remaining meals
                <span style="display: block; font-size: 0.8rem; color: var(--color-base);">
                  Replan recipe slots so the day still lands near your target.
                </span>
              </label>
            </div>
          </div>
        </fieldset>

        <div style="display: flex; gap: 0.5rem;">
          <button type="submit" class="btn btn-primary" :disabled="!canSave">
            {{ rework ? 'Add and rework menu' : 'Add to log' }}
          </button>
          <button type="button" class="btn btn-secondary" @click="cancel">Cancel</button>
        </div>
      </form>
    </div>
  `
};

if (typeof window !== 'undefined') {
  window.LogFoodModal = LogFoodModal;
}