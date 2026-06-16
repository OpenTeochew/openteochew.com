<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">{{ t2s('載入中…') }}</div>
  <div v-else-if="!entry" style="text-align:center;padding:80px 0;color:var(--muted)">{{ t2s('詞條未找到') }}</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'SearchHome' }">Chhe</router-link> › <router-link :to="{ name: 'SearchResults' }">{{ t2s('搜索') }}「{{ entry.han_orig ? stripAnno(entry.han_orig) : (entry.han || '') }}」</router-link> › {{ t2s('詞條詳情') }}
    </div>
    <main>
      <section class="entry-header container">
        <div class="entry-header-inner">
          <div>
            <div class="entry-char" v-html="formatField(entry.han, entry.han_orig, isFieldAnnotated(entry.source?.original_fields ?? null, 'han'))"></div>
            <div v-if="isDifferent(entry.han)" class="entry-simplified"><span class="simplified-badge">简</span>{{ t2s(entry.han) }}</div>
          </div>
          <div class="entry-info">
            <div class="entry-puj" v-html="formatField(entry.puj, entry.puj_orig, isFieldAnnotated(entry.source?.original_fields ?? null, 'puj'))"></div>
            <div class="entry-readings">
              <div class="reading-row"><span class="reading-label">PUJ</span><span class="reading-value" v-html="formatField(entry.puj, entry.puj_orig, isFieldAnnotated(entry.source?.original_fields ?? null, 'puj'))"></span></div>
              <div class="reading-row"><span class="reading-label">DP</span><span class="reading-value" v-html="formatField(entry.dp, null, isFieldAnnotated(entry.source?.original_fields ?? null, 'dp'))"></span></div>
            </div>
            <div class="entry-actions">
              <button class="entry-audio-btn" @click="toggleAudio">
                <svg viewBox="0 0 24 24" fill="currentColor" v-html="audioPlaying ? '<rect x=\'6\' y=\'4\' width=\'4\' height=\'16\'/><rect x=\'14\' y=\'4\' width=\'4\' height=\'16\'/>' : '<path d=\'M8 5v14l11-7z\'/>'"></svg>
                {{ t2s('播放讀音') }}
              </button>
              <button class="share-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                {{ t2s('分享') }}
              </button>
            </div>
          </div>
        </div>
      </section>
      <section class="section defs-section container">
        <h2>{{ t2s('釋義') }}</h2>
        <div class="def-tabs" role="tablist">
          <button v-for="tab in defTabs" :key="tab.key" class="def-tab" :class="{ active: activeTab === tab.key }" role="tab" @click="activeTab = tab.key">{{ tab.label }}</button>
        </div>
        <div v-for="tab in defTabs" :key="tab.key" class="def-panel" :class="{ active: activeTab === tab.key }">
          <div v-for="d in tab.definitions" :key="d.source" class="def-block">
            <p class="def-source">{{ d.source }}<router-link v-if="d.pageNum" :to="{ name: 'SourceViewer', params: { id: d.sourceId }, query: { page: d.pageNum } }" class="src-link-inline" target="_blank">{{ t2s('原冊') }}</router-link></p>
            <p class="def-text" v-html="d.text"></p>
          </div>
        </div>
      </section>
      <section v-if="examples.length" class="section examples-section container">
        <h2>{{ t2s('例句') }}</h2>
        <div class="example-list">
          <div v-for="ex in examples" :key="ex.teochew" class="example-item">
            <p class="example-teochew">{{ ex.teochew }}<span v-if="isDifferent(ex.teochew)" class="rt-simplified"><span class="simplified-badge">简</span>{{ t2s(ex.teochew) }}</span></p>
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
import { formatField, renderAnno, stripAnno, esc, isFieldAnnotated } from '../../composables/formatField'
import { useSimplified } from '../../composables/useSimplified'
const { simplified, t2s, isDifferent } = useSimplified()

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

  const fmt = (val, orig, isAnnotated) => {
    if (!val && !orig) return ''
    if (isAnnotated) {
      return `<span class="rt-annotated"><span class="annotated-badge">注</span>${esc(val || '')}</span>`
    }
    if (!orig) return esc(val || '')
    const stripped = stripAnno(esc(orig))
    const revised = renderAnno(esc(val || ''))
    const revisedText = revised.replace(/<[^>]*>/g, '').trim()
    return revisedText ? `${stripped}<span class="rt-revised"><span class="revised-badge">校</span>${revised}</span>` : stripped
  }
  const fmtHan = (e, src) => fmt(e.han, e.han_orig, isFieldAnnotated(src?.original_fields ?? null, 'han'))
  const fmtPuj = (e, src) => fmt(e.puj, e.puj_orig, isFieldAnnotated(src?.original_fields ?? null, 'puj'))
  const fmtEn = (e, src) => fmt(e.en, e.en_orig, isFieldAnnotated(src?.original_fields ?? null, 'en'))

  const currentDef = {
    source: `${entry.value.source.name}${entry.value.page_num ? ' · p. ' + entry.value.page_num : ''}`,
    text: `<strong>${fmtHan(entry.value, entry.value.source)} ${fmtPuj(entry.value, entry.value.source)}</strong> — ${fmtEn(entry.value, entry.value.source)}`,
    pageNum: entry.value.page_num,
    sourceId: entry.value.source.id
  }

  const tabs = [{
    key: 'all',
    label: t2s('全部來源'),
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
        text: `<strong>${fmtHan(e, group.source)} ${fmtPuj(e, group.source)}</strong> — ${fmtEn(e, group.source)}`,
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
