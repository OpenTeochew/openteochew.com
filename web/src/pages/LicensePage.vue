<script setup>
import { ref, onMounted } from 'vue'
import { sourcesApi } from '../api/sources'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()

const sources = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    sources.value = await sourcesApi.getAll()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main>
    <section class="section">
      <div class="container" style="max-width: 920px;">
        <div class="about-hero">
          <h1>{{ t2s('版權聲明') }}</h1>
          <p class="lead">{{ t2s('本站內容的版權分為三個層次，以下逐一說明。') }}</p>
        </div>

        <div class="about-section">
          <h2>{{ t2s('三層版權模型') }}</h2>
          <table class="license-table">
            <thead>
              <tr>
                <th>{{ t2s('層次') }}</th>
                <th>{{ t2s('版權') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="col-src">{{ t2s('原書文獻') }}<br><span class="col-pub">{{ t2s('19-20 世紀古籍') }}</span></td>
                <td>{{ t2s('公共領域') }}</td>
              </tr>
              <tr>
                <td class="col-src">{{ t2s('掃描影像') }}</td>
                <td>{{ t2s('因來源而異，見下方明細') }}</td>
              </tr>
              <tr>
                <td class="col-src">{{ t2s('結構化數據') }}<br><span class="col-pub">{{ t2s('詞條、OCR 校訂') }}</span></td>
                <td>CC0</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="about-section">
          <h2>{{ t2s('來源版權明細') }}</h2>
          <p v-if="loading" class="meta-text">{{ t2s('載入中…') }}</p>
          <table v-else class="license-table">
            <thead>
              <tr>
                <th>{{ t2s('書名') }}</th>
                <th>{{ t2s('作者') }}</th>
                <th>{{ t2s('年份') }}</th>
                <th>{{ t2s('原書') }}</th>
                <th>{{ t2s('掃描影像') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="src in sources" :key="src.id">
                <td>
                  <router-link :to="`/thak/source/${src.id}`">
                    {{ t2s(src.name_zh || src.name) }}
                  </router-link>
                </td>
                <td>{{ src.author ? t2s(src.author) : '—' }}</td>
                <td class="col-pub">{{ src.year || '—' }}</td>
                <td class="col-pub">{{ t2s('公共領域') }}</td>
                <td class="col-scan">{{ src.scan_source ? t2s(src.scan_source) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="about-section">
          <h2>{{ t2s('授權聲明') }}</h2>
          <ul class="about-list">
            <li>
              <strong>{{ t2s('結構化數據') }}</strong>
              <p>{{ t2s('詞條、OCR 校訂文字以 CC0 公共領域授權發布，允許自由使用。') }}</p>
            </li>
            <li>
              <strong>{{ t2s('代碼') }}</strong>
              <p><a href="https://github.com/OpenTeochew/openteochew.com/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a></p>
            </li>
          </ul>
        </div>

        <div class="about-section">
          <p class="meta-text">{{ t2s('最後更新：2026-06-23') }}</p>
        </div>
      </div>
    </section>
  </main>
</template>
