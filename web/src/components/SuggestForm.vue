<template>
  <div v-if="submitted" class="thanks">
    {{ t2s('感謝您的建議！') }}
  </div>
  <form v-else class="suggest-form" @submit.prevent="onSubmit">
    <label>{{ t2s('類別') }}</label>
    <div class="radio-group">
      <label><input type="radio" value="text_revision" v-model="category"> {{ t2s('文本修訂') }}</label>
      <label><input type="radio" value="data_contribution" v-model="category"> {{ t2s('資料貢獻') }}</label>
      <label><input type="radio" value="feedback" v-model="category"> {{ t2s('反饋建議') }}</label>
    </div>

    <template v-if="showSelectedText && selectedText">
      <label>{{ t2s('原文片段') }}</label>
      <div class="selected-preview">{{ selectedText }}</div>
    </template>

    <label>{{ t2s('補充說明') }} <span class="char-count">{{ userNote.length }}/500</span></label>
    <textarea rows="4" v-model="userNote" maxlength="500" :placeholder="t2s('請描述問題或建議')"></textarea>

    <label>{{ t2s('Email（選填，方便回覆）') }}</label>
    <input type="email" v-model="email" maxlength="254" placeholder="you@example.com" />

    <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

    <div class="actions">
      <button v-if="showCancel" type="button" class="btn-secondary" @click="$emit('cancel')">{{ t2s('取消') }}</button>
      <button type="submit" class="btn-primary" :disabled="submitting || !canSubmit">
        {{ submitting ? t2s('提交中…') : t2s('提交') }}
      </button>
    </div>
  </form>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { suggestionsApi } from '../api/suggestions'
import { useSimplified } from '../composables/useSimplified'

const props = defineProps({
  initialCategory: { type: String, default: 'feedback' },
  initialSelectedText: { type: String, default: '' },
  sourceId: { type: Number, default: null },
  pageNum: { type: Number, default: null },
  showCancel: { type: Boolean, default: false },
  showSelectedText: { type: Boolean, default: false },
})

const emit = defineEmits(['submitted', 'cancel'])

const { t2s } = useSimplified()

const category = ref(props.initialCategory)
const selectedText = ref(props.initialSelectedText || '')
const userNote = ref('')
const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const errorMsg = ref('')

watch(() => props.initialSelectedText, (v) => { selectedText.value = v || '' })
watch(() => props.initialCategory, (v) => { category.value = v })

const canSubmit = computed(() => {
  return (selectedText.value.trim().length > 0) || (userNote.value.trim().length > 0)
})

async function onSubmit() {
  errorMsg.value = ''
  submitting.value = true
  try {
    await suggestionsApi.submit({
      category: category.value,
      source_id: props.sourceId || undefined,
      page_num: props.pageNum || undefined,
      url: window.location.href,
      selected_text: selectedText.value.trim() || undefined,
      user_note: userNote.value.trim() || undefined,
      email: email.value.trim() || undefined,
    })
    submitted.value = true
    emit('submitted')
  } catch (e) {
    errorMsg.value = e.message || t2s('提交失敗，請稍後再試')
  } finally {
    submitting.value = false
  }
}
</script>
