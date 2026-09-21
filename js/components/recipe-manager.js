/**
 * RecipeManager component
 * Lists user's custom recipes and provides edit / delete / add flows.
 */
const RecipeManager = {
  name: 'RecipeManager',
  components: {
    CustomRecipeForm: window.CustomRecipeForm
  },
  emits: ['recipes-changed'],
  data() {
    return {
      recipes: [],
      editing: null,
      showForm: false,
      confirmDeleteId: null
    };
  },
  computed: {
    builtinCount() {
      return (window.RECIPES || []).length;
    },
    totalCount() {
      return this.builtinCount + this.recipes.length;
    }
  },
  mounted() {
    this.refresh();
  },
  methods: {
    refresh() {
      this.recipes = window.RecipeStorage.loadCustomRecipes();
    },
    startAdd() {
      this.editing = null;
      this.showForm = true;
    },
    startEdit(recipe) {
      this.editing = recipe;
      this.showForm = true;
    },
    onSave(recipe) {
      window.RecipeStorage.upsertCustomRecipe(recipe);
      this.showForm = false;
      this.editing = null;
      this.refresh();
      this.$emit('recipes-changed');
    },
    onCancel() {
      this.showForm = false;
      this.editing = null;
    },
    askDelete(id) {
      this.confirmDeleteId = id;
    },
    cancelDelete() {
      this.confirmDeleteId = null;
    },
    confirmDelete(id) {
      window.RecipeStorage.deleteCustomRecipe(id);
      this.confirmDeleteId = null;
      this.refresh();
      this.$emit('recipes-changed');
    },
    fmtCal(n) { return Nutrition.formatCalories(n); }
  },
  template: `
    <div>
      <div v-if="showForm">
        <custom-recipe-form
          :editing="editing"
          @save="onSave"
          @cancel="onCancel">
        </custom-recipe-form>
      </div>

      <div v-else>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h2 class="card-header" style="border: none; padding: 0; margin: 0;">
                My Recipes
              </h2>
              <p style="margin: 0.25rem 0 0 0; color: var(--color-base); font-size: 0.875rem;">
                You have {{ recipes.length }} custom recipe{{ recipes.length === 1 ? '' : 's' }}.
                Total pool: {{ totalCount }} recipes ({{ builtinCount }} built-in).
              </p>
            </div>
            <button type="button" class="btn btn-primary" @click="startAdd">
              + Add Recipe
            </button>
          </div>
        </div>

        <div v-if="recipes.length === 0" class="alert alert-info" role="status">
          You haven't added any recipes yet. Custom recipes are stored locally in your browser
          and mixed into the planner alongside the built-in ones.
        </div>

        <ul v-else style="list-style: none; padding: 0; margin: 0;">
          <li
            v-for="recipe in recipes"
            :key="recipe.id"
            class="card"
            style="padding: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
              <div style="flex: 1 1 60%;">
                <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-primary-dark); font-weight: 700;">
                  {{ recipe.category }}
                </div>
                <h3 style="margin: 0.25rem 0; font-size: 1.125rem;">{{ recipe.name }}</h3>
                <p v-if="recipe.description" style="margin: 0 0 0.5rem 0; color: var(--color-base-dark);">
                  {{ recipe.description }}
                </p>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                  <span class="nutrition-badge"><strong>{{ fmtCal(recipe.calories) }}</strong></span>
                  <span class="nutrition-badge">P <strong>{{ recipe.protein }}g</strong></span>
                  <span class="nutrition-badge">C <strong>{{ recipe.carbs }}g</strong></span>
                  <span class="nutrition-badge">F <strong>{{ recipe.fat }}g</strong></span>
                </div>
                <div v-if="recipe.tags && recipe.tags.length" style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.25rem;">
                  <span
                    v-for="tag in recipe.tags"
                    :key="tag"
                    class="nutrition-badge"
                    style="font-size: 0.75rem; background: var(--color-primary-light);">
                    {{ tag }}
                  </span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; flex: 0 0 auto;">
                <button type="button" class="btn btn-secondary btn-small" @click="startEdit(recipe)">
                  Edit
                </button>
                <button
                  v-if="confirmDeleteId !== recipe.id"
                  type="button"
                  class="btn btn-secondary btn-small"
                  @click="askDelete(recipe.id)">
                  Delete
                </button>
                <div v-else style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <button
                    type="button"
                    class="btn btn-secondary btn-small"
                    style="background: var(--color-error); color: white; border-color: var(--color-error);"
                    @click="confirmDelete(recipe.id)">
                    Confirm
                  </button>
                  <button type="button" class="btn btn-secondary btn-small" @click="cancelDelete">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  `
};

if (typeof window !== 'undefined') {
  window.RecipeManager = RecipeManager;
}