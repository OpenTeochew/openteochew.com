import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'SearchHome',
    component: () => import('../pages/chhe/SearchHome.vue')
  },
  {
    path: '/chhe/results',
    name: 'SearchResults',
    component: () => import('../pages/chhe/SearchResults.vue')
  },
  {
    path: '/chhe/entry/:id',
    name: 'EntryDetail',
    component: () => import('../pages/chhe/EntryDetail.vue'),
    props: true
  },
  {
    path: '/thak',
    name: 'ReadHome',
    component: () => import('../pages/thak/ReadHome.vue')
  },
  {
    path: '/thak/article/:id',
    name: 'ArticleReader',
    component: () => import('../pages/thak/ArticleReader.vue'),
    props: true
  },
  {
    path: '/thak/source/:id',
    name: 'SourceViewer',
    component: () => import('../pages/thak/SourceViewer.vue'),
    props: true
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../pages/AboutPage.vue')
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

const titles = {
  SearchHome: '查 Chhê — 潮州話開放資料庫',
  SearchResults: '搜尋結果 — 潮州話開放資料庫',
  EntryDetail: '詞條 — 潮州話開放資料庫',
  ReadHome: '讀 Tha̍k — 潮州話開放資料庫',
  ArticleReader: '閱讀 — 潮州話開放資料庫',
  SourceViewer: '來源 — 潮州話開放資料庫',
  About: '關於 — 潮州話開放資料庫'
}

const t2sSimple = (() => {
  let converter = null
  return async (text) => {
    if (localStorage.getItem('openteochew-locale') !== 'simplified') return text
    if (!converter) {
      const OpenCC = await import('opencc-js')
      converter = OpenCC.Converter({ from: 'tw', to: 'cn' })
    }
    return converter(text)
  }
})()

router.afterEach(async (to) => {
  let title = titles[to.name] || '潮州話開放資料庫 OpenTeochew'
  title = await t2sSimple(title)
  document.title = title
})

export default router
