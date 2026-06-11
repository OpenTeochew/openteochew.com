import { useLocaleStore } from '../stores/locale'

export function useSimplified() {
  const locale = useLocaleStore()

  function isDifferent(text) {
    if (!locale.simplified || !text) return false
    const converted = locale.t2s(text)
    return converted !== text
  }

  return {
    simplified: locale.simplified,
    t2s: locale.t2s,
    isDifferent
  }
}
