<template>
  <div
    v-if="visible"
    class="selection-popover"
    :style="{ top: y + 'px', left: x + 'px' }"
    @mousedown.prevent
  >
    <button class="selection-popover-btn" @click="onClick">
      {{ t2s('校訂選中部分') }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useSimplified } from '../composables/useSimplified'
const { t2s } = useSimplified()

const props = defineProps({
  container: { type: Object, default: null },
})
const emit = defineEmits(['select'])

const visible = ref(false)
const x = ref(0)
const y = ref(0)
const currentText = ref('')

function checkSelection() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    visible.value = false
    return
  }
  const text = sel.toString().trim()
  if (!text) { visible.value = false; return }

  const range = sel.getRangeAt(0)
  const containerEl = props.container?.value || props.container
  if (containerEl && !containerEl.contains(range.commonAncestorContainer)) {
    visible.value = false
    return
  }
  if (text.length > 500) {
    visible.value = false
    return
  }
  const rect = range.getBoundingClientRect()
  const scrollY = window.scrollY || window.pageYOffset
  const scrollX = window.scrollX || window.pageXOffset
  x.value = Math.min(rect.right + scrollX + 4, window.innerWidth - 100 + scrollX)
  y.value = rect.bottom + scrollY + 4
  currentText.value = text
  visible.value = true
}

function onClick() {
  emit('select', currentText.value)
  window.getSelection()?.removeAllRanges()
  visible.value = false
}

function onMouseUp() { setTimeout(checkSelection, 10) }
function onSelectionChange() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) visible.value = false
}
function onScroll() { visible.value = false }

onMounted(() => {
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('touchend', onMouseUp)
  document.addEventListener('selectionchange', onSelectionChange)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('touchend', onMouseUp)
  document.removeEventListener('selectionchange', onSelectionChange)
  window.removeEventListener('scroll', onScroll, true)
})
</script>
