<script setup>
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()
</script>

<template>
  <main>
    <section class="section">
      <div class="container" style="max-width: 720px;">
        <div class="about-hero">
          <h1>{{ t2s('關於 OpenTeochew') }}</h1>
          <p class="lead">{{ t2s('匯集所有潮州話字典、詞典與語料，統一數字化，以開源授權公開發布。查詞、閱讀，一個平台到底。') }}</p>
        </div>
        <div class="principles">
          <h2>{{ t2s('核心理念') }}</h2>
          <div class="principle-list">
            <div class="principle-item"><strong>{{ t2s('匯集而非創建') }}</strong><p>{{ t2s('收錄、整理、歸檔已有的潮州話字典、詞典與語料，不憑空造詞。') }}</p></div>
            <div class="principle-item"><strong>{{ t2s('開放數據') }}</strong><p>{{ t2s('所有整理後的數據以 CC0 公共領域授權發布，允許自由使用、研究與二次開發。') }}</p></div>
            <div class="principle-item"><strong>{{ t2s('描述主義') }}</strong><p>{{ t2s('收錄各家流行的寫法、讀音、用法，包含公認正確的用法，也包含新興的、小眾的用法。') }}</p></div>
            <div class="principle-item"><strong>{{ t2s('來源透明') }}</strong><p>{{ t2s('每條結果標明原始字典、頁碼與版權狀態，可追溯至原始文獻。') }}</p></div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
