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
    ShoppingList: window.ShoppingList,
    RecipeManager: window.RecipeManager,
    SettingsPanel: window.SettingsPanel,
    RecipePickerModal: window.RecipePickerModal,
    LogFoodModal: window.LogFoodModal
  },
  data() {
    return {
      appReady: false,
      view: 'planner', // 'planner' | 'recipes'
      stage: 'preferences', // 'preferences' | 'menu'
      preferences: null,
      dayResult: null,
      lastError: '',
      recipePoolVersion: 0,
      showSettings: false,
      pickerIndex: null,
      logIndex: null
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
    },
    recipePool() {
      // Reference recipePoolVersion so this recomputes when customs change.
      // eslint-disable-next-line no-unused-expressions
      this.recipePoolVersion;
      return window.RecipeStorage
        ? window.RecipeStorage.getFullRecipePool()
        : (window.RECIPES || []);
    }
  },
  template: `
    <div>
      <!-- Top-level tabs -->
      <nav aria-label="Main sections" style="margin-bottom: 1.5rem;">
        <div role="tablist" style="display: flex; gap: 0.25rem; border-bottom: 2px solid var(--color-base-light); align-items: flex-end; flex-wrap: wrap;">
          <button
            role="tab"
            type="button"
            class="btn"
            :aria-selected="view === 'planner'"
            :style="tabStyle('planner')"
            @click="view = 'planner'">
            Planner
          </button>
          <button
            role="tab"
            type="button"
            class="btn"
            :aria-selected="view === 'recipes'"
            :style="tabStyle('recipes')"
            @click="view = 'recipes'">
            My Recipes
          </button>
          <div style="flex: 1;"></div>
          <button
            type="button"
            class="btn btn-secondary btn-small"
            style="margin-bottom: 0.25rem;"
            :aria-expanded="showSettings"
            @click="showSettings = !showSettings">
            {{ showSettings ? 'Hide settings' : 'Settings' }}
          </button>
        </div>
      </nav>

      <!-- Settings panel (collapsible) -->
      <div v-if="showSettings" style="margin-bottom: 1.5rem;">
        <settings-panel @close="showSettings = false"></settings-panel>
      </div>

      <!-- Recipes view -->
      <div v-if="view === 'recipes'">
        <recipe-manager @recipes-changed="onRecipesChanged"></recipe-manager>
      </div>

      <!-- Planner view -->
      <div v-else>
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
                @reroll="handleReroll"
                @pick-recipe="openPickRecipe"
                @log-food="openLogFood"
                @clear-slot="clearSlot">
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

      <!-- Modals -->
      <recipe-picker-modal
        v-if="pickerIndex !== null"
        :recipes="recipePool"
        :filters="pickerFilters"
        :slot-label="slotLabelForIndex(pickerIndex)"
        @pick="onRecipePicked"
        @cancel="closePickRecipe">
      </recipe-picker-modal>

      <log-food-modal
        v-if="logIndex !== null"
        :slot-label="slotLabelForIndex(logIndex)"
        :initial="logInitialForSlot()"
        @save="onLoggedSaved"
        @cancel="closeLogFood">
      </log-food-modal>
    </div>
  `,
  methods: {
    handleSubmit(prefs) {
      this.preferences = prefs;
      this.lastError = '';
      const macros = Nutrition.calculateMacroTargets(prefs.calories, prefs.macroSplit);
      const result = MenuGenerator.generateDay({
        recipes: this.recipePool,
        meals: prefs.meals,
        snacksPerDay: prefs.snacksPerDay,
        targets: {
          calories: prefs.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat
        },
        dietTags: prefs.dietTags,
        excludeAllergens: prefs.excludeAllergens,
        cuisines: prefs.cuisines
      });

      if (result.poolEmpty || result.entries.length === 0) {
        this.lastError = 'No recipes matched your restrictions. Try relaxing filters or adding custom recipes.';
        this.dayResult = result;
        this.stage = 'menu';
        return;
      }
      this.dayResult = result;
      this.stage = 'menu';
    },
    handleReroll(index) {
      if (!this.dayResult || !this.preferences) return;
      const macros = Nutrition.calculateMacroTargets(this.preferences.calories, this.preferences.macroSplit);
      const next = MenuGenerator.regenerateSlot(
        {
          recipes: this.recipePool,
          targets: {
            calories: this.preferences.calories,
            protein: macros.protein,
            carbs: macros.carbs,
            fat: macros.fat
          },
          dietTags: this.preferences.dietTags,
          excludeAllergens: this.preferences.excludeAllergens,
          cuisines: this.preferences.cuisines
        },
        this.dayResult.entries,
        index
      );
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
    tabStyle(name) {
      const active = this.view === name;
      return {
        background: active ? 'var(--color-primary)' : 'transparent',
        color: active ? 'white' : 'var(--color-primary)',
        border: '2px solid var(--color-primary)',
        borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
        borderRadius: '4px 4px 0 0'
      };
    },
    startOver() {
      this.stage = 'preferences';
      this.dayResult = null;
      this.lastError = '';
    },
    editPreferences() {
      this.stage = 'preferences';
    },
    onRecipesChanged() {
      this.recipePoolVersion++;
    },

    // ---- Editable slot actions ----
    recomputeDay() {
      if (!this.dayResult || !this.preferences) return;
      const entries = this.dayResult.entries;
      const totals = Nutrition.sumNutrition(entries);
      this.dayResult = {
        entries,
        totals,
        remaining: {
          calories: this.preferences.calories - totals.calories,
          protein: this.targets.protein - totals.protein,
          carbs: this.targets.carbs - totals.carbs,
          fat: this.targets.fat - totals.fat
        }
      };
    },
    openPickRecipe(index) {
      this.pickerIndex = index;
    },
    closePickRecipe() {
      this.pickerIndex = null;
    },
    onRecipePicked(recipe) {
      if (this.pickerIndex === null || !this.dayResult) return;
      const entries = this.dayResult.entries.slice();
      const slot = entries[this.pickerIndex];
      entries[this.pickerIndex] = {
        slot: slot.slot,
        kind: 'recipe',
        recipe,
        servings: 1,
        targetCalories: slot.targetCalories || 0
      };
      this.dayResult = Object.assign({}, this.dayResult, { entries });
      this.pickerIndex = null;
      this.recomputeDay();
    },
    openLogFood(index) {
      this.logIndex = index;
    },
    closeLogFood() {
      this.logIndex = null;
    },
    onLoggedSaved(logged) {
      if (this.logIndex === null || !this.dayResult) return;
      const entries = this.dayResult.entries.slice();
      const slot = entries[this.logIndex];
      entries[this.logIndex] = {
        slot: slot.slot,
        kind: 'logged',
        logged,
        servings: 1,
        targetCalories: slot.targetCalories || 0
      };
      this.dayResult = Object.assign({}, this.dayResult, { entries });
      this.logIndex = null;
      this.recomputeDay();
    },
    clearSlot(index) {
      if (!this.dayResult) return;
      const entries = this.dayResult.entries.slice();
      const slot = entries[index];
      entries[index] = {
        slot: slot.slot,
        kind: 'empty',
        servings: 1,
        targetCalories: slot.targetCalories || 0
      };
      this.dayResult = Object.assign({}, this.dayResult, { entries });
      this.recomputeDay();
    },
    logInitialForSlot() {
      if (this.logIndex === null || !this.dayResult) return null;
      const slot = this.dayResult.entries[this.logIndex];
      if (slot && slot.kind === 'logged' && slot.logged) {
        return slot.logged;
      }
      return null;
    },
    slotLabelForIndex(index) {
      if (!this.dayResult || index === null) return '';
      const slot = this.dayResult.entries[index];
      return slot ? slot.slot : '';
    },
    pickerFilters() {
      if (!this.preferences) return {};
      return {
        dietTags: this.preferences.dietTags || [],
        excludeAllergens: this.preferences.excludeAllergens || []
      };
    }
  },
  mounted() {
    this.appReady = true;
  }
};

// Mount
const app = createApp(App);

// Expose helper modules to all component templates. Vue templates can only
// resolve identifiers that live on the component instance or on
// app.config.globalProperties -- plain window globals aren't visible.
app.config.globalProperties.Nutrition = window.Nutrition;
app.config.globalProperties.MenuGenerator = window.MenuGenerator;
app.config.globalProperties.IngredientLookup = window.IngredientLookup;
app.config.globalProperties.USDAClient = window.USDAClient;
app.config.globalProperties.RecipeStorage = window.RecipeStorage;

app.mount('#app');