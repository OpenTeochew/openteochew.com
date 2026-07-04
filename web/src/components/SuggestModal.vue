<template>
  <div v-if="open" class="suggest-modal-overlay" @click.self="onClose">
    <div class="suggest-modal">
      <h2>{{ t2s('提交建議') }}</h2>
      <SuggestForm
        :initial-category="initialCategory"
        :initial-selected-text="initialSelectedText"
        :source-id="sourceId"
        :page-num="pageNum"
        :show-cancel="true"
        :show-selected-text="true"
        @cancel="onClose"
        @submitted="onSubmitted"
      />
    </div>
  </div>
</template>

<script setup>
import SuggestForm from './SuggestForm.vue'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()

defineProps({
  open: { type: Boolean, default: false },
  initialCategory: { type: String, default: 'text_revision' },
  initialSelectedText: { type: String, default: '' },
  sourceId: { type: Number, default: null },
  pageNum: { type: Number, default: null },
})

const emit = defineEmits(['close', 'submitted'])

function onClose() { emit('close') }
function onSubmitted() {
  setTimeout(() => emit('close'), 2000)
  emit('submitted')
}
</script>
