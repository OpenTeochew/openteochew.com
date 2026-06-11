<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">{{ t2s('載入中…') }}</div>
  <div v-else-if="!article" style="text-align:center;padding:80px 0;color:var(--muted)">{{ t2s('文章未找到') }}</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › {{ t2s('語料與文本') }} › <span style="color:var(--fg)">{{ article.title }}</span>
    </div>
    <div class="container">
      <div class="read-layout">
        <article class="read-main">
          <div class="read-meta">
            <span class="read-tag" v-if="article.source">{{ article.source.type === 'dictionary' ? t2s('辭書') : t2s('教材') }}</span>
          </div>
          <h1 class="read-title">{{ article.title }}</h1>
          <div class="markdown-body" v-html="renderedContent"></div>
        </article>
        <aside v-if="tocItems.length" class="toc-sidebar">
          <p class="toc-title">{{ t2s('目錄') }}</p>
          <ul class="toc-list">
            <li v-for="item in tocItems" :key="item.id">
              <a :href="'#' + item.id" class="toc-link" :class="{ active: activeSection === item.id }" @click.prevent="scrollTo(item.id)">{{ item.text }}</a>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Marked } from 'marked'
import { articlesApi } from '../../api/articles'
import { useSimplified } from '../../composables/useSimplified'

const { t2s } = useSimplified()

const marked = new Marked()
marked.use({
  renderer: {
    heading({ text, depth }) {
      const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-')
      return `<h${depth} id="${id}">${text}</h${depth}>`
    }
  }
})

const props = defineProps({ id: { type: [String, Number], required: true } })

const loading = ref(true)
const article = ref(null)
const activeSection = ref('')

const renderedContent = computed(() => {
  if (!article.value) return ''
  return marked.parse(article.value.content)
})

const tocItems = computed(() => {
  if (!article.value) return []
  const headings = []
  const matches = article.value.content.matchAll(/^#{1,3}\s+(.+)$/gm)
  for (const m of matches) {
    const text = m[1].trim()
    const id = text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-')
    headings.push({ id, text })
  }
  return headings
})

let observer = null

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  try {
    article.value = await articlesApi.getById(Number(props.id))

    setTimeout(() => {
      const blocks = tocItems.value.map(item => document.getElementById(item.id)).filter(Boolean)
      if (!blocks.length) return
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeSection.value = entry.target.id
          }
        })
      }, { rootMargin: '-20% 0px -60% 0px' })
      blocks.forEach((el) => observer.observe(el))
    }, 100)
  } catch (e) {
    console.error('Failed to load article:', e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})
</script>
