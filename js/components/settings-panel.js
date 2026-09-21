/**
 * SettingsPanel component
 * Small inline panel for managing the USDA API key and cache.
 */
const SettingsPanel = {
  name: 'SettingsPanel',
  emits: ['close'],
  data() {
    return {
      apiKeyInput: '',
      maskedKey: '',
      testing: false,
      testResult: null,
      saved: false
    };
  },
  created() {
    this.loadCurrentKey();
  },
  computed: {
    isDemoKey() {
      return !this.maskedKey || this.maskedKey === 'DEMO_KEY';
    }
  },
  methods: {
    loadCurrentKey() {
      const k = window.USDAClient.getApiKey();
      if (k === 'DEMO_KEY') {
        this.maskedKey = '';
        this.apiKeyInput = '';
      } else {
        this.maskedKey = k.slice(0, 6) + '...' + k.slice(-4);
        this.apiKeyInput = '';
      }
    },
    save() {
      const k = this.apiKeyInput.trim();
      if (!k) return;
      window.USDAClient.setApiKey(k);
      this.saved = true;
      this.apiKeyInput = '';
      this.testResult = null;
      this.loadCurrentKey();
      setTimeout(() => { this.saved = false; }, 2000);
    },
    clear() {
      window.USDAClient.setApiKey('');
      this.apiKeyInput = '';
      this.testResult = null;
      this.loadCurrentKey();
    },
    async test() {
      this.testing = true;
      this.testResult = null;
      try {
        const results = await window.USDAClient.searchFoods('apple', 1);
        if (results && results.length > 0) {
          this.testResult = { ok: true, message: 'Key works! Found: ' + results[0].description };
        } else {
          this.testResult = { ok: false, message: 'Key worked but returned no results.' };
        }
      } catch (e) {
        this.testResult = { ok: false, message: e.message || 'Test failed.' };
      } finally {
        this.testing = false;
      }
    },
    clearCache() {
      window.USDAClient.clearCache();
      this.testResult = { ok: true, message: 'Lookup cache cleared.' };
    }
  },
  template: `
    <div class="card" style="border: 2px solid var(--color-primary);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2 class="card-header" style="border: none; padding: 0; margin: 0;">Settings</h2>
        <button
          type="button"
          class="btn btn-secondary btn-small"
          @click="$emit('close')"
          aria-label="Close settings">
          Close
        </button>
      </div>

      <fieldset class="form-group" style="margin-top: 1rem;">
        <legend class="form-label">USDA FoodData Central API key</legend>
        <p class="form-hint">
          Stored only in this browser&rsquo;s localStorage. Sent only to USDA.
          <a href="https://fdc.nal.usda.gov/api-key-signup.html" target="_blank" rel="noopener">
            Get a free key
          </a>.
        </p>

        <div v-if="maskedKey" class="alert alert-info" style="font-size: 0.875rem;">
          Current key: <code>{{ maskedKey }}</code>
        </div>
        <div v-else class="alert alert-warning" style="font-size: 0.875rem;">
          Using <strong>DEMO_KEY</strong> &mdash; 30 requests/hour.
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; margin-top: 0.5rem;">
          <div style="flex: 2 1 240px;">
            <label class="form-label" for="usda-key-input" style="font-size: 0.875rem;">
              {{ maskedKey ? 'Replace key' : 'Paste your key' }}
            </label>
            <input
              id="usda-key-input"
              class="form-input"
              type="password"
              autocomplete="off"
              v-model="apiKeyInput"
              placeholder="e.g. AbCdEf123456...">
          </div>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="!apiKeyInput.trim()"
            @click="save">
            {{ saved ? 'Saved!' : 'Save' }}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            v-if="maskedKey"
            @click="clear">
            Clear
          </button>
        </div>

        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.75rem;">
          <button
            type="button"
            class="btn btn-secondary btn-small"
            :disabled="testing"
            @click="test">
            {{ testing ? 'Testing...' : 'Test key' }}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-small"
            @click="clearCache">
            Clear lookup cache
          </button>
        </div>

        <div
          v-if="testResult"
          class="alert"
          :class="testResult.ok ? 'alert-info' : 'alert-error'"
          role="status"
          style="font-size: 0.875rem; margin-top: 0.75rem;">
          {{ testResult.message }}
        </div>
      </fieldset>
    </div>
  `
};

if (typeof window !== 'undefined') {
  window.SettingsPanel = SettingsPanel;
}