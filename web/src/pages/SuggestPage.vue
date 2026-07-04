<script setup>
import SuggestForm from '../components/SuggestForm.vue'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()
</script>

<template>
  <main>
    <section class="section">
      <div class="container" style="max-width: 720px;">
        <div class="about-hero">
          <h1>{{ t2s('反饋建議') }}</h1>
          <p class="lead">{{ t2s('歡迎提交網站功能反饋、資料貢獻，或您在瀏覽時想到的任何建議。') }}</p>
          <p class="meta-text" style="margin-top: 12px;">
            {{ t2s('若您想回報特定頁面的 OCR 或翻譯錯誤，也可以直接在該頁面劃選文字後點擊「校訂選中部分」。') }}
          </p>
        </div>
        <div class="about-section">
          <SuggestForm
            initial-category="feedback"
            :show-selected-text="false"
            :show-cancel="false"
          />
        </div>
      </div>
    </section>
  </main>
</template>
