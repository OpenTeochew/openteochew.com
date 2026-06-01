<template>
  <div v-if="loading" style="text-align:center;padding:80px 0;color:var(--muted)">載入中…</div>
  <div v-else-if="!article" style="text-align:center;padding:80px 0;color:var(--muted)">文章未找到</div>
  <div v-else>
    <div class="container breadcrumb">
      <router-link :to="{ name: 'ReadHome' }">Thak</router-link> › 語料與文本 › <span style="color:var(--fg)">{{ article.title }}</span>
    </div>
    <div class="container">
      <div class="read-layout">
        <article class="read-main">
          <div class="read-meta">
            <span class="read-tag" v-if="article.source">{{ article.source.type }}</span>
          </div>
          <h1 class="read-title">{{ article.title }}</h1>
          <div class="markdown-body" v-html="renderedContent"></div>
        </article>
        <aside v-if="tocItems.length" class="toc-sidebar">
          <p class="toc-title">目錄</p>
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
import { marked } from 'marked'
import { articlesApi } from '../../api/articles'
import type { Article } from '../../types/article'

const props = defineProps({ id: { type: [String, Number], required: true } })

const loading = ref(true)
const article = ref<Article | null>(null)
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
