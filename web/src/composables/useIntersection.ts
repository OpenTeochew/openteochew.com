import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useIntersection(callback: (id: string) => void) {
  const observer = ref<IntersectionObserver | null>(null)
  const observedElements = ref<Map<string, HTMLElement>>(new Map())

  function observe(id: string, el: HTMLElement) {
    observedElements.value.set(id, el)
    observer.value?.observe(el)
  }

  function unobserve(el: HTMLElement) {
    observer.value?.unobserve(el)
  }

  onMounted(() => {
    observer.value = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = [...observedElements.value.entries()]
              .find(([, el]) => el === entry.target)?.[0]
            if (id) callback(id)
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )
  })

  onBeforeUnmount(() => {
    observer.value?.disconnect()
  })

  return { observe, unobserve }
}
