<template>
  <div class="container" style="max-width:640px;padding:32px 16px">
    <h1>{{ t2s('反饋建議') }}</h1>
    <p style="color:var(--muted);line-height:1.6">
      {{ t2s('歡迎提交網站功能反饋、資料貢獻，或您在瀏覽時想到的任何建議。') }}
    </p>
    <p style="color:var(--muted);font-size:13px">
      {{ t2s('若您想回報特定頁面的 OCR 或翻譯錯誤，也可以直接在該頁面劃選文字後點擊「回報這段」。') }}
    </p>
    <div style="margin-top:24px;padding:20px;background:var(--surface);border-radius:8px">
      <SuggestForm
        initial-category="feedback"
        :show-selected-text="false"
        :show-cancel="false"
      />
    </div>
  </div>
</template>

<script setup>
import SuggestForm from '../components/SuggestForm.vue'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()
</script>
