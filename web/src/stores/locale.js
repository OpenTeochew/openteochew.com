import { ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'openteochew-locale'

export const useLocaleStore = defineStore('locale', () => {
  const simplified = ref(false)
  const converter = ref(null)

  async function loadConverter() {
    if (converter.value) return
    const OpenCC = await import('opencc-js')
    converter.value = OpenCC.Converter({ from: 'tw', to: 'cn' })
  }

  function applyFont() {
    document.documentElement.classList.toggle('lang-simplified', simplified.value)
  }

  async function init() {
    const pref = localStorage.getItem(STORAGE_KEY)
    if (pref === 'simplified') {
      simplified.value = true
      await loadConverter()
    }
    applyFont()
  }

  async function toggle() {
    simplified.value = !simplified.value
    localStorage.setItem(STORAGE_KEY, simplified.value ? 'simplified' : 'traditional')
    if (simplified.value && !converter.value) {
      await loadConverter()
    }
    if (simplified.value) {
      if (!document.documentElement.dataset.origTitle) {
        document.documentElement.dataset.origTitle = document.title
      }
      document.title = t2s(document.documentElement.dataset.origTitle)
    } else {
      document.title = document.documentElement.dataset.origTitle || document.title
    }
    applyFont()
  }

  function t2s(text) {
    if (!simplified.value || !converter.value || !text) return text
    return converter.value(text)
  }

  return { simplified, converter, init, toggle, t2s }
})
