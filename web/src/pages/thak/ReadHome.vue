<template>
  <main>
    <section class="section thak-hero">
      <div class="container" style="max-width: 680px;">
        <h1>讀潮州話</h1>
        <p class="lead">瀏覽原始字典頁面，閱讀語料與潮州話文本。所有資料標明出處，開放使用。</p>
        <div class="cat-tabs">
          <button v-for="(t, i) in catTabs" :key="t" class="cat-tab" :class="{ active: activeCat === i }" @click="activeCat = i">{{ t }}</button>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2>字典原書</h2>
        <div class="dict-grid">
          <router-link v-for="d in dicts" :key="d.title" :to="{ name: 'SourceViewer', params: { id: d.id } }" class="dict-card">
            <div class="dict-cover" v-html="d.cover"></div>
            <div class="dict-info">
              <h3>{{ d.title }}</h3>
              <p>{{ d.desc }}</p>
              <div class="dict-meta">
                <span class="dict-tag">{{ d.badge }}</span>
                <span class="dict-tag">{{ d.license }}</span>
                <span class="meta-text">{{ d.pages }} 頁</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
          <h2 style="margin-bottom:0">語料與文本</h2>
          <span class="meta-text">持續更新</span>
        </div>
        <div class="article-list">
          <router-link v-for="a in articles" :key="a.title" :to="{ name: 'ArticleReader', params: { id: a.id } }" class="article-row">
            <span class="article-date">{{ a.category }}</span>
            <div>
              <span class="article-title">{{ a.title }}</span>
              <p class="article-desc">{{ a.desc }}</p>
            </div>
            <span class="article-type">{{ a.type }}</span>
          </router-link>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { ref } from 'vue'

const activeCat = ref(0)
const catTabs = ['全部', '字典原書', '語料文本', '教材']

const dicts = [
  { id: 'ashmore1883', cover: 'Ashmore<br>1883', title: 'A Dictionary of the Swatow Dialect', desc: '最早系統性的潮州話英漢字典，收錄大量口語詞彙與實用例句。', badge: 'S 級', license: '公共領域', pages: '—' },
  { id: 'campbell1904', cover: 'Campbell<br>1904', title: 'A Swatow Index to the Syllabic Dictionary of Chinese', desc: '以潮州話音序編排的漢字索引，收字量大，注音精確，是研究潮州音系的重要參考。', badge: 'S 級', license: '公共領域', pages: '—' },
  { id: 'giles1877', cover: 'Giles<br>1877', title: 'English-Chinese Vocabulary of the Vernacular or Spoken Language of Swatow', desc: '早期潮州話英漢詞彙對照手冊，側重日常會話用語。', badge: 'A 級', license: '公共領域', pages: '—' },
  { id: 'ashmore-primer', cover: 'Ashmore<br>Primer', title: 'Primer of the Swatow Dialect', desc: '潮州話入門教材，包含基礎對話、文法說明與白話字書寫範例。', badge: 'B 級', license: '公共領域', pages: '—' }
]

const articles = [
  { id: 'greetings', category: '語料', title: '潮州話日常問候語', desc: '收錄常見的潮州話打招呼、問候、道別用語，附白話字拼音與普通話翻譯。', type: '文本' },
  { id: 'food-vocab', category: '語料', title: '潮州飲食詞彙', desc: '潮州話中的飲食相關詞彙整理，涵蓋食材、烹飪方式、菜名與小吃。', type: '文本' },
  { id: 'kinship', category: '語料', title: '潮州話親屬稱謂', desc: '潮州話中完整的親屬稱謂系統，從直系到旁系，含拼音與對照。', type: '文本' },
  { id: 'hymns', category: '文獻', title: '潮州白話字讚美詩選', desc: '十九世紀末至二十世紀初，以潮州白話字書寫的教會讚美詩。', type: '宗教文獻' },
  { id: 'folktales', category: '文獻', title: '潮州民間故事選', desc: '以潮州話記錄的民間故事與傳說，保留口語風貌。', type: '文學' }
]
</script>
