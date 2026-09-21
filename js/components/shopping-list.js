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
      checked: {}
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
    },
    allChecked() {
      return this.totalCount > 0 && this.checkedCount === this.totalCount;
    }
  },
  methods: {
    toggleCheck(item) {
      this.checked[item] = !this.checked[item];
      // force reactivity
      this.checked = { ...this.checked };
    },
    // If everything is already checked, uncheck all. Otherwise check all.
    toggleAll() {
      if (this.allChecked) {
        this.checked = {};
      } else {
        const next = {};
        for (const g of this.grouped) next[g.item] = true;
        this.checked = next;
      }
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
    },
    // Open a new window with a printable version of the list. Only items
    // that are NOT checked (i.e. still to buy) are included, since checked
    // items have presumably already been acquired.
    printList() {
      const items = this.grouped.filter(g => !this.checked[g.item]);
      if (items.length === 0) {
        window.alert('Nothing to print - all items are checked.');
        return;
      }
      const esc = (s) => String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const rows = items.map(g => {
        const amounts = g.amounts.length ? ' &mdash; ' + esc(g.amounts.join(', ')) : '';
        return '<li><span class="box"></span><span class="name">' +
               esc(g.item) + '</span>' + amounts + '</li>';
      }).join('');
      const date = new Date().toLocaleDateString();
      const html = [
        '<!DOCTYPE html>',
        '<html lang="en"><head><meta charset="UTF-8">',
        '<title>Shopping List</title>',
        '<style>',
        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
        '       margin: 2rem; color: #1b1b1b; }',
        'h1 { font-size: 1.5rem; margin: 0 0 0.25rem 0; }',
        '.meta { color: #71767a; font-size: 0.875rem; margin-bottom: 1.5rem; }',
        'ul { list-style: none; padding: 0; margin: 0; }',
        'li { display: flex; align-items: baseline; gap: 0.5rem;',
        '     padding: 0.5rem 0; border-bottom: 1px solid #dfe1e2; font-size: 1.05rem; }',
        '.box { display: inline-block; width: 14px; height: 14px;',
        '       border: 1.5px solid #3d4551; border-radius: 2px; flex: 0 0 auto;',
        '       transform: translateY(2px); }',
        '.name { font-weight: 600; }',
        '@media print {',
        '  body { margin: 0.5in; }',
        '  h1 { font-size: 1.25rem; }',
        '  li { padding: 0.4rem 0; }',
        '}',
        '</style></head><body>',
        '<h1>Shopping List</h1>',
        '<div class="meta">' + items.length + ' item' + (items.length === 1 ? '' : 's') +
          ' to buy &middot; ' + date + '</div>',
        '<ul>' + rows + '</ul>',
        '<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };<\/script>',
        '</body></html>'
      ].join('\n');

      const w = window.open('', '_blank');
      if (!w) {
        window.alert('Could not open print window. Check that pop-ups are allowed for this site.');
        return;
      }
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  },
  template: `
    <section class="card" aria-labelledby="shopping-heading">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <h2 class="card-header" id="shopping-heading" style="border: none; margin: 0; padding: 0;">
          Shopping List
          <span style="font-size: 0.875rem; font-weight: 400; color: var(--color-base); margin-left: 0.5rem;">
            ({{ checkedCount }} bought &middot; {{ totalCount - checkedCount }} remaining)
          </span>
        </h2>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-primary btn-small" @click="printList">
            Print remaining
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="copyList">
            {{ copyStatus || 'Copy full list' }}
          </button>
          <button type="button" class="btn btn-secondary btn-small" @click="clearChecks">
            Uncheck all
          </button>
        </div>
      </div>

      <div style="margin-top: 1rem;">
        <div v-if="grouped.length === 0" class="alert alert-info" role="status">
          No ingredients to show yet. Generate a menu first.
        </div>

        <p
          v-else
          style="margin: 0 0 0.75rem 0; font-size: 0.875rem; color: var(--color-base);">
          Check off items as you buy them. <strong>Print remaining</strong> prints
          only what you still need.
        </p>

        <div
          v-else
          style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; border-bottom: 2px solid var(--color-base-light); margin-bottom: 0.5rem;">
          <input
            type="checkbox"
            id="shop-toggle-all"
            :checked="allChecked"
            @change="toggleAll"
            style="width: 1.25rem; height: 1.25rem;">
          <label for="shop-toggle-all" style="font-weight: 600; cursor: pointer; flex: 1;">
            {{ allChecked ? 'Uncheck all' : 'Select all' }}
          </label>
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