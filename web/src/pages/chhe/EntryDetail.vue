<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">載入中…</div>
  <div v-else-if="!entry" style="text-align:center;padding:80px 0;color:var(--muted)">詞條未找到</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'SearchHome' }">Chhe</router-link> › <router-link :to="{ name: 'SearchResults' }">搜索「{{ entry.han }}」</router-link> › 詞條詳情
    </div>
    <main>
      <section class="entry-header container">
        <div class="entry-header-inner">
          <div class="entry-char">{{ entry.han }}</div>
          <div class="entry-info">
            <div class="entry-puj">{{ entry.puj }}</div>
            <div class="entry-readings">
              <div class="reading-row"><span class="reading-label">PUJ</span><span class="reading-value">{{ entry.puj }}</span></div>
              <div class="reading-row"><span class="reading-label">DP</span><span class="reading-value">{{ entry.dp }}</span></div>
            </div>
            <div class="entry-actions">
              <button class="entry-audio-btn" @click="toggleAudio">
                <svg viewBox="0 0 24 24" fill="currentColor" v-html="audioPlaying ? '<rect x=\'6\' y=\'4\' width=\'4\' height=\'16\'/><rect x=\'14\' y=\'4\' width=\'4\' height=\'16\'/>' : '<path d=\'M8 5v14l11-7z\'/>'"></svg>
                播放讀音
              </button>
              <button class="share-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                分享
              </button>
            </div>
          </div>
        </div>
      </section>
      <section class="section defs-section container">
        <h2>釋義</h2>
        <div class="def-tabs" role="tablist">
          <button v-for="tab in defTabs" :key="tab.key" class="def-tab" :class="{ active: activeTab === tab.key }" role="tab" @click="activeTab = tab.key">{{ tab.label }}</button>
        </div>
        <div v-for="tab in defTabs" :key="tab.key" class="def-panel" :class="{ active: activeTab === tab.key }">
          <div v-for="d in tab.definitions" :key="d.source" class="def-block">
            <p class="def-source">{{ d.source }}<router-link v-if="d.pageNum" :to="{ name: 'SourceViewer', params: { id: d.sourceId }, query: { page: d.pageNum } }" class="src-link-inline" target="_blank">原冊</router-link></p>
            <p class="def-text" v-html="d.text"></p>
          </div>
        </div>
      </section>
      <section v-if="examples.length" class="section examples-section container">
        <h2>例句</h2>
        <div class="example-list">
          <div v-for="ex in examples" :key="ex.teochew" class="example-item">
            <p class="example-teochew">{{ ex.teochew }}</p>
            <p class="example-puj">{{ ex.puj }}</p>
            <p class="example-translation">{{ ex.translation }}</p>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { entriesApi } from '../../api/entries'
import { searchApi } from '../../api/search'

const props = defineProps({ id: { type: [String, Number], required: true } })

const audioPlaying = ref(false)
const loading = ref(true)
const entry = ref(null)
const crossSourceGroups = ref([])

function toggleAudio() {
  audioPlaying.value = !audioPlaying.value
}

const activeTab = ref('all')

const defTabs = computed(() => {
  if (!entry.value) return []

  const currentDef = {
    source: `${entry.value.source.name}${entry.value.page_num ? ' · p. ' + entry.value.page_num : ''}`,
    text: `<strong>${entry.value.han || ''} ${entry.value.puj || ''}</strong> — ${entry.value.en || ''}`,
    pageNum: entry.value.page_num,
    sourceId: entry.value.source.id
  }

  const tabs = [{
    key: 'all',
    label: '全部來源',
    definitions: [currentDef]
  }]

  const sourceTabs = {}
  sourceTabs[entry.value.source.name] = {
    key: `source-${entry.value.source.id}`,
    label: entry.value.source.name,
    definitions: [currentDef]
  }

  for (const group of crossSourceGroups.value) {
    if (group.source.id === entry.value.source.id) continue
    for (const e of group.entries) {
      const def = {
        source: `${group.source.name}${e.page_num ? ' · p. ' + e.page_num : ''}`,
        text: `<strong>${e.han || ''} ${e.puj || ''}</strong> — ${e.en || ''}`,
        pageNum: e.page_num,
        sourceId: group.source.id
      }
      tabs[0].definitions.push(def)

      if (!sourceTabs[group.source.name]) {
        sourceTabs[group.source.name] = {
          key: `source-${group.source.id}`,
          label: group.source.name,
          definitions: []
        }
      }
      sourceTabs[group.source.name].definitions.push(def)
    }
  }

  return [...tabs, ...Object.values(sourceTabs)]
})

const examples = computed(() => entry.value?.examples || [])

onMounted(async () => {
  try {
    entry.value = await entriesApi.getById(Number(props.id))

    if (entry.value?.han) {
      try {
        const result = await searchApi.search({ q_han: entry.value.han, limit: 50 })
        crossSourceGroups.value = result.groups
      } catch {}
    }
  } catch (e) {
    console.error('Failed to load entry:', e)
  } finally {
    loading.value = false
  }
})
</script>
