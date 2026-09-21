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
      logIndex: null,
      showLogModal: false,
      eatenLog: [] // entries the user has already eaten today
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
    },
    // Filters passed to the recipe picker modal. Computed (not a method)
    // because the template binds it as :filters="pickerFilters".
    pickerFilters() {
      if (!this.preferences) return {};
      return {
        dietTags: this.preferences.dietTags || [],
        excludeAllergens: this.preferences.excludeAllergens || []
      };
    },
    // Per-slot count of eligible recipes under current filters. Used by
    // MenuDisplay to warn when a slot has no re-roll variety.
    slotCandidateCounts() {
      if (!this.dayResult || !this.preferences) return {};
      const filters = {
        dietTags: this.preferences.dietTags || [],
        excludeAllergens: this.preferences.excludeAllergens || []
      };
      const counts = {};
      this.dayResult.entries.forEach((entry, i) => {
        counts[i] = MenuGenerator.countCandidatesForSlot(
          this.recipePool,
          entry.slot,
          filters
        );
      });
      return counts;
    },
    // Sum of the eaten log, used to adjust remaining targets and to show
    // "already eaten today" totals.
    eatenTotals() {
      const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
      for (const e of this.eatenLog) {
        const mult = e.servings || 1;
        totals.calories += (e.calories || 0) * mult;
        totals.protein  += (e.protein  || 0) * mult;
        totals.carbs    += (e.carbs    || 0) * mult;
        totals.fat      += (e.fat      || 0) * mult;
        totals.fiber    += (e.fiber    || 0) * mult;
        totals.sugar    += (e.sugar    || 0) * mult;
        totals.sodium   += (e.sodium   || 0) * mult;
      }
      for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k]);
      return totals;
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
          <button
            role="tab"
            type="button"
            class="btn"
            :aria-selected="view === 'shopping'"
            :style="tabStyle('shopping')"
            @click="view = 'shopping'">
            Shopping List
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

      <!-- Shopping List view -->
      <div v-else-if="view === 'shopping'">
        <div v-if="!dayResult || entries.length === 0" class="card">
          <h2 class="card-header">Shopping List</h2>
          <div class="alert alert-info" role="status">
            No menu planned yet. Head to the
            <button
              type="button"
              class="btn btn-primary btn-small"
              style="margin: 0 0.25rem;"
              @click="view = 'planner'">
              Planner
            </button>
            tab to generate a menu, then come back here for your ingredient list.
          </div>
        </div>
        <shopping-list v-else :entries="entries"></shopping-list>
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
          <button type="button" class="btn btn-primary btn-small" @click="openEatenLog">
            + Log what I&rsquo;ve eaten
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="reworkMenu"
                  title="Replan recipe slots to hit your target given what you've already eaten">
            Rework menu
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="editPreferences">
            Edit preferences
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="startOver">
            Start over
          </button>
        </div>

        <!-- Eaten log summary -->
        <div v-if="eatenLog.length > 0" class="card" style="border-left: 4px solid var(--color-warning);">
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1rem;">
            Already eaten today
            <span style="font-weight: 400; color: var(--color-base); font-size: 0.875rem;">
              ({{ eatenTotals.calories }} kcal)
            </span>
          </h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            <li
              v-for="e in eatenLog"
              :key="e.id"
              style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid var(--color-base-light); gap: 0.5rem;">
              <span style="flex: 1;">
                <strong>{{ e.name }}</strong>
                <span style="color: var(--color-base); font-size: 0.85rem; margin-left: 0.5rem;">
                  {{ fmtNum(e.calories) }} kcal &middot;
                  P {{ fmtNum(e.protein) }}g &middot;
                  C {{ fmtNum(e.carbs) }}g &middot;
                  F {{ fmtNum(e.fat) }}g
                </span>
              </span>
              <button
                type="button"
                class="btn btn-secondary btn-small"
                @click="removeEatenEntry(e.id)"
                :aria-label="'Remove ' + e.name + ' from log'">
                Remove
              </button>
            </li>
          </ul>
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

      <log-food-modal
        v-if="showLogModal"
        @save="onEatenLogSaved"
        @cancel="closeEatenLog">
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
    // Display helper for numbers with sensible precision: whole numbers
    // show as-is, fractional values show up to 2 decimals with trailing
    // zeros trimmed.
    fmtNum(v) {
      if (v == null || isNaN(v)) return '0';
      const n = Number(v);
      if (Number.isInteger(n)) return n.toString();
      return (Math.round(n * 100) / 100).toString();
    },

    // ---- Editable slot actions ----
    recomputeDay() {
      if (!this.dayResult || !this.preferences) return;
      const entries = this.dayResult.entries;
      const slotTotals = Nutrition.sumNutrition(entries);
      // Combine with eaten log so totals and remaining reflect the whole day.
      const eaten = this.eatenTotals;
      const totals = {
        calories: slotTotals.calories + eaten.calories,
        protein:  slotTotals.protein  + eaten.protein,
        carbs:    slotTotals.carbs    + eaten.carbs,
        fat:      slotTotals.fat      + eaten.fat,
        fiber:    slotTotals.fiber    + eaten.fiber,
        sugar:    slotTotals.sugar    + eaten.sugar,
        sodium:   slotTotals.sodium   + eaten.sodium
      };
      this.dayResult = {
        entries,
        totals,
        remaining: {
          calories: this.preferences.calories - totals.calories,
          protein:  this.targets.protein - totals.protein,
          carbs:    this.targets.carbs - totals.carbs,
          fat:      this.targets.fat - totals.fat
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
    // Slot-level log: replaces the contents of a specific slot. Kept for
    // the "I want to record what I had for dinner instead" case.
    openLogFood(index) {
      this.logIndex = index;
    },
    closeLogFood() {
      this.logIndex = null;
    },
    onLoggedSaved(payload) {
      if (this.logIndex === null || !this.dayResult) return;
      // The modal now emits { entry, rework }; unwrap. Slot-level logging
      // ignores the rework flag (rework is only meaningful for the day log).
      const logged = payload && payload.entry ? payload.entry : payload;
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
    // Eaten log: additive entries independent of any slot.
    openEatenLog() {
      this.showLogModal = true;
    },
    closeEatenLog() {
      this.showLogModal = false;
    },
    onEatenLogSaved(payload) {
      // payload may be either a logged entry or { entry, rework }.
      const entry = payload && payload.entry ? payload.entry : payload;
      const shouldRework = !!(payload && payload.rework);
      const id = 'eaten-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      this.eatenLog = this.eatenLog.concat([Object.assign({}, entry, { id })]);
      this.showLogModal = false;
      if (shouldRework) {
        this.reworkMenu();
      } else {
        this.recomputeDay();
      }
    },
    reworkMenu() {
      if (!this.dayResult || !this.preferences) return;
      const macros = Nutrition.calculateMacroTargets(this.preferences.calories, this.preferences.macroSplit);
      const next = MenuGenerator.reworkForRemaining(
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
        this.eatenTotals
      );
      this.dayResult = Object.assign({}, this.dayResult, { entries: next });
      this.recomputeDay();
    },
    removeEatenEntry(id) {
      this.eatenLog = this.eatenLog.filter(e => e.id !== id);
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