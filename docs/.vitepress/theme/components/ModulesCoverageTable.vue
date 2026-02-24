<script setup>
import { computed, onMounted, ref } from 'vue';
import featuresData from '../../../roadmap/features.json';
import { getModuleCoverage } from '../utils';

const searchQuery = ref('');
const selectedStatus = ref('all');

const statusFilters = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'partially-implemented', label: 'Partial' },
  { key: 'not-serialized', label: 'Not serialized' },
  { key: 'na', label: 'NA' },
  { key: 'other', label: 'Other' },
];

const serializedModuleRows = computed(() => {
  const entries = Object.entries(featuresData.moduleSerialization?.serializedModules || {})
  return entries
    .map(([module, item]) => ({ module, ...item }))
    .sort((a, b) => a.module.localeCompare(b.module))
});

function getRowStatusKey(row) {
  if (row?.status === 'not-serialized') {
    return 'not-serialized';
  }
  if (row?.status === 'available') {
    return 'available';
  }
  if (row?.status === 'partially-implemented') {
    return 'partially-implemented';
  }
  if (row?.status === 'na' || isNotApplicable(row?.version)) {
    return 'na';
  }
  return 'other';
}

const statusCounts = computed(() => {
  const counts = new Map(statusFilters.map((status) => [status.key, 0]));

  allModuleRows.value.forEach((row) => {
    const statusKey = getRowStatusKey(row);
    counts.set(statusKey, (counts.get(statusKey) || 0) + 1);
  });

  counts.set('all', allModuleRows.value.length);
  return counts;
});

const allModuleRows = computed(() => {
  const serializedRows = serializedModuleRows.value;
  const notSerialized = (featuresData.moduleSerialization?.notSerializedModules || []).map((module) => ({
    module,
    status: 'not-serialized',
    version: '—',
  }));

  return [...serializedRows, ...notSerialized].sort((a, b) => a.module.localeCompare(b.module));
});

const filteredModuleRows = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLowerCase();

  return allModuleRows.value.filter((row) => {
    const matchesSearch = !normalizedQuery || row.module.toLowerCase().includes(normalizedQuery);
    const matchesStatus =
      selectedStatus.value === 'all' || getRowStatusKey(row) === selectedStatus.value;

    return matchesSearch && matchesStatus;
  });
});

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim().length > 0 || selectedStatus.value !== 'all';
});

function getModuleGroupName(moduleName) {
  const moduleId = String(moduleName || '').split('::')[1] || '';
  if (!moduleId) {
    return 'Other';
  }
  if (moduleId.startsWith('GeoVis')) {
    return 'GeoVis';
  }
  if (moduleId.startsWith('IO')) {
    return 'IO';
  }

  const match = moduleId.match(/^[A-Z][a-z]*/);
  return match ? match[0] : 'Other';
}

const moduleGroups = computed(() => {
  const groups = new Map();

  filteredModuleRows.value.forEach((row) => {
    const groupName = getModuleGroupName(row.module);
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(row);
  });

  return Array.from(groups.entries())
    .map(([name, rows]) => ({ name, rows }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

const moduleCoverage = ref(new Map());

onMounted(async () => {
  try {
    moduleCoverage.value = await getModuleCoverage();
  } catch (error) {
    console.error('Failed to fetch module coverage data', error);
    moduleCoverage.value = new Map();
  }
});

function formatCoverage(value) {
  if (value === undefined || value === null) {
    return '—';
  }
  if (typeof value === 'number') {
    return `${value.toFixed(1)}%`;
  }
  return String(value);
}

function isNotApplicable(value) {
  return String(value || '').toLowerCase() === 'na';
}

function selectStatus(statusKey) {
  selectedStatus.value = statusKey;
}

function getHighlightParts(text) {
  const source = String(text || '');
  const query = searchQuery.value.trim();

  if (!query) {
    return [{ text: source, matched: false }];
  }

  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts = [];
  let fromIndex = 0;
  let matchIndex = lowerSource.indexOf(lowerQuery, fromIndex);

  while (matchIndex !== -1) {
    if (matchIndex > fromIndex) {
      parts.push({ text: source.slice(fromIndex, matchIndex), matched: false });
    }

    parts.push({ text: source.slice(matchIndex, matchIndex + query.length), matched: true });
    fromIndex = matchIndex + query.length;
    matchIndex = lowerSource.indexOf(lowerQuery, fromIndex);
  }

  if (fromIndex < source.length) {
    parts.push({ text: source.slice(fromIndex), matched: false });
  }

  return parts.length ? parts : [{ text: source, matched: false }];
}
</script>

<template>
  <div class="module-group">
      <div class="filter-controls">
        <input
          v-model="searchQuery"
          type="search"
          class="search-input"
          placeholder="Search modules..."
          aria-label="Search modules"
        >

        <div class="status-chips" role="group" aria-label="Filter by status">
          <button
            v-for="status in statusFilters"
            :key="status.key"
            type="button"
            class="status-chip"
            :class="{ active: selectedStatus === status.key }"
            @click="selectStatus(status.key)"
          >
            {{ status.label }} ({{ statusCounts.get(status.key) || 0 }})
          </button>
        </div>
      </div>

      <p v-if="moduleGroups.length === 0" class="empty-state">
        No modules match current filters.
      </p>

      <details v-for="group in moduleGroups" :key="group.name" :open="hasActiveFilters">
        <summary>{{ group.name }} ({{ group.rows.length }})</summary>
        <table class="module-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in group.rows" :key="row.module">
              <td>
                <template v-for="(part, index) in getHighlightParts(row.module)" :key="`${row.module}-${index}`">
                  <mark v-if="part.matched">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </td>
              <td>
                <div>
                  <template v-if="row.status === 'not-serialized'">Not serialized</template>
                  <template v-else-if="row.status === 'available'">
                          <div>✓</div>
                          <small>{{ row.version || '—' }}</small>
                      </template>
                      <template v-else-if="isNotApplicable(row.version) || row.status === 'na'">⊘</template>
                      <template v-else-if="row.status === 'partially-implemented'">{{ formatCoverage(moduleCoverage?.get(row.module)?.coverage) }}<div>completed</div></template>
                      <template v-else>—</template>
                  </div>
              </td>
            </tr>
          </tbody>
        </table>
      </details>
  </div>
</template>

<style scoped>
.filter-controls {
  margin-bottom: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.4rem;
  margin-bottom: 0.5rem;
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.status-chip {
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 0.2rem 0.65rem;
  font-size: 0.8rem;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.status-chip.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.empty-state {
  margin: 0.25rem 0 0.75rem;
  color: var(--vp-c-danger-1);
  font-weight: 600;
}

.module-group summary {
  cursor: pointer;
  font-weight: 600;
}

.module-table {
  width: 100%;
  display: inline-table !important;
}

.module-table td {
	text-align: center;
}

.module-table th {
	text-align: center;
}
</style>