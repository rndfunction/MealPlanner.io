/**
 * Meal Planner - Main application
 * Orchestrates the preferences form, menu generation, and results display.
 */

const { createApp } = Vue;

const App = {
  name: 'App',
  components: {
    PreferencesForm: window.PreferencesForm,
    MenuDisplay: window.MenuDisplay,
    NutritionSummary: window.NutritionSummary,
    ShoppingList: window.ShoppingList
  },
  data() {
    return {
      appReady: false,
      stage: 'preferences', // 'preferences' | 'menu'
      preferences: null,
      dayResult: null,
      lastError: ''
    };
  },
  computed: {
    targets() {
      if (!this.preferences) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
      const macros = Nutrition.calculateMacroTargets(
        this.preferences.calories,
        this.preferences.macroSplit
      );
      return {
        calories: this.preferences.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat
      };
    },
    entries() {
      return this.dayResult ? this.dayResult.entries : [];
    }
  },
  methods: {
    handleSubmit(prefs) {
      this.preferences = prefs;
      this.lastError = '';
      const result = MenuGenerator.generateDay({
        recipes: window.RECIPES,
        meals: prefs.meals,
        snacksPerDay: prefs.snacksPerDay,
        targets: {
          calories: prefs.calories,
          protein: Nutrition.calculateMacroTargets(prefs.calories, prefs.macroSplit).protein,
          carbs: Nutrition.calculateMacroTargets(prefs.calories, prefs.macroSplit).carbs,
          fat: Nutrition.calculateMacroTargets(prefs.calories, prefs.macroSplit).fat
        },
        dietTags: prefs.dietTags,
        excludeAllergens: prefs.excludeAllergens,
        cuisines: prefs.cuisines
      });

      if (result.poolEmpty || result.entries.length === 0) {
        this.lastError = 'No recipes matched your restrictions. Try relaxing filters.';
        this.dayResult = result;
        this.stage = 'menu';
        return;
      }
      this.dayResult = result;
      this.stage = 'menu';
    },
    handleReroll(index) {
      if (!this.dayResult || !this.preferences) return;
      const next = MenuGenerator.regenerateSlot(
        {
          recipes: window.RECIPES,
          targets: {
            calories: this.preferences.calories,
            protein: Nutrition.calculateMacroTargets(this.preferences.calories, this.preferences.macroSplit).protein,
            carbs: Nutrition.calculateMacroTargets(this.preferences.calories, this.preferences.macroSplit).carbs,
            fat: Nutrition.calculateMacroTargets(this.preferences.calories, this.preferences.macroSplit).fat
          },
          dietTags: this.preferences.dietTags,
          excludeAllergens: this.preferences.excludeAllergens,
          cuisines: this.preferences.cuisines
        },
        this.dayResult.entries,
        index
      );
      // Recompute totals
      const totals = Nutrition.sumNutrition(next);
      this.dayResult = {
        entries: next,
        totals,
        remaining: {
          calories: this.preferences.calories - totals.calories,
          protein: this.targets.protein - totals.protein,
          carbs: this.targets.carbs - totals.carbs,
          fat: this.targets.fat - totals.fat
        }
      };
    },
    startOver() {
      this.stage = 'preferences';
      this.dayResult = null;
      this.lastError = '';
    },
    editPreferences() {
      this.stage = 'preferences';
    }
  },
  mounted() {
    this.appReady = true;
  },
  template: `
    <div>
      <!-- Preferences stage -->
      <div v-if="stage === 'preferences'">
        <preferences-form
          :initial="preferences || {}"
          @submit="handleSubmit">
        </preferences-form>
      </div>

      <!-- Menu stage -->
      <div v-else-if="stage === 'menu'">
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-small" @click="editPreferences">
            Edit preferences
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="startOver">
            Start over
          </button>
        </div>

        <div v-if="lastError" class="alert alert-warning" role="alert">
          {{ lastError }}
        </div>

        <div v-if="entries.length > 0">
          <div class="grid-2" style="align-items: start;">
            <div>
              <menu-display
                :entries="entries"
                :targets="targets"
                @reroll="handleReroll">
              </menu-display>
            </div>
            <div>
              <nutrition-summary
                :totals="dayResult.totals"
                :targets="targets">
              </nutrition-summary>
            </div>
          </div>

          <shopping-list :entries="entries"></shopping-list>
        </div>
      </div>
    </div>
  `
};

// Mount
const app = createApp(App);
app.mount('#app');