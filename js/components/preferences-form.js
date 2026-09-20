/**
 * PreferencesForm component
 * Collects: dietary restrictions, allergens, calorie/macro targets,
 * meals per day, snacks, and preferred cuisines.
 */
const PreferencesForm = {
  name: 'PreferencesForm',
  props: {
    initial: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['submit'],
  data() {
    const defaults = {
      dietTags: [],
      excludeAllergens: [],
      calories: 2000,
      macroSplit: { protein: 30, carbs: 40, fat: 30 },
      meals: ['breakfast', 'lunch', 'dinner'],
      snacksPerDay: 1,
      cuisines: []
    };
    return {
      form: Object.assign({}, defaults, this.initial),
      dietOptions: [
        { value: 'vegetarian', label: 'Vegetarian' },
        { value: 'vegan', label: 'Vegan' },
        { value: 'gluten-free', label: 'Gluten-free' },
        { value: 'dairy-free', label: 'Dairy-free' },
        { value: 'nut-free', label: 'Nut-free' },
        { value: 'soy-free', label: 'Soy-free' },
        { value: 'high-protein', label: 'High-protein focus' }
      ],
      allergenOptions: [
        { value: 'dairy', label: 'Dairy' },
        { value: 'gluten', label: 'Gluten' },
        { value: 'egg', label: 'Egg' },
        { value: 'tree nuts', label: 'Tree nuts' },
        { value: 'peanut', label: 'Peanuts' },
        { value: 'soy', label: 'Soy' },
        { value: 'fish', label: 'Fish' },
        { value: 'shellfish', label: 'Shellfish' },
        { value: 'sesame', label: 'Sesame' }
      ],
      mealOptions: [
        { value: 'breakfast', label: 'Breakfast' },
        { value: 'lunch', label: 'Lunch' },
        { value: 'dinner', label: 'Dinner' }
      ],
      cuisineOptions: [
        { value: 'american', label: 'American' },
        { value: 'mediterranean', label: 'Mediterranean' },
        { value: 'asian', label: 'Asian' },
        { value: 'mexican', label: 'Mexican' },
        { value: 'italian', label: 'Italian' },
        { value: 'indian', label: 'Indian' }
      ],
      splitPresets: [
        { name: 'Balanced', split: { protein: 30, carbs: 40, fat: 30 } },
        { name: 'Low-carb', split: { protein: 35, carbs: 25, fat: 40 } },
        { name: 'High-protein', split: { protein: 40, carbs: 35, fat: 25 } },
        { name: 'Endurance', split: { protein: 20, carbs: 55, fat: 25 } }
      ]
    };
  },
  computed: {
    splitTotal() {
      const s = this.form.macroSplit;
      return (Number(s.protein) || 0) + (Number(s.carbs) || 0) + (Number(s.fat) || 0);
    },
    splitValid() {
      return this.splitTotal === 100;
    },
    computedMacros() {
      return Nutrition.calculateMacroTargets(this.form.calories, this.form.macroSplit);
    },
    canSubmit() {
      return this.form.calories >= 800 &&
             this.form.calories <= 6000 &&
             this.splitValid &&
             this.form.meals.length > 0;
    }
  },
  methods: {
    applyPreset(preset) {
      this.form.macroSplit = { ...preset.split };
    },
    toggleArrayItem(arr, value) {
      const i = arr.indexOf(value);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(value);
    },
    onDietToggle(value) {
      this.toggleArrayItem(this.form.dietTags, value);
    },
    onAllergenToggle(value) {
      this.toggleArrayItem(this.form.excludeAllergens, value);
    },
    onMealToggle(value) {
      this.toggleArrayItem(this.form.meals, value);
    },
    onCuisineToggle(value) {
      this.toggleArrayItem(this.form.cuisines, value);
    },
    reset() {
      this.form = {
        dietTags: [],
        excludeAllergens: [],
        calories: 2000,
        macroSplit: { protein: 30, carbs: 40, fat: 30 },
        meals: ['breakfast', 'lunch', 'dinner'],
        snacksPerDay: 1,
        cuisines: []
      };
    },
    submit() {
      if (!this.canSubmit) return;
      this.$emit('submit', JSON.parse(JSON.stringify(this.form)));
    }
  },
  template: `
    <form class="card" @submit.prevent="submit" novalidate>
      <h2 class="card-header">Your Preferences</h2>

      <fieldset class="form-group">
        <legend class="form-label">Dietary restrictions</legend>
        <span class="form-hint">Select all that apply. Recipes must match every selected restriction.</span>
        <div class="checkbox-group">
          <div class="checkbox-item" v-for="opt in dietOptions" :key="opt.value">
            <input
              type="checkbox"
              :id="'diet-' + opt.value"
              :value="opt.value"
              :checked="form.dietTags.includes(opt.value)"
              @change="onDietToggle(opt.value)">
            <label :for="'diet-' + opt.value">{{ opt.label }}</label>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-group">
        <legend class="form-label">Allergies to exclude</legend>
        <span class="form-hint">Recipes containing any of these allergens will be skipped.</span>
        <div class="checkbox-group">
          <div class="checkbox-item" v-for="opt in allergenOptions" :key="opt.value">
            <input
              type="checkbox"
              :id="'allergen-' + opt.value"
              :value="opt.value"
              :checked="form.excludeAllergens.includes(opt.value)"
              @change="onAllergenToggle(opt.value)">
            <label :for="'allergen-' + opt.value">{{ opt.label }}</label>
          </div>
        </div>
      </fieldset>

      <div class="grid-2">
        <div class="form-group">
          <label class="form-label" for="calories-input">Daily calorie target</label>
          <span class="form-hint" id="calories-hint">Between 800 and 6000 kcal</span>
          <input
            id="calories-input"
            class="form-input"
            type="number"
            min="800"
            max="6000"
            step="50"
            v-model.number="form.calories"
            aria-describedby="calories-hint">
        </div>

        <div class="form-group">
          <label class="form-label" for="snacks-input">Snacks per day</label>
          <span class="form-hint" id="snacks-hint">0 to 3 additional snack slots</span>
          <input
            id="snacks-input"
            class="form-input"
            type="number"
            min="0"
            max="3"
            step="1"
            v-model.number="form.snacksPerDay"
            aria-describedby="snacks-hint">
        </div>
      </div>

      <fieldset class="form-group">
        <legend class="form-label">Macronutrient split</legend>
        <span class="form-hint">
          Percentages must total 100. Currently: {{ splitTotal }}%.
        </span>

        <div class="checkbox-group" style="margin-bottom: 1rem;">
          <button
            type="button"
            class="btn btn-secondary btn-small"
            v-for="preset in splitPresets"
            :key="preset.name"
            @click="applyPreset(preset)">
            {{ preset.name }}
          </button>
        </div>

        <div class="grid-3">
          <div>
            <label class="form-label" for="split-protein">Protein %</label>
            <input
              id="split-protein"
              class="form-input"
              type="number"
              min="0" max="100" step="1"
              v-model.number="form.macroSplit.protein">
          </div>
          <div>
            <label class="form-label" for="split-carbs">Carbs %</label>
            <input
              id="split-carbs"
              class="form-input"
              type="number"
              min="0" max="100" step="1"
              v-model.number="form.macroSplit.carbs">
          </div>
          <div>
            <label class="form-label" for="split-fat">Fat %</label>
            <input
              id="split-fat"
              class="form-input"
              type="number"
              min="0" max="100" step="1"
              v-model.number="form.macroSplit.fat">
          </div>
        </div>

        <div
          class="alert"
          :class="splitValid ? 'alert-info' : 'alert-error'"
          role="status"
          style="margin-top: 1rem;">
          <strong>Daily macro targets:</strong>
          {{ computedMacros.protein }}g protein,
          {{ computedMacros.carbs }}g carbs,
          {{ computedMacros.fat }}g fat
        </div>
      </fieldset>

      <fieldset class="form-group">
        <legend class="form-label">Meals to include</legend>
        <div class="checkbox-group">
          <div class="checkbox-item" v-for="opt in mealOptions" :key="opt.value">
            <input
              type="checkbox"
              :id="'meal-' + opt.value"
              :value="opt.value"
              :checked="form.meals.includes(opt.value)"
              @change="onMealToggle(opt.value)">
            <label :for="'meal-' + opt.value">{{ opt.label }}</label>
          </div>
        </div>
      </fieldset>

      <fieldset class="form-group">
        <legend class="form-label">Preferred cuisines (optional)</legend>
        <span class="form-hint">Recipes from selected cuisines will be favored.</span>
        <div class="checkbox-group">
          <div class="checkbox-item" v-for="opt in cuisineOptions" :key="opt.value">
            <input
              type="checkbox"
              :id="'cuisine-' + opt.value"
              :value="opt.value"
              :checked="form.cuisines.includes(opt.value)"
              @change="onCuisineToggle(opt.value)">
            <label :for="'cuisine-' + opt.value">{{ opt.label }}</label>
          </div>
        </div>
      </fieldset>

      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button type="submit" class="btn btn-primary" :disabled="!canSubmit">
          Generate Menu
        </button>
        <button type="button" class="btn btn-secondary" @click="reset">
          Reset
        </button>
      </div>

      <div v-if="!splitValid" class="alert alert-error" role="alert" style="margin-top: 1rem;">
        Macro percentages must add up to 100. Currently {{ splitTotal }}.
      </div>
    </form>
  `
};

if (typeof window !== 'undefined') {
  window.PreferencesForm = PreferencesForm;
}