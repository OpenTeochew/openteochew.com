<template>
  <div>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'SearchHome' }">Tshue</router-link> › <router-link :to="{ name: 'SearchResults' }">搜索「食」</router-link> › 詞條詳情
    </div>
    <main>
      <section class="entry-header container">
        <div class="entry-header-inner">
          <div class="entry-char">食</div>
          <div class="entry-info">
            <div class="entry-puj">tsia̍h</div>
            <div class="entry-readings">
              <div class="reading-row"><span class="reading-label">PUJ</span><span class="reading-value">tsia̍h</span></div>
              <div class="reading-row"><span class="reading-label">DP</span><span class="reading-value">ziah8</span></div>
              <div class="reading-row"><span class="reading-label">異體</span><span class="reading-value">𠊎（古寫）</span></div>
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
            <p class="def-source">{{ d.source }}</p>
            <p class="def-text" v-html="d.text"></p>
          </div>
        </div>
      </section>
      <section class="section examples-section container">
        <h2>例句</h2>
        <div class="example-list">
          <div v-for="ex in examples" :key="ex.teochew" class="example-item">
            <p class="example-teochew">{{ ex.teochew }}</p>
            <p class="example-puj">{{ ex.puj }}</p>
            <p class="example-translation">{{ ex.translation }}</p>
          </div>
        </div>
      </section>
      <section class="section related-section container">
        <h2>相關詞</h2>
        <div class="related-grid">
          <router-link v-for="r in related" :key="r.char" :to="{ name: 'EntryDetail', params: { id: '1' } }" class="related-chip">
            <span class="related-char">{{ r.char }}</span>
            <span class="related-puj">{{ r.puj }}</span>
          </router-link>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({ id: { type: [String, Number], required: true } })

const audioPlaying = ref(false)

function toggleAudio() {
  audioPlaying.value = !audioPlaying.value
}

const activeTab = ref('all')

const defTabs = [
  {
    key: 'all', label: '全部來源',
    definitions: [
      { source: 'Ashmore 1883 · p. 42', text: '<strong>食 tsia̍h</strong> — to eat; to take food; to consume. Used broadly for any act of eating or drinking, e.g. 食飯 (eat rice), 食茶 (drink tea), 食酒 (drink wine).' },
      { source: 'Campbell 1904 · no. 3847', text: '<strong>食 tsia̍h</strong> — eat; food; meal; to live on. A very common character in Swatow vernacular. 食力 (eat strength) = to take pains. 食力人 = a hard worker.' },
      { source: '潮汕方言詞典 · p. 128', text: '<strong>食 tsia̍h</strong> — 吃。泛指進食、飲用。潮州話中「食」的用法比普通話「吃」更廣，涵蓋吃喝。如：食飯（吃飯）、食茶（喝茶）、食藥（吃藥）。' }
    ]
  },
  {
    key: 'ashmore', label: 'Ashmore 1883',
    definitions: [
      { source: 'Ashmore 1883 · p. 42', text: '<strong>食 tsia̍h</strong> — to eat; to take food; to consume. Used broadly for any act of eating or drinking, e.g. 食飯 (eat rice), 食茶 (drink tea), 食酒 (drink wine).' }
    ]
  },
  {
    key: 'campbell', label: 'Campbell 1904',
    definitions: [
      { source: 'Campbell 1904 · no. 3847', text: '<strong>食 tsia̍h</strong> — eat; food; meal; to live on. A very common character in Swatow vernacular. 食力 (eat strength) = to take pains. 食力人 = a hard worker.' }
    ]
  },
  {
    key: 'modern', label: '潮汕方言詞典',
    definitions: [
      { source: '潮汕方言詞典 · p. 128', text: '<strong>食 tsia̍h</strong> — 吃。泛指進食、飲用。潮州話中「食」的用法比普通話「吃」更廣，涵蓋吃喝。如：食飯（吃飯）、食茶（喝茶）、食藥（吃藥）。' }
    ]
  }
]

const examples = [
  { teochew: '食飯未？', puj: 'Tsia̍h-pūng buē?', translation: '吃了飯嗎？（打招呼用語）' },
  { teochew: '我欲食潮州粿條。', puj: 'Uá ài tsia̍h Tiê-tsiu kóe-tiâu.', translation: '我想吃潮州粿條。' },
  { teochew: '食茶好過食酒。', puj: 'Tsia̍h tê hó kè tsia̍h tsiú.', translation: '喝茶比喝酒好。' }
]

const related = [
  { char: '食飯', puj: 'tsia̍h-pūng' },
  { char: '食茶', puj: 'tsia̍h-tê' },
  { char: '食酒', puj: 'tsia̍h-tsiú' },
  { char: '食藥', puj: 'tsia̍h-io̍h' },
  { char: '食物', puj: 'tsia̍h-mi̍h' },
  { char: '飽', puj: 'pá' },
  { char: '餓', puj: 'gō' },
  { char: '煮', puj: 'tsú' }
]
</script>
