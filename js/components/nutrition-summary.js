/**
 * NutritionSummary component
 * Shows the day's totals vs targets with progress bars and macro breakdown.
 */
const NutritionSummary = {
  name: 'NutritionSummary',
  props: {
    totals: { type: Object, required: true },
    targets: { type: Object, required: true }
  },
  computed: {
    comparison() {
      return Nutrition.compareToTargets(this.totals, this.targets);
    },
    macroPct() {
      return Nutrition.macroPercentages(this.totals);
    },
    overallStatus() {
      const c = this.comparison;
      const statuses = ['calories', 'protein', 'carbs', 'fat'].map(k => c[k].status);
      if (statuses.every(s => s === 'on-target')) return 'on-target';
      if (statuses.filter(s => s === 'on-target').length >= 2) return 'on-target';
      return 'off-target';
    },
    summaryMessage() {
      const c = this.comparison;
      const cal = c.calories;
      if (cal.status === 'on-target') {
        return 'Your menu meets your calorie target within 10%.';
      }
      if (cal.status === 'under') {
        return 'Your menu is ' + Math.abs(cal.diff) + ' kcal below your target. Try adding a snack or a larger portion.';
      }
      return 'Your menu is ' + cal.diff + ' kcal above your target. Consider replacing a meal.';
    }
  },
  methods: {
    barWidth(metric) {
      const pct = this.comparison[metric].percent;
      return Math.min(100, pct) + '%';
    },
    barClass(metric) {
      const s = this.comparison[metric].status;
      if (s === 'over') return 'progress-fill over';
      if (s === 'under') return 'progress-fill under';
      return 'progress-fill';
    },
    fmtCal(n) { return Nutrition.formatCalories(n); },
    fmtG(n) { return Nutrition.formatGrams(n); },
    fmtSodium(n) { return Nutrition.formatSodium(n); },
    label(metric) {
      return metric.charAt(0).toUpperCase() + metric.slice(1);
    }
  },
  template: `
    <section class="card" aria-labelledby="summary-heading">
      <h2 class="card-header" id="summary-heading">Nutrition Summary</h2>

      <div class="alert" :class="overallStatus === 'on-target' ? 'alert-info' : 'alert-warning'" role="status">
        {{ summaryMessage }}
      </div>

      <div class="metric" v-for="metric in ['calories','protein','carbs','fat']" :key="metric" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.25rem;">
          <strong>{{ label(metric) }}</strong>
          <span :class="Nutrition.statusClass(comparison[metric].status)">
            {{ comparison[metric].actual }}
            <span style="color: var(--color-base);"> / {{ comparison[metric].target }}</span>
            <span class="sr-only">{{ Nutrition.statusLabel(comparison[metric].status) }}</span>
          </span>
        </div>
        <div class="progress-bar"
             role="progressbar"
             :aria-valuenow="comparison[metric].actual"
             :aria-valuemin="0"
             :aria-valuemax="comparison[metric].target * 2"
             :aria-label="label(metric) + ': ' + comparison[metric].percent + ' percent of target'">
          <div :class="barClass(metric)" :style="{ width: barWidth(metric) }"></div>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-base); margin-top: 0.25rem;">
          {{ comparison[metric].percent }}% of target &mdash;
          {{ Nutrition.statusLabel(comparison[metric].status) }}
        </div>
      </div>

      <h3 style="margin-top: 1.5rem; font-size: 1rem;">Macro breakdown (% of calories)</h3>
      <div class="grid-3" style="gap: 0.5rem;">
        <div class="nutrition-badge">Protein: <strong>{{ macroPct.protein }}%</strong></div>
        <div class="nutrition-badge">Carbs: <strong>{{ macroPct.carbs }}%</strong></div>
        <div class="nutrition-badge">Fat: <strong>{{ macroPct.fat }}%</strong></div>
      </div>

      <h3 style="margin-top: 1.5rem; font-size: 1rem;">Additional totals</h3>
      <div class="grid-3" style="gap: 0.5rem;">
        <div class="nutrition-badge">Fiber: <strong>{{ fmtG(totals.fiber) }}</strong></div>
        <div class="nutrition-badge">Sugar: <strong>{{ fmtG(totals.sugar) }}</strong></div>
        <div class="nutrition-badge">Sodium: <strong>{{ fmtSodium(totals.sodium) }}</strong></div>
      </div>
    </section>
  `
};

if (typeof window !== 'undefined') {
  window.NutritionSummary = NutritionSummary;
}