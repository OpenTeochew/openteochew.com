<template>
  <div>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › 語料與文本 › <span style="color:var(--fg)">潮州話日常問候語</span>
    </div>
    <div class="container">
      <div class="read-layout">
        <article class="read-main">
          <div class="read-meta">
            <span class="read-tag">語料</span>
            <span class="read-tag">文本</span>
            <span class="read-tag">日常用語</span>
          </div>
          <h1 class="read-title">潮州話日常問候語</h1>
          <p class="read-desc">潮州話中的日常打招呼、問候、道別用語。附白話字（PUJ）拼音與普通話翻譯。資料整理自 Ashmore (1883) 及 Campbell (1904)。</p>

          <div v-for="block in textBlocks" :key="block.id" class="text-block" :id="block.id">
            <h2>{{ block.title }}</h2>
            <div v-if="block.phrases" class="phrase-group">
              <div v-for="p in block.phrases" :key="p.teochew" class="phrase-row">
                <span class="phrase-teochew">{{ p.teochew }}</span>
                <span class="phrase-puj">{{ p.puj }}</span>
                <span class="phrase-trans">{{ p.trans }}</span>
              </div>
            </div>
            <div v-if="block.paragraphs">
              <div v-for="pg in block.paragraphs" :key="pg.teochew" class="paragraph-block">
                <p class="paragraph-teochew">{{ pg.teochew }}</p>
                <p class="paragraph-puj">{{ pg.puj }}</p>
                <p class="paragraph-trans">{{ pg.trans }}</p>
              </div>
            </div>
          </div>
        </article>
        <aside class="toc-sidebar">
          <p class="toc-title">目錄</p>
          <ul class="toc-list">
            <li v-for="block in textBlocks" :key="block.id">
              <a :href="'#' + block.id" class="toc-link" :class="{ active: activeSection === block.id }" @click.prevent="scrollTo(block.id)">{{ block.title }}</a>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineProps({ id: { type: [String, Number], required: true } })

const activeSection = ref('sec-greeting')
let observer = null

const textBlocks = [
  {
    id: 'sec-greeting', title: '見面問候',
    phrases: [
      { teochew: '食飯未？', puj: 'Tsia̍h-pūng buē?', trans: '吃了飯嗎？（最常見的問候語）' },
      { teochew: '汝好無？', puj: 'Lú hó--bô?', trans: '你好嗎？' },
      { teochew: '好久無見。', puj: 'Hó-kú bô kìⁿ.', trans: '好久不見。' },
      { teochew: '去底塊？', puj: 'Kì ti-tò?', trans: '去哪裡？' }
    ]
  },
  {
    id: 'sec-morning', title: '時段問候',
    phrases: [
      { teochew: '早安。', puj: 'Tsáⁿ-àiⁿ.', trans: '早安。' },
      { teochew: '下旰好。', puj: 'Ē-kù hó.', trans: '下午好。' },
      { teochew: '暗旰好。', puj: 'Àm-kù hó.', trans: '晚上好。' }
    ]
  },
  {
    id: 'sec-farewell', title: '道別',
    phrases: [
      { teochew: '再見。', puj: 'Tsài-kiàn.', trans: '再見。' },
      { teochew: '慢慢行。', puj: 'Bān-bān kiâⁿ.', trans: '慢走。（對離開的人說）' },
      { teochew: '請留步。', puj: 'Tshiáⁿ liû-pō͘.', trans: '請留步，不用送了。' },
      { teochew: '來𠊎𧹽。', puj: 'Lâi uá tsia̍h.', trans: '來我家吃飯（邀請）' }
    ]
  },
  {
    id: 'sec-example', title: '範例對話',
    paragraphs: [
      { teochew: 'A：阿明，食飯未？', puj: 'A: A-mêng, tsia̍h-pūng buē?', trans: 'A：阿明，吃了飯嗎？' },
      { teochew: 'B：食啦，汝呢？', puj: 'B: Tsia̍h--lah, lú ne?', trans: 'B：吃了，你呢？' },
      { teochew: 'A：猶未，欲去食。', puj: 'A: Iáu-buē, ài khì tsia̍h.', trans: 'A：還沒，要去吃。' },
      { teochew: 'B：慢慢食，我去先行。', puj: 'B: Bān-bān tsia̍h, uá khì seng kiâⁿ.', trans: 'B：慢慢吃，我先走了。' }
    ]
  },
  {
    id: 'sec-sources', title: '參考來源',
    phrases: [
      { teochew: '', puj: 'Ashmore, W. 1883. A Dictionary of the Swatow Dialect. Presbyterian Mission Press.', trans: '' },
      { teochew: '', puj: 'Campbell, W. 1904. A Swatow Index to the Syllabic Dictionary of Chinese. Presbyterian Mission Press.', trans: '' }
    ]
  }
]

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  const blocks = document.querySelectorAll('.text-block[id]')
  if (!blocks.length) return
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        activeSection.value = entry.target.id
      }
    })
  }, { rootMargin: '-20% 0px -60% 0px' })
  blocks.forEach((s) => observer.observe(s))
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>
