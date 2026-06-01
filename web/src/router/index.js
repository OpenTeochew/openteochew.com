import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../pages/HomePage.vue')
  },
  {
    path: '/chhe',
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
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

const titles = {
  Home: '開放潮州話 OpenTeochew',
  SearchHome: '查 Chhe — 開放潮州話',
  SearchResults: '搜尋結果 — 開放潮州話',
  EntryDetail: '詞條 — 開放潮州話',
  ReadHome: '讀 Thak — 開放潮州話',
  ArticleReader: '閱讀 — 開放潮州話',
  SourceViewer: '來源 — 開放潮州話'
}

router.afterEach((to) => {
  document.title = titles[to.name] || '開放潮州話 OpenTeochew'
})

export default router
