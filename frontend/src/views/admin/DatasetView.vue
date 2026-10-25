<template>
  <div class="dataset-view container">
    <div class="page-header flex-between">
      <div class="dataset-heading-copy">
        <span class="badge badge-cyan">Research Image Repository</span>
        <h1>CNN Dataset Management</h1>
        <p class="subtitle">Browse and filter labeled fish images by species, freshness, lighting, and dataset split.</p>
      </div>
      <router-link to="/admin/dataset/new" class="btn btn-primary btn-sm dataset-add-button">
        + Add New Specimen
      </router-link>
    </div>

    <!-- Filters Bar -->
    <div class="glass-card filters-card mb-4">
      <div class="filters-grid">
        <input 
          v-model="searchQuery" 
          @input="debounceFetch" 
          type="text" 
          class="input-field" 
          placeholder="Search filename, species, or stall"
        />
        <select v-model="selectedSplit" @change="applyFilters" class="input-field">
          <option value="">All Splits (Train/Val/Test)</option>
          <option value="train">Training (70%)</option>
          <option value="validation">Validation (15%)</option>
          <option value="test">Testing (15%)</option>
        </select>
        <select v-model="selectedCategory" @change="applyFilters" class="input-field">
          <option value="">All Freshness Classes</option>
          <option value="1">Fresh (Sariwa)</option>
          <option value="2">Moderately Fresh</option>
          <option value="3">Less Fresh</option>
          <option value="4">Not Fresh (Bilasa)</option>
        </select>
        <select v-model="selectedLighting" @change="applyFilters" class="input-field">
          <option value="">All Lighting Conditions</option>
          <option value="Bright">Bright Lighting</option>
          <option value="Normal">Normal Lighting</option>
          <option value="Dim">Dim Lighting</option>
        </select>
      </div>
    </div>

    <div class="dataset-results-bar" aria-live="polite">
      <span v-if="isLoading">Loading specimens…</span>
      <span v-else-if="loadError">Dataset could not be loaded.</span>
      <span v-else>Showing {{ visibleStart }}–{{ visibleEnd }} of {{ datasetTotal }} specimens</span>
      <div v-if="datasetTotal > pageSize && !loadError" class="pagination-controls">
        <button class="btn btn-secondary btn-sm" :disabled="offset === 0 || isLoading" @click="previousPage">Previous</button>
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <button class="btn btn-secondary btn-sm" :disabled="offset + pageSize >= datasetTotal || isLoading" @click="nextPage">Next</button>
      </div>
    </div>

    <!-- Dataset Grid / Gallery -->
    <div v-if="isLoading" class="loading-state text-center">
      <p>Loading dataset specimens...</p>
    </div>

    <div v-else-if="loadError" class="glass-card empty-state text-center" role="alert">
      <p>{{ loadError }}</p>
      <button class="btn btn-secondary btn-sm" @click="fetchDataset">Retry</button>
    </div>

    <div v-else-if="images.length === 0" class="glass-card empty-state text-center">
      <p>No dataset images match the selected filter criteria.</p>
    </div>

    <div v-else class="dataset-grid">
      <div v-for="img in images" :key="img.id" class="glass-card specimen-card" @click="selectedModalImg = img">
        <div class="specimen-thumb-wrap">
          <img :src="mediaUrl(img.image_url)" :alt="img.filename" class="specimen-thumb" />
          <span class="split-pill" :class="'split-' + img.split">{{ img.split }}</span>
        </div>
        <div class="specimen-meta">
          <span class="specimen-id">#{{ img.id }} • {{ img.filename.split('_').slice(0, 3).join('_') }}</span>
          <h4 class="specimen-title">{{ img.species_local_name || 'Fish' }}</h4>
          <div class="specimen-tags">
            <span class="badge" :class="getBadgeClass(img.category_name)">{{ img.category_name }}</span>
            <span class="cond-tag">{{ img.lighting_condition }} light</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Specimen Detail Modal -->
    <div v-if="selectedModalImg" class="modal-backdrop" @click.self="selectedModalImg = null">
      <div class="glass-card modal-card">
        <div class="modal-header">
          <h3>Dataset Specimen #{{ selectedModalImg.id }}</h3>
          <button @click="selectedModalImg = null" class="btn-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="modal-img-wrap">
            <img :src="mediaUrl(selectedModalImg.image_url)" alt="High Res Specimen" class="modal-img" />
          </div>
          <div class="modal-details-grid">
            <div class="d-item">
              <span class="d-lbl">Species:</span>
              <span class="d-val">{{ selectedModalImg.species_name }} ({{ selectedModalImg.species_local_name }})</span>
            </div>
            <div class="d-item">
              <span class="d-lbl">Ground Truth Category:</span>
              <span class="badge" :class="getBadgeClass(selectedModalImg.category_name)">{{ selectedModalImg.category_name }}</span>
            </div>
            <div class="d-item">
              <span class="d-lbl">Dataset Split:</span>
              <span class="split-pill" :class="'split-' + selectedModalImg.split">{{ selectedModalImg.split }}</span>
            </div>
            <div class="d-item">
              <span class="d-lbl">Lighting Condition:</span>
              <span class="d-val">{{ selectedModalImg.lighting_condition }}</span>
            </div>
            <div class="d-item">
              <span class="d-lbl">Background Condition:</span>
              <span class="d-val">{{ selectedModalImg.background_condition }}</span>
            </div>
            <div class="d-item">
              <span class="d-lbl">Orientation:</span>
              <span class="d-val">{{ selectedModalImg.fish_orientation }}</span>
            </div>
            <div class="d-item">
              <span class="d-lbl">Source / Location:</span>
              <span class="d-val">{{ selectedModalImg.source }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import ApiService, { mediaUrl } from '../../services/api';

const images = ref([]);
const searchQuery = ref('');
const selectedSplit = ref('');
const selectedCategory = ref('');
const selectedLighting = ref('');
const isLoading = ref(false);
const selectedModalImg = ref(null);
const datasetTotal = ref(0);
const offset = ref(0);
const pageSize = 60;
const loadError = ref('');
let activeRequest = 0;

const currentPage = computed(() => Math.floor(offset.value / pageSize) + 1);
const totalPages = computed(() => Math.max(1, Math.ceil(datasetTotal.value / pageSize)));
const visibleStart = computed(() => datasetTotal.value ? offset.value + 1 : 0);
const visibleEnd = computed(() => Math.min(offset.value + images.value.length, datasetTotal.value));

let debounceTimer = null;
function debounceFetch() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    offset.value = 0;
    fetchDataset();
  }, 300);
}

function applyFilters() {
  offset.value = 0;
  fetchDataset();
}

function previousPage() {
  offset.value = Math.max(0, offset.value - pageSize);
  fetchDataset();
}

function nextPage() {
  if (offset.value + pageSize < datasetTotal.value) {
    offset.value += pageSize;
    fetchDataset();
  }
}

async function fetchDataset() {
  const requestId = ++activeRequest;
  isLoading.value = true;
  loadError.value = '';
  try {
    const params = { limit: pageSize, offset: offset.value };
    if (searchQuery.value) params.search = searchQuery.value;
    if (selectedSplit.value) params.split = selectedSplit.value;
    if (selectedCategory.value) params.freshness_id = selectedCategory.value;
    if (selectedLighting.value) params.lighting = selectedLighting.value;

    const res = await ApiService.getDataset(params);
    if (res.success) {
      if (requestId === activeRequest) {
        images.value = res.images || [];
        datasetTotal.value = Number(res.total) || 0;
      }
    } else {
      throw new Error('The API did not return dataset results.');
    }
  } catch (e) {
    console.error('Failed to load dataset:', e);
    if (requestId === activeRequest) loadError.value = 'Could not load dataset images. Check the API connection and try again.';
  } finally {
    if (requestId === activeRequest) isLoading.value = false;
  }
}

function getBadgeClass(cls) {
  const norm = (cls || '').toLowerCase();
  if (norm.includes('moderately')) return 'badge-moderate';
  if (norm.includes('less')) return 'badge-less-fresh';
  if (norm.includes('not') || norm.includes('bilasa')) return 'badge-not-fresh';
  return 'badge-fresh';
}

onMounted(() => {
  fetchDataset();
});
</script>

<style scoped>
.dataset-view {
  padding: clamp(1.5rem, 4vw, 3rem) 1.25rem;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 2rem;
}

.filters-card {
  padding: 1.25rem;
}

.filters-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 0.85rem;
}

.dataset-heading-copy { min-width: 0; }
.dataset-heading-copy h1 { margin: 0.5rem 0; }
.dataset-heading-copy .subtitle { max-width: 680px; }
.dataset-add-button { flex: 0 0 auto; }
.dataset-results-bar {
  display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  margin: -0.75rem 0 1rem; color: var(--text-muted); font-size: 0.82rem;
}
.pagination-controls { display: flex; align-items: center; gap: 0.65rem; }
.pagination-controls span { white-space: nowrap; font-size: 0.75rem; }
.pagination-controls .btn:disabled { opacity: 0.45; cursor: not-allowed; }

@media (max-width: 900px) {
  .filters-grid {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 550px) {
  .filters-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dataset-view { padding: 1.5rem 1rem 3rem; }
  .dataset-view .page-header { align-items: stretch; flex-direction: column; gap: 1rem; }
  .dataset-view .page-header h1 { font-size: clamp(1.7rem, 7vw, 2.2rem); overflow-wrap: anywhere; }
  .dataset-add-button { justify-content: center; width: 100%; }
  .dataset-results-bar { align-items: flex-start; flex-direction: column; margin-top: -0.5rem; }
}

@media (max-width: 380px) {
  .dataset-view { padding-inline: 0.75rem; }
  .filters-card { padding: 0.85rem; }
  .pagination-controls { width: 100%; justify-content: space-between; gap: 0.35rem; }
}

.dataset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

@media (max-width: 1024px) {
  .dataset-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .dataset-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .dataset-grid { grid-template-columns: 1fr; }
}

.specimen-card {
  padding: 0.85rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: all var(--transition-fast);
}

.specimen-card:hover {
  transform: translateY(-3px);
  border-color: var(--primary);
}

.specimen-thumb-wrap {
  position: relative;
  width: 100%;
  height: 140px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 0.75rem;
  background: #000;
}

.specimen-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.split-pill {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
}

.split-train { background: rgba(14, 165, 233, 0.85); color: #fff; }
.split-validation { background: rgba(245, 158, 11, 0.85); color: #fff; }
.split-test { background: rgba(20, 184, 166, 0.85); color: #fff; }

.specimen-id {
  font-size: 0.68rem;
  color: var(--text-dim);
}

.specimen-title {
  font-size: 0.95rem;
  margin: 0.2rem 0 0.4rem;
}

.specimen-tags {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.cond-tag {
  font-size: 0.68rem;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  padding: 0.15rem 0.4rem;
  border-radius: 3px;
}

.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1.5rem;
}

.modal-card {
  max-width: 600px;
  width: 100%;
  padding: 1.75rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.btn-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 1.5rem;
  cursor: pointer;
}

.modal-img-wrap {
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 1.25rem;
}

.modal-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.d-item {
  display: flex;
  flex-direction: column;
}

.d-lbl { color: var(--text-muted); font-size: 0.75rem; }
.d-val { font-weight: 600; color: var(--text-white); }
.mb-4 { margin-bottom: 2rem; }
</style>
