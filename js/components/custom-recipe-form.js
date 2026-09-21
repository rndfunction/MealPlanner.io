/**
 * CustomRecipeForm component
 * Form for creating or editing a user's own recipe.
 *
 * Data model matches the built-in recipe schema, plus a `micros` object
 * (currently optional / mostly empty; placeholder for the future
 * micronutrient tracking feature).
 */
const CustomRecipeForm = {
  name: 'CustomRecipeForm',
  props: {
    editing: { type: Object, default: null }
  },
  emits: ['save', 'cancel'],
  data() {
    return {
      showMicros: false,
      newIngredientItem: '',
      newIngredientAmount: '',
      newIngredientUnit: '',
      ingredientSuggestions: [],
      showSuggestions: false,
      usdaSuggestions: [],
      usdaSearching: false,
      usdaError: '',
      usdaStatus: null,
      usdaDebounceTimer: null,
      usingDemoKey: false,
      unitOptions: [
        'g', 'oz', 'lb', 'ml', 'l',
        'tsp', 'tbsp', 'cup',
        'whole', 'slice', 'clove', 'piece'
      ],
      ingredientNutritionPreview: null,
      categories: [
        { value: 'breakfast', label: 'Breakfast' },
        { value: 'lunch', label: 'Lunch' },
        { value: 'dinner', label: 'Dinner' },
        { value: 'snack', label: 'Snack' }
      ],
      cuisineOptions: [
        { value: 'american', label: 'American' },
        { value: 'mediterranean', label: 'Mediterranean' },
        { value: 'asian', label: 'Asian' },
        { value: 'mexican', label: 'Mexican' },
        { value: 'italian', label: 'Italian' },
        { value: 'indian', label: 'Indian' },
        { value: 'other', label: 'Other' }
      ],
      tagOptions: [
        'vegetarian', 'vegan', 'gluten-free', 'dairy-free',
        'nut-free', 'soy-free', 'high-protein', 'omega-3'
      ],
      allergenOptions: [
        'dairy', 'gluten', 'egg', 'tree nuts',
        'peanut', 'soy', 'fish', 'shellfish', 'sesame'
      ],
      microFields: [
        { key: 'vitaminA_ug', label: 'Vitamin A (mcg)' },
        { key: 'vitaminC_mg', label: 'Vitamin C (mg)' },
        { key: 'vitaminD_ug', label: 'Vitamin D (mcg)' },
        { key: 'vitaminE_mg', label: 'Vitamin E (mg)' },
        { key: 'vitaminK_ug', label: 'Vitamin K (mcg)' },
        { key: 'thiamin_mg', label: 'Thiamin B1 (mg)' },
        { key: 'riboflavin_mg', label: 'Riboflavin B2 (mg)' },
        { key: 'niacin_mg', label: 'Niacin B3 (mg)' },
        { key: 'vitaminB6_mg', label: 'Vitamin B6 (mg)' },
        { key: 'folate_ug', label: 'Folate (mcg)' },
        { key: 'vitaminB12_ug', label: 'Vitamin B12 (mcg)' },
        { key: 'calcium_mg', label: 'Calcium (mg)' },
        { key: 'iron_mg', label: 'Iron (mg)' },
        { key: 'magnesium_mg', label: 'Magnesium (mg)' },
        { key: 'phosphorus_mg', label: 'Phosphorus (mg)' },
        { key: 'potassium_mg', label: 'Potassium (mg)' },
        { key: 'zinc_mg', label: 'Zinc (mg)' },
        { key: 'selenium_ug', label: 'Selenium (mcg)' }
      ],
      form: this.makeBlankForm()
    };
  },
  computed: {
    isEditing() {
      return !!this.editing;
    },
    mergedSuggestions() {
      // Offline matches first (they're instant and reliable), then USDA
      // results deduped by name.
      const offline = this.ingredientSuggestions.map(e => ({ ...e, source: e.source || 'offline' }));
      const offlineNames = new Set(offline.map(e => (e.name || '').toLowerCase()));
      const online = this.usdaSuggestions.filter(e => !offlineNames.has((e.name || '').toLowerCase()));
      return offline.concat(online);
    },
    formTitle() {
      return this.isEditing ? 'Edit Recipe' : 'New Custom Recipe';
    },
    canSave() {
      const f = this.form;
      return f.name.trim().length > 0 &&
             f.category &&
             f.calories > 0 &&
             f.ingredients.length > 0;
    },
    computedCaloriesFromMacros() {
      const f = this.form;
      return Math.round(
        (Number(f.protein) || 0) * 4 +
        (Number(f.carbs) || 0) * 4 +
        (Number(f.fat) || 0) * 9
      );
    }
  },
  watch: {
    editing: {
      immediate: true,
      handler(val) {
        if (val) {
          this.form = this.cloneForm(val);
          this.showMicros = this.hasAnyMicros(val.micros);
        } else {
          this.form = this.makeBlankForm();
        }
      }
    }
  },
  created() {
    this.usingDemoKey = window.USDAClient
      ? window.USDAClient.isUsingDemoKey()
      : false;
  },
  methods: {
    makeBlankForm() {
      return {
        id: null,
        name: '',
        category: 'lunch',
        cuisine: 'american',
        description: '',
        servings: 1,
        prepTime: 5,
        cookTime: 10,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        ingredients: [],
        tags: [],
        allergens: [],
        micros: {}
      };
    },
    cloneForm(recipe) {
      const blank = this.makeBlankForm();
      const merged = Object.assign(blank, JSON.parse(JSON.stringify(recipe)));
      if (!merged.micros) merged.micros = {};
      return merged;
    },
    hasAnyMicros(micros) {
      if (!micros) return false;
      return Object.keys(micros).some(k => micros[k] != null && micros[k] !== '');
    },
    toggleArrayItem(arr, value) {
      const i = arr.indexOf(value);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(value);
    },
    toggleTag(v) { this.toggleArrayItem(this.form.tags, v); },
    toggleAllergen(v) { this.toggleArrayItem(this.form.allergens, v); },
    onItemInput() {
      // Live suggestions as the user types.
      const q = this.newIngredientItem.trim();
      if (q.length < 2) {
        this.ingredientSuggestions = [];
        this.usdaSuggestions = [];
        this.showSuggestions = false;
        this.usdaError = '';
        return;
      }
      this.ingredientSuggestions = window.IngredientLookup.searchIngredients(q, 5);
      this.showSuggestions =
        this.ingredientSuggestions.length > 0 || this.usdaSuggestions.length > 0 ||
        this.usdaSearching || !!this.usdaError;

      // Debounced USDA search. USDA results complement the offline ones
      // when the local table doesn't have a good match.
      if (this.usdaDebounceTimer) clearTimeout(this.usdaDebounceTimer);
      this.usdaDebounceTimer = setTimeout(() => this.fetchUsdaSuggestions(q), 500);
    },
    async fetchUsdaSuggestions(query) {
      if (!window.USDAClient) return;
      // Skip API call if the offline table already covers this well.
      const localBest = this.ingredientSuggestions[0];
      const localScore = localBest
        ? window.IngredientLookup.normalize(localBest.name) === window.IngredientLookup.normalize(query)
        : false;
      if (localScore && this.ingredientSuggestions.length >= 2) {
        this.usdaSuggestions = [];
        return;
      }

      this.usdaSearching = true;
      this.usdaError = '';
      try {
        const results = await window.USDAClient.searchFoods(query, 8);
        // Ignore stale responses: only apply if the input still matches.
        if (this.newIngredientItem.trim() !== query) return;
        this.usdaSuggestions = results.map(r => ({ ...r, source: 'usda' }));
        this.usdaStatus = window.USDAClient.getSearchStatus
          ? window.USDAClient.getSearchStatus()
          : null;
      } catch (e) {
        if (this.newIngredientItem.trim() !== query) return;
        this.usdaError = e.message || 'USDA lookup failed.';
        this.usdaStatus = window.USDAClient.getSearchStatus
          ? window.USDAClient.getSearchStatus()
          : null;
        this.usdaSuggestions = [];
      } finally {
        this.usdaSearching = false;
        this.showSuggestions =
          this.ingredientSuggestions.length > 0 || this.usdaSuggestions.length > 0 ||
          this.usdaSearching || !!this.usdaError;
      }
    },
    usdaStatusClass() {
      if (!this.usdaStatus) return '';
      if (this.usdaStatus.kind === 'rate-limited') return 'alert-warning';
      if (this.usdaStatus.kind === 'error') return 'alert-error';
      return 'alert-info';
    },
    usdaStatusMessage() {
      if (!this.usdaStatus || !this.usdaStatus.message) return '';
      return this.usdaStatus.message;
    },
    chooseSuggestion(entry) {
      this.newIngredientItem = entry.name;
      this.ingredientSuggestions = [];
      this.usdaSuggestions = [];
      this.showSuggestions = false;
      // Remember the entry so addIngredient can attach macros/micros
      // without re-searching.
      this._pendingEntry = entry;
      // Default the unit if none chosen.
      if (!this.newIngredientUnit) {
        this.newIngredientUnit = entry.unit === 'ml' ? 'ml' : 'g';
      }
      this.previewNutrition();
    },
    entryForItem(item) {
      // Prefer a pending chosen entry, else search offline, else search
      // cached USDA results for the current input.
      if (this._pendingEntry && this._pendingEntry.name === item) {
        return this._pendingEntry;
      }
      const local = window.IngredientLookup.searchIngredients(item, 1);
      if (local.length) return local[0];
      const usda = this.usdaSuggestions.find(e => e.name === item);
      return usda || null;
    },
    previewNutrition() {
      // Try to match the current item and show nutrition for the entered amount.
      const item = this.newIngredientItem.trim();
      if (!item) { this.ingredientNutritionPreview = null; return; }
      const entry = this.entryForItem(item);
      if (!entry) { this.ingredientNutritionPreview = null; return; }
      const amount = Number(this.newIngredientAmount) || 1;
      const unit = this.newIngredientUnit || (entry.unit === 'ml' ? 'ml' : 'g');
      const n = window.IngredientLookup.nutritionForAmount(entry, amount, unit);
      this.ingredientNutritionPreview = n ? { entry, n } : null;
    },
    addIngredient() {
      const item = this.newIngredientItem.trim();
      const amountStr = this.newIngredientAmount.toString().trim();
      const unit = this.newIngredientUnit.trim();
      if (!item) return;

      // Prefer the entry the user explicitly picked from the dropdown;
      // otherwise fall back to the best match (offline first, then USDA).
      const match = this.entryForItem(item) ||
        window.IngredientLookup.searchIngredients(item, 1)[0] ||
        null;

      // Compose a display amount string. If a unit is chosen, prefer
      // "<amount> <unit>"; else use the raw typed amount.
      const amount = unit ? (amountStr + ' ' + unit) : amountStr;

      // Snapshot the nutrition-relevant fields off the entry so downstream
      // math doesn't need to re-search. This lets USDA-sourced ingredients
      // carry their per100 + micros with them.
      const snapshot = match ? {
        entryId: match.id,
        entryName: match.name,
        source: match.source || 'offline',
        fdcId: match.fdcId || null,
        unitBase: match.unit || 'g',
        per100: match.per100 ? { ...match.per100 } : null,
        micros: match.micros ? { ...match.micros } : null
      } : null;

      this.form.ingredients.push(Object.assign({
        item,
        amount,
        amountValue: amountStr === '' ? '' : Number(amountStr),
        unit,
        matched: !!match
      }, snapshot || {}));

      this.newIngredientItem = '';
      this.newIngredientAmount = '';
      this.newIngredientUnit = '';
      this.ingredientSuggestions = [];
      this.usdaSuggestions = [];
      this.showSuggestions = false;
      this.ingredientNutritionPreview = null;
      this._pendingEntry = null;
    },
    computeFromIngredients() {
      // Sum macros from matched ingredients and divide by servings.
      // Uses the per100 snapshot stored on each ingredient, which works
      // for both offline and USDA-sourced entries.
      const matched = this.form.ingredients.filter(i => i.matched && i.per100);
      if (matched.length === 0) return;

      const servings = Number(this.form.servings) || 1;
      let cal = 0, pro = 0, carb = 0, fat = 0, fib = 0, sod = 0;

      for (const ing of matched) {
        const entry = {
          id: ing.entryId,
          name: ing.entryName,
          unit: ing.unitBase || 'g',
          per100: ing.per100
        };
        const n = window.IngredientLookup.nutritionForAmount(
          entry,
          Number(ing.amountValue) || 1,
          ing.unit || (entry.unit === 'ml' ? 'ml' : 'g')
        );
        if (!n) continue;
        cal  += n.calories;
        pro  += n.protein;
        carb += n.carbs;
        fat  += n.fat;
        fib  += n.fiber;
        sod  += n.sodium;
      }

      this.form.calories = Math.round(cal / servings);
      this.form.protein  = Math.round(pro / servings);
      this.form.carbs    = Math.round(carb / servings);
      this.form.fat      = Math.round(fat / servings);
      this.form.fiber    = Math.round(fib / servings);
      this.form.sodium   = Math.round(sod / servings);
    },
    matchedCount() {
      return this.form.ingredients.filter(i => i.matched).length;
    },
    removeIngredient(index) {
      this.form.ingredients.splice(index, 1);
    },
    useMacrosForCalories() {
      this.form.calories = this.computedCaloriesFromMacros;
    },
    save() {
      if (!this.canSave) return;
      const payload = JSON.parse(JSON.stringify(this.form));
      if (!payload.id) payload.id = window.RecipeStorage.generateRecipeId();
      // Clean up empty micro values so they don't clutter the dataset.
      if (payload.micros) {
        const cleaned = {};
        for (const [k, v] of Object.entries(payload.micros)) {
          if (v !== '' && v != null && !isNaN(v)) cleaned[k] = Number(v);
        }
        payload.micros = cleaned;
      }
      this.$emit('save', payload);
    },
    cancel() {
      this.$emit('cancel');
    }
  },
  template: `
    <form class="card" @submit.prevent="save" novalidate>
      <h2 class="card-header">{{ formTitle }}</h2>

      <div
        v-if="usingDemoKey"
        class="alert alert-info"
        role="status"
        style="font-size: 0.875rem;">
        Using the USDA <strong>DEMO_KEY</strong> (30 lookups/hour). Online ingredient search
        works out of the box, but for heavier use you&rsquo;ll want to
        <a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" rel="noopener">get a free API key</a>.
        Your key can be saved to <code>localStorage['meal-planner.usda-key']</code>.
      </div>

      <div class="grid-2">
        <div class="form-group">
          <label class="form-label" for="cr-name">Recipe name *</label>
          <input id="cr-name" class="form-input" type="text" v-model="form.name" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="cr-category">Category *</label>
          <select id="cr-category" class="form-select" v-model="form.category">
            <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="cr-desc">Description</label>
        <textarea id="cr-desc" class="form-input" rows="2" v-model="form.description"></textarea>
      </div>

      <div class="grid-3">
        <div class="form-group">
          <label class="form-label" for="cr-cuisine">Cuisine</label>
          <select id="cr-cuisine" class="form-select" v-model="form.cuisine">
            <option v-for="c in cuisineOptions" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="cr-prep">Prep time (min)</label>
          <input id="cr-prep" class="form-input" type="number" min="0" v-model.number="form.prepTime">
        </div>
        <div class="form-group">
          <label class="form-label" for="cr-cook">Cook time (min)</label>
          <input id="cr-cook" class="form-input" type="number" min="0" v-model.number="form.cookTime">
        </div>
      </div>

      <fieldset class="form-group">
        <legend class="form-label">Ingredients *</legend>
        <p class="form-hint">
          Add each ingredient with a quantity and unit. Type the ingredient name
          and pick a match to enable nutrition auto-fill.
        </p>

        <div v-if="form.ingredients.length" style="margin-bottom: 0.75rem;">
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li
              v-for="(ing, i) in form.ingredients"
              :key="i"
              style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid var(--color-base-light); gap: 0.5rem;">
              <span>
                <strong>{{ ing.amount || '(no amount)' }}</strong> {{ ing.item }}
                <span
                  v-if="ing.matched"
                  class="nutrition-badge"
                  style="font-size: 0.7rem; background: var(--color-primary-light); margin-left: 0.5rem;"
                  title="Matched to nutrition database">
                  matched
                </span>
              </span>
              <button type="button" class="btn btn-secondary btn-small" @click="removeIngredient(i)"
                      :aria-label="'Remove ' + ing.item">Remove</button>
            </li>
          </ul>

          <div style="margin-top: 0.75rem; padding: 0.75rem; background: var(--color-base-lightest); border-radius: 4px;">
            <div style="font-size: 0.875rem; color: var(--color-base-dark);">
              <strong>{{ matchedCount() }}</strong> of
              <strong>{{ form.ingredients.length }}</strong> ingredients matched to the nutrition database.
            </div>
            <div
              v-if="matchedCount() > 0"
              style="margin-top: 0.5rem;">
              <button
                type="button"
                class="btn btn-secondary btn-small"
                @click="computeFromIngredients">
                Auto-fill macros from matched ingredients
              </button>
              <span style="margin-left: 0.5rem; font-size: 0.75rem; color: var(--color-base);">
                (divides by {{ form.servings }} serving{{ form.servings === 1 ? '' : 's' }})
              </span>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end;">
          <div style="flex: 0 0 90px;">
            <label class="form-label" for="cr-ing-amount" style="font-size: 0.875rem;">Qty</label>
            <input
              id="cr-ing-amount"
              class="form-input"
              type="text"
              inputmode="decimal"
              v-model="newIngredientAmount"
              placeholder="1"
              @input="previewNutrition">
          </div>
          <div style="flex: 0 0 110px;">
            <label class="form-label" for="cr-ing-unit" style="font-size: 0.875rem;">Unit</label>
            <select
              id="cr-ing-unit"
              class="form-select"
              v-model="newIngredientUnit"
              @change="previewNutrition">
              <option value="">(none)</option>
              <option v-for="u in unitOptions" :key="u" :value="u">{{ u }}</option>
            </select>
          </div>
          <div style="flex: 2 1 220px; position: relative;">
            <label class="form-label" for="cr-ing-item" style="font-size: 0.875rem;">Ingredient</label>
            <input
              id="cr-ing-item"
              class="form-input"
              type="text"
              v-model="newIngredientItem"
              placeholder="start typing, e.g. rolled oats"
              autocomplete="off"
              @input="onItemInput"
              @keydown.enter.prevent="addIngredient">

            <ul
              v-if="showSuggestions"
              role="listbox"
              style="position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
                     background: white; border: 1px solid var(--color-base-light);
                     border-radius: 4px; margin: 0.25rem 0 0 0; padding: 0;
                     list-style: none; box-shadow: var(--shadow-md); max-height: 280px; overflow-y: auto;">
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
              <li
                v-if="usdaSearching"
                style="padding: 0.5rem 0.75rem; color: var(--color-base); font-size: 0.875rem;">
                Searching USDA&hellip;
              </li>
              <li
                v-if="usdaError && !usdaSearching"
                style="padding: 0.5rem 0.75rem; color: var(--color-error); font-size: 0.8rem;">
                {{ usdaError }}
              </li>
              <li
                v-if="!usdaSearching && !usdaError && mergedSuggestions.length === 0"
                style="padding: 0.5rem 0.75rem; color: var(--color-base); font-size: 0.875rem;">
                No matches.
              </li>
            </ul>
          </div>
          <button type="button" class="btn btn-secondary" @click="addIngredient">Add</button>
        </div>

        <div
          v-if="ingredientNutritionPreview"
          class="alert alert-info"
          role="status"
          style="margin-top: 0.75rem; font-size: 0.875rem;">
          <strong>{{ ingredientNutritionPreview.entry.name }}</strong> at
          {{ ingredientNutritionPreview.n.baseAmount }}{{ ingredientNutritionPreview.n.base }}:
          {{ ingredientNutritionPreview.n.calories }} kcal,
          P {{ ingredientNutritionPreview.n.protein }}g,
          C {{ ingredientNutritionPreview.n.carbs }}g,
          F {{ ingredientNutritionPreview.n.fat }}g
        </div>

        <div
          v-if="usdaStatusMessage"
          class="alert"
          :class="usdaStatusClass"
          role="status"
          style="margin-top: 0.75rem; font-size: 0.8rem;">
          {{ usdaStatusMessage }}
        </div>
      </fieldset>

      <fieldset class="form-group">
        <legend class="form-label">Nutrition per serving *</legend>
        <p class="form-hint">Enter calories and macros. Click "Use macros" to compute calories from 4/4/9 rule.</p>

        <div class="grid-3">
          <div>
            <label class="form-label" for="cr-cal">Calories *</label>
            <input id="cr-cal" class="form-input" type="number" min="0" v-model.number="form.calories">
          </div>
          <div>
            <label class="form-label" for="cr-protein">Protein (g)</label>
            <input id="cr-protein" class="form-input" type="number" min="0" v-model.number="form.protein">
          </div>
          <div>
            <label class="form-label" for="cr-carbs">Carbs (g)</label>
            <input id="cr-carbs" class="form-input" type="number" min="0" v-model.number="form.carbs">
          </div>
          <div>
            <label class="form-label" for="cr-fat">Fat (g)</label>
            <input id="cr-fat" class="form-input" type="number" min="0" v-model.number="form.fat">
          </div>
          <div>
            <label class="form-label" for="cr-fiber">Fiber (g)</label>
            <input id="cr-fiber" class="form-input" type="number" min="0" v-model.number="form.fiber">
          </div>
          <div>
            <label class="form-label" for="cr-sugar">Sugar (g)</label>
            <input id="cr-sugar" class="form-input" type="number" min="0" v-model.number="form.sugar">
          </div>
        </div>

        <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-small" @click="useMacrosForCalories">
            Use macros ({{ computedCaloriesFromMacros }} kcal)
          </button>
          <span style="font-size: 0.875rem; color: var(--color-base);">
            Current entry: {{ form.calories }} kcal
          </span>
        </div>

        <div style="margin-top: 0.75rem;">
          <label class="form-label" for="cr-sodium">Sodium (mg)</label>
          <input id="cr-sodium" class="form-input" type="number" min="0" v-model.number="form.sodium"
                 style="max-width: 200px;">
        </div>
      </fieldset>

      <fieldset class="form-group">
        <legend class="form-label">Dietary tags</legend>
        <span class="form-hint">Select all that apply. The planner uses these to match your restrictions.</span>
        <div class="checkbox-group">
          <div class="checkbox-item" v-for="t in tagOptions" :key="t">
            <input
              type="checkbox"
              :id="'cr-tag-' + t"
              :checked="form.tags.includes(t)"
              @change="toggleTag(t)">
            <label :for="'cr-tag-' + t">{{ t }}</label>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-group">
        <legend class="form-label">Contains allergens</legend>
        <span class="form-hint">The planner will exclude this recipe if the user is avoiding any of these.</span>
        <div class="checkbox-group">
          <div class="checkbox-item" v-for="a in allergenOptions" :key="a">
            <input
              type="checkbox"
              :id="'cr-allergen-' + a"
              :checked="form.allergens.includes(a)"
              @change="toggleAllergen(a)">
            <label :for="'cr-allergen-' + a">{{ a }}</label>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-group">
        <legend class="form-label">
          <button
            type="button"
            class="btn btn-secondary btn-small"
            @click="showMicros = !showMicros"
            :aria-expanded="showMicros">
            {{ showMicros ? 'Hide' : 'Show' }} micronutrients (optional)
          </button>
        </legend>
        <p class="form-hint">
          Optional. Fill in what you know. These will feed into micronutrient tracking later.
        </p>

        <div v-if="showMicros" class="grid-3" style="margin-top: 0.5rem;">
          <div v-for="m in microFields" :key="m.key" class="form-group">
            <label class="form-label" :for="'cr-micro-' + m.key" style="font-size: 0.875rem;">
              {{ m.label }}
            </label>
            <input
              :id="'cr-micro-' + m.key"
              class="form-input"
              type="number"
              min="0"
              step="0.01"
              v-model.number="form.micros[m.key]">
          </div>
        </div>
      </fieldset>

      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button type="submit" class="btn btn-primary" :disabled="!canSave">
          {{ isEditing ? 'Save changes' : 'Save recipe' }}
        </button>
        <button type="button" class="btn btn-secondary" @click="cancel">Cancel</button>
      </div>

      <div v-if="!canSave" class="alert alert-info" role="status" style="margin-top: 1rem;">
        Name, category, calories, and at least one ingredient are required.
      </div>
    </form>
  `
};

if (typeof window !== 'undefined') {
  window.CustomRecipeForm = CustomRecipeForm;
}