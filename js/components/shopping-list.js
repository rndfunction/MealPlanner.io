/**
 * ShoppingList component
 * Aggregates ingredients across the day's menu and groups them.
 */
const ShoppingList = {
  name: 'ShoppingList',
  props: {
    entries: { type: Array, required: true }
  },
  data() {
    return {
      checked: {},
      collapsed: false
    };
  },
  computed: {
    // Group ingredients by item name so identical items roll up
    grouped() {
      const map = new Map();
      for (const entry of this.entries) {
        if (!entry || !entry.recipe) continue;
        const mult = entry.servings || 1;
        for (const ing of entry.recipe.ingredients || []) {
          const key = ing.item.toLowerCase().trim();
          if (!map.has(key)) {
            map.set(key, {
              item: ing.item,
              amounts: [],
              recipes: []
            });
          }
          const rec = map.get(key);
          if (ing.amount) {
            const amt = mult !== 1 ? ing.amount + ' x' + mult : ing.amount;
            rec.amounts.push(amt);
          }
          rec.recipes.push(entry.recipe.name);
        }
      }
      // Sort alphabetically by item
      return Array.from(map.values()).sort((a, b) =>
        a.item.toLowerCase().localeCompare(b.item.toLowerCase())
      );
    },
    checkedCount() {
      return Object.values(this.checked).filter(Boolean).length;
    },
    totalCount() {
      return this.grouped.length;
    }
  },
  methods: {
    toggleCheck(item) {
      this.checked[item] = !this.checked[item];
      // force reactivity
      this.checked = { ...this.checked };
    },
    toggleCollapse() {
      this.collapsed = !this.collapsed;
    },
    copyList() {
      const text = this.grouped
        .map(g => '- ' + g.item + (g.amounts.length ? ': ' + g.amounts.join(', ') : ''))
        .join('\n');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          () => { this.copyStatus = 'Copied!'; setTimeout(() => this.copyStatus = '', 1500); },
          () => { this.copyStatus = 'Copy failed'; }
        );
      }
    },
    clearChecks() {
      this.checked = {};
    }
  },
  template: `
    <section class="card" aria-labelledby="shopping-heading">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <h2 class="card-header" id="shopping-heading" style="border: none; margin: 0; padding: 0;">
          Shopping List
          <span style="font-size: 0.875rem; font-weight: 400; color: var(--color-base); margin-left: 0.5rem;">
            ({{ checkedCount }} of {{ totalCount }} checked)
          </span>
        </h2>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" class="btn btn-secondary btn-small" @click="copyList">
            {{ copyStatus || 'Copy list' }}
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="clearChecks">
            Clear
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-small"
            @click="toggleCollapse"
            :aria-expanded="!collapsed">
            {{ collapsed ? 'Show' : 'Hide' }}
          </button>
        </div>
      </div>

      <div v-if="!collapsed" style="margin-top: 1rem;">
        <div v-if="grouped.length === 0" class="alert alert-info" role="status">
          No ingredients to show yet. Generate a menu first.
        </div>

        <ul style="list-style: none; padding: 0; margin: 0;">
          <li
            v-for="g in grouped"
            :key="g.item"
            style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid var(--color-base-light);">
            <input
              type="checkbox"
              :id="'shop-' + g.item.replace(/[^a-z0-9]/gi, '_')"
              :checked="!!checked[g.item]"
              @change="toggleCheck(g.item)"
              style="margin-top: 0.35rem; width: 1.25rem; height: 1.25rem;">
            <label
              :for="'shop-' + g.item.replace(/[^a-z0-9]/gi, '_')"
              style="flex: 1; cursor: pointer;"
              :style="{ textDecoration: checked[g.item] ? 'line-through' : 'none', opacity: checked[g.item] ? 0.6 : 1 }">
              <strong>{{ g.item }}</strong>
              <span v-if="g.amounts.length" style="color: var(--color-base);">
                &mdash; {{ g.amounts.join(', ') }}
              </span>
              <div style="font-size: 0.75rem; color: var(--color-base);">
                used in: {{ Array.from(new Set(g.recipes)).join(', ') }}
              </div>
            </label>
          </li>
        </ul>
      </div>
    </section>
  `
};

if (typeof window !== 'undefined') {
  window.ShoppingList = ShoppingList;
}