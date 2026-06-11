import { useLocaleStore } from '../stores/locale'

export function useSimplified() {
  const locale = useLocaleStore()
  return {
    simplified: locale.simplified,
    t2s: locale.t2s
  }
}
