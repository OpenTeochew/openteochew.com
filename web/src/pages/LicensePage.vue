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
          <p class="lead">
            {{ t2s('本站的結構化數據（詞條、OCR 校訂）以 CC0 授權，') }}
            <a href="https://github.com/OpenTeochew/openteochew.com/blob/main/LICENSE" target="_blank" rel="noopener">{{ t2s('代碼') }}</a>
            {{ t2s('以 MIT 授權。原書文獻與掃描影像版權因來源而異，詳見下方明細。') }}
          </p>
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
          <p class="meta-text">{{ t2s('最後更新：2026-06-23') }}</p>
        </div>
      </div>
    </section>
  </main>
</template>
