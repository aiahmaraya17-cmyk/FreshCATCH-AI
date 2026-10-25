<template>
  <div class="admin-dashboard-view container">
    <div class="page-header flex-between">
      <div>
        <span class="badge badge-cyan">Admin & Researcher Portal</span>
        <h1>Research Intelligence Dashboard</h1>
        <p class="subtitle">Scan trends, production model metrics, and dataset distributions from Roxas wet market</p>
      </div>
      <div class="header-actions">
        <router-link to="/admin/dataset/new" class="btn btn-primary btn-sm">
          + Add Dataset Specimen
        </router-link>
        <router-link to="/admin/reports" class="btn btn-secondary btn-sm">
          Export Reports
        </router-link>
      </div>
    </div>

    <!-- 4 Key Performance Indicator (KPI) Cards -->
    <div class="grid-4 mb-4">
      <div class="glass-card kpi-card">
        <div class="kpi-icon icon-users">👥</div>
        <div class="kpi-info">
          <span class="kpi-num">{{ statsLoaded && !loadError ? stats.totalUsers : '—' }}</span>
          <span class="kpi-lbl">Registered Users</span>
        </div>
      </div>

      <div class="glass-card kpi-card">
        <div class="kpi-icon icon-preds">📊</div>
        <div class="kpi-info">
          <span class="kpi-num">{{ statsLoaded && !loadError ? stats.totalPredictions : '—' }}</span>
          <span class="kpi-lbl">Total Fish Scans</span>
        </div>
      </div>

      <div class="glass-card kpi-card">
        <div class="kpi-icon icon-dataset">📁</div>
        <div class="kpi-info">
          <span class="kpi-num">{{ statsLoaded && !loadError ? stats.totalDataset : '—' }}</span>
          <span class="kpi-lbl">Annotated Images</span>
        </div>
      </div>

      <div class="glass-card kpi-card">
        <div class="kpi-icon icon-acc">🎯</div>
        <div class="kpi-info">
          <span class="kpi-num text-emerald">{{ formatPercent(evalMetrics?.accuracy) }}</span>
          <span class="kpi-lbl">Test Accuracy (CNN)</span>
        </div>
      </div>
    </div>

    <!-- Active Model Status Card -->
    <div class="glass-card model-status-card mb-4">
      <div class="model-meta-row">
        <div>
          <span class="badge badge-fresh">Active Production Model</span>
          <h3>{{ activeModel.name || 'No active model reported' }}</h3>
          <span class="model-ver-code">{{ activeModel.version || 'Model version unavailable' }}</span>
        </div>
        <div class="model-quick-metrics">
          <div class="q-metric">
            <span class="q-num">{{ formatPercent(evalMetrics?.precision_macro) }}</span>
            <span class="q-lbl">Precision</span>
          </div>
          <div class="q-metric">
            <span class="q-num">{{ formatPercent(evalMetrics?.recall_macro) }}</span>
            <span class="q-lbl">Recall</span>
          </div>
          <div class="q-metric">
            <span class="q-num">{{ formatPercent(evalMetrics?.f1_score_macro) }}</span>
            <span class="q-lbl">F1-Score</span>
          </div>
        </div>
      </div>
    </div>

    <p v-if="loadError" class="glass-card dashboard-error" role="status">{{ loadError }}</p>

    <section class="analytics-grid mb-4" aria-label="System analytics">
      <article class="glass-card analytics-card activity-card">
        <div class="analytics-heading">
          <div><h3>Scan activity</h3><p>Recorded fish scans per day · last 7 days</p></div>
          <span class="chart-total">{{ statsLoaded && !loadError ? stats.totalPredictions : '—' }} <small>total</small></span>
        </div>
        <div v-if="!statsLoaded" class="chart-empty">Loading scan records…</div>
        <div v-else-if="loadError" class="chart-empty">Scan activity is currently unavailable.</div>
        <div v-else class="chart-canvas activity-canvas" role="img" aria-label="Line chart of daily recorded fish scans">
          <Line :data="activityChartData" :options="lineChartOptions" />
        </div>
        <p v-if="statsLoaded && !loadError && !hasActivity" class="chart-footnote">No scans were recorded in this period; the chart shows zero activity.</p>
      </article>

      <article class="glass-card analytics-card distribution-card">
        <div class="analytics-heading">
          <div><h3>Freshness outcomes</h3><p>Distribution of live scans</p></div>
        </div>
        <div v-if="!statsLoaded" class="chart-empty">Loading scan records…</div>
        <div v-else-if="loadError" class="chart-empty">Freshness distribution is currently unavailable.</div>
        <div v-else-if="hasClassifications" class="chart-canvas doughnut-canvas" role="img" aria-label="Doughnut chart of recorded freshness outcomes">
          <Doughnut :data="distributionChartData" :options="doughnutChartOptions" />
        </div>
        <div v-else class="chart-empty distribution-empty">
          <div class="empty-donut"><span>{{ stats.totalPredictions }}<small>scans</small></span></div>
          <p>No outcomes recorded yet.</p>
        </div>
      </article>

      <article class="glass-card analytics-card model-chart-card">
        <div class="analytics-heading">
          <div><h3>Model evaluation</h3><p>Held-out evaluation metrics</p></div>
          <router-link to="/admin/evaluation" class="chart-link">View evaluation</router-link>
        </div>
        <div v-if="hasEvalMetrics" class="chart-canvas metrics-canvas">
          <Bar :data="modelMetricsChartData" :options="metricsChartOptions" />
        </div>
        <div v-else class="chart-empty">Evaluation metrics are not available. Run an evaluation to populate this chart.</div>
        <p class="chart-footnote">These scores describe the test set, not live scan accuracy.</p>
      </article>
    </section>

    <!-- Admin Quick Navigation Grid -->
    <div class="grid-3 mb-4">
      <router-link to="/admin/dataset" class="glass-card admin-nav-card">
        <div class="nav-card-icon">🗂️</div>
        <h4>Dataset Management</h4>
        <p>Browse fish images by split and lighting condition<span v-if="statsLoaded && !loadError"> ({{ stats.totalDataset }} total)</span>.</p>
      </router-link>

      <router-link to="/admin/evaluation" class="glass-card admin-nav-card">
        <div class="nav-card-icon">📈</div>
        <h4>Model Evaluation & Confusion Matrix</h4>
        <p>Inspect real test dataset accuracy, precision, recall, and loss curves</p>
      </router-link>

      <router-link to="/admin/environmental" class="glass-card admin-nav-card">
        <div class="nav-card-icon">🌦️</div>
        <h4>Environmental Robustness</h4>
        <p>Review benchmark performance across lighting, market backgrounds & distance</p>
      </router-link>

      <router-link to="/admin/error-analysis" class="glass-card admin-nav-card">
        <div class="nav-card-icon">🔍</div>
        <h4>Error & Failure Mode Analysis</h4>
        <p>Audit misclassified images and add researcher review commentary</p>
      </router-link>

      <router-link to="/admin/models" class="glass-card admin-nav-card">
        <div class="nav-card-icon">⚙️</div>
        <h4>CNN Model Registry & Training</h4>
        <p>Trigger retrainings, manage model versions, and track checkpoints</p>
      </router-link>

      <router-link to="/admin/reports" class="glass-card admin-nav-card">
        <div class="nav-card-icon">📑</div>
        <h4>Reports & Data Export</h4>
        <p>Generate research summaries and export dataset/predictions as CSV/JSON</p>
      </router-link>

      <router-link v-if="authStore.isAdmin" to="/admin/users" class="glass-card admin-nav-card">
        <div class="nav-card-icon">Users</div>
        <h4>Manage Users</h4>
        <p>Create, edit, activate, deactivate, or remove user accounts</p>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { Bar, Doughnut, Line } from 'vue-chartjs';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import ApiService from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

const authStore = useAuthStore();

const stats = ref({
  totalUsers: 0,
  totalPredictions: 0,
  totalDataset: 0,
  categoryDistribution: [],
  predictionActivity: []
});
const statsLoaded = ref(false);
const loadError = ref('');

const activeModel = ref({});
const evalMetrics = ref(null);

const hasActivity = computed(() => stats.value.predictionActivity.some((item) => item.count > 0));
const hasClassifications = computed(() => stats.value.categoryDistribution.some((item) => item.count > 0));
const hasEvalMetrics = computed(() => ['accuracy', 'precision_macro', 'recall_macro', 'f1_score_macro']
  .every((key) => Number.isFinite(evalMetrics.value?.[key])));

const activityChartData = computed(() => ({
  labels: stats.value.predictionActivity.map(({ date }) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))),
  datasets: [{
    label: 'Scans',
    data: stats.value.predictionActivity.map(({ count }) => count),
    borderColor: '#22c5f2',
    backgroundColor: 'rgba(34, 197, 242, 0.14)',
    pointBackgroundColor: '#22c5f2',
    pointBorderColor: '#071321',
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2.5,
    tension: 0.35,
    fill: true
  }]
}));

const freshnessColors = ['#10b981', '#f59e0b', '#fb923c', '#ef4444', '#64748b'];
const distributionChartData = computed(() => ({
  labels: stats.value.categoryDistribution.map(({ classification }) => formatClassification(classification)),
  datasets: [{
    data: stats.value.categoryDistribution.map(({ count }) => count),
    backgroundColor: stats.value.categoryDistribution.map((_, index) => freshnessColors[index % freshnessColors.length]),
    borderColor: '#0b1726',
    borderWidth: 3,
    hoverOffset: 6
  }]
}));

const modelMetricsChartData = computed(() => ({
  labels: ['Accuracy', 'Precision', 'Recall', 'F1 score'],
  datasets: [{
    label: 'Test set score',
    data: [evalMetrics.value.accuracy, evalMetrics.value.precision_macro, evalMetrics.value.recall_macro, evalMetrics.value.f1_score_macro].map((value) => Number((value * 100).toFixed(2))),
    backgroundColor: ['#10b981', '#22c5f2', '#14b8a6', '#8b5cf6'],
    borderRadius: 6,
    barThickness: 17
  }]
}));

const commonChartText = '#94a3b8';
const lineChartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { displayColors: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: commonChartText, maxRotation: 0 } },
    y: { beginAtZero: true, ticks: { precision: 0, color: commonChartText }, grid: { color: 'rgba(148,163,184,0.12)' } }
  }
};
const doughnutChartOptions = {
  responsive: true, maintainAspectRatio: false, cutout: '68%',
  plugins: { legend: { position: 'right', labels: { color: commonChartText, usePointStyle: true, padding: 16 } } }
};
const metricsChartOptions = {
  indexAxis: 'y', responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${context.raw.toFixed(2)}%` } } },
  scales: {
    x: { min: 0, max: 100, ticks: { color: commonChartText, callback: (value) => `${value}%` }, grid: { color: 'rgba(148,163,184,0.12)' } },
    y: { ticks: { color: commonChartText }, grid: { display: false } }
  }
};

function formatPercent(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
    ? `${(Number(value) * 100).toFixed(1)}%`
    : '—';
}

function formatClassification(value) {
  return String(value || 'Unknown').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

onMounted(async () => {
  try {
    const statRes = await ApiService.getStatistics();
    if (statRes.success) {
      stats.value = { ...stats.value, ...statRes.stats };
      activeModel.value = statRes.stats.activeModel || {};
    }
    statsLoaded.value = true;
  } catch (e) {
    loadError.value = 'System usage data could not be loaded. Check the API connection and try again.';
    statsLoaded.value = true;
    console.error('Failed to load admin statistics:', e);
  }
  try {
    const evalRes = await ApiService.getEvaluationMetrics();
    if (evalRes.success && evalRes.evaluation) {
      evalMetrics.value = evalRes.evaluation.metrics || null;
    }
  } catch (e) {
    console.info('Model evaluation metrics are not available:', e.message);
  }
});
</script>

<style scoped>
.admin-dashboard-view {
  padding: 2.5rem 1.25rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.page-header h1 { margin: 0.5rem 0; }
.subtitle { max-width: 680px; color: var(--text-muted); }

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.kpi-card {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.kpi-icon {
  font-size: 2rem;
}

.kpi-num {
  display: block;
  font-size: 1.8rem;
  font-weight: 800;
  font-family: var(--font-heading);
  color: var(--text-white);
  line-height: 1.1;
}

.kpi-lbl {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.text-emerald { color: var(--color-fresh); }

.dashboard-error {
  padding: 0.9rem 1.1rem;
  margin-bottom: 1rem;
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.3);
}

.analytics-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
  gap: 1rem;
}

.analytics-card { min-width: 0; padding: 1.35rem; }
.model-chart-card { grid-column: 1 / -1; }

.analytics-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1rem;
}

.analytics-heading h3 { margin: 0; font-size: 1rem; color: var(--text-white); }
.analytics-heading p { margin: 0.3rem 0 0; font-size: 0.78rem; color: var(--text-muted); }
.chart-total { color: var(--text-white); font-size: 1.2rem; font-weight: 700; white-space: nowrap; }
.chart-total small { color: var(--text-muted); font-size: 0.7rem; font-weight: 500; }
.chart-canvas { position: relative; width: 100%; min-width: 0; }
.activity-canvas { height: 235px; }
.doughnut-canvas { height: 235px; }
.metrics-canvas { height: 250px; }
.chart-empty {
  min-height: 210px;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  border: 1px dashed rgba(148,163,184,0.22);
  border-radius: 0.75rem;
  color: var(--text-muted);
  font-size: 0.85rem;
  text-align: center;
}
.distribution-empty { gap: 0.7rem; }
.distribution-empty p { margin: 0; }
.empty-donut {
  width: 112px; height: 112px; border-radius: 50%;
  display: grid; place-items: center;
  background: conic-gradient(#30445a 0deg, #30445a 360deg);
  position: relative;
}
.empty-donut::before {
  content: ''; position: absolute; inset: 12px;
  border-radius: 50%; background: #0b1726;
}
.empty-donut span { position: relative; z-index: 1; color: var(--text-white); font-size: 1.2rem; font-weight: 700; text-align: center; }
.empty-donut small { display: block; color: var(--text-muted); font-size: 0.65rem; font-weight: 500; }
.chart-link { color: var(--primary); font-size: 0.78rem; white-space: nowrap; }
.chart-footnote { margin: 0.75rem 0 0; color: var(--text-dim); font-size: 0.72rem; }

.model-status-card {
  padding: 1.75rem;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(20, 184, 166, 0.08));
}

.model-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

@media (max-width: 768px) {
  .model-meta-row {
    flex-direction: column;
    align-items: flex-start;
  }
}

.model-meta-row h3 {
  font-size: 1.4rem;
  margin: 0.4rem 0 0.2rem;
}

.model-ver-code {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.model-quick-metrics {
  display: flex;
  gap: 2rem;
  min-width: 0;
}

.q-metric {
  text-align: center;
}

.q-num {
  display: block;
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--text-white);
}

.q-lbl {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.admin-nav-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  transition: all var(--transition-fast);
}

.admin-nav-card:hover {
  transform: translateY(-3px);
  border-color: var(--primary);
  box-shadow: var(--shadow-md), var(--shadow-glow);
}

.nav-card-icon {
  font-size: 1.8rem;
  margin-bottom: 0.75rem;
}

.admin-nav-card h4 {
  font-size: 1.1rem;
  margin-bottom: 0.35rem;
}

.admin-nav-card p {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.4;
}

.mb-4 { margin-bottom: 2rem; }

@media (max-width: 768px) {
  .admin-dashboard-view { padding: 1.5rem 1rem 3rem; }
  .page-header { align-items: stretch; flex-direction: column; gap: 1rem; }
  .page-header h1 { font-size: clamp(1.65rem, 7vw, 2.2rem); overflow-wrap: anywhere; }
  .header-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .header-actions .btn { justify-content: center; text-align: center; }
  .admin-dashboard-view .grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kpi-card { min-width: 0; gap: 0.8rem; padding: 1rem; }
  .kpi-num { font-size: 1.5rem; }
  .kpi-lbl { line-height: 1.35; }
  .model-status-card { padding: 1.2rem; }
  .model-meta-row { width: 100%; }
  .model-meta-row > div:first-child { min-width: 0; }
  .model-meta-row h3,
  .model-ver-code { overflow-wrap: anywhere; }
  .model-quick-metrics { width: 100%; justify-content: space-around; gap: 0.75rem; }
  .q-num { font-size: 1.2rem; }
  .analytics-grid { grid-template-columns: minmax(0, 1fr); }
  .model-chart-card { grid-column: auto; }
  .analytics-card { padding: 1.1rem; }
  .activity-canvas, .doughnut-canvas { height: 220px; }
  .analytics-heading { align-items: flex-start; }
  .admin-nav-card { min-width: 0; padding: 1.2rem; }
  .admin-nav-card h4,
  .admin-nav-card p { overflow-wrap: anywhere; }
}

@media (max-width: 360px) {
  .admin-dashboard-view { padding-inline: 0.75rem; }
  .admin-dashboard-view .grid-4 { grid-template-columns: minmax(0, 1fr); }
  .header-actions { grid-template-columns: 1fr; }
  .model-quick-metrics { gap: 0.4rem; }
}
</style>
