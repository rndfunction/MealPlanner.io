/**
 * Storage utilities for user-created recipes.
 * Uses localStorage so the app remains zero-backend and private.
 */
const STORAGE_KEY = 'meal-planner.custom-recipes.v1';

/**
 * Read all custom recipes. Returns an array (empty on error).
 */
function loadCustomRecipes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('Failed to load custom recipes:', e);
    return [];
  }
}

/**
 * Persist the full list of custom recipes.
 */
function saveCustomRecipes(recipes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
    return true;
  } catch (e) {
    console.warn('Failed to save custom recipes:', e);
    return false;
  }
}

/**
 * Add or update a custom recipe by id. Returns the updated list.
 */
function upsertCustomRecipe(recipe) {
  const list = loadCustomRecipes();
  const idx = list.findIndex(r => r.id === recipe.id);
  if (idx >= 0) list[idx] = recipe;
  else list.push(recipe);
  saveCustomRecipes(list);
  return list;
}

/**
 * Delete a custom recipe by id. Returns the updated list.
 */
function deleteCustomRecipe(id) {
  const list = loadCustomRecipes().filter(r => r.id !== id);
  saveCustomRecipes(list);
  return list;
}

/**
 * Generate a unique id for a new custom recipe.
 */
function generateRecipeId() {
  return 'custom-' + Date.now().toString(36) + '-' +
         Math.random().toString(36).slice(2, 8);
}

/**
 * Return the full recipe pool: built-in + custom. Custom recipes can
 * override built-ins if they share an id (rare, but supported).
 */
function getFullRecipePool() {
  const custom = loadCustomRecipes();
  const customIds = new Set(custom.map(r => r.id));
  const builtins = (window.RECIPES || []).filter(r => !customIds.has(r.id));
  return builtins.concat(custom);
}

if (typeof window !== 'undefined') {
  window.RecipeStorage = {
    loadCustomRecipes,
    saveCustomRecipes,
    upsertCustomRecipe,
    deleteCustomRecipe,
    generateRecipeId,
    getFullRecipePool
  };
}