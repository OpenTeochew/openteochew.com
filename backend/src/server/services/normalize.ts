export type LatnSystem = 'puj' | 'dp'

export function normalizeToLatnNorm(input: string, system: LatnSystem): string[] {
  if (system === 'puj') return [normalizePuj(input)]
  return normalizeDp(input)
}

function normalizePuj(input: string): string {
  let result = input.replace(/\u207F/g, 'nn')
  result = result.replace(/(^|[-\s])tsh([aou])/g, '$1chh$2')
  result = result.replace(/(^|[-\s])ts([aou])/g, '$1ch$2')
  result = result.replace(/(^|[-\s])z([aou])/g, '$1j$2')
  return result
}

const DP_INITIAL_MAP: [string, string][] = [
  ['bh', 'b'],
  ['gh', 'g'],
  ['ng', 'ng'],
  ['c', 'chh'],
  ['z', 'ch'],
  ['r', 'j'],
  ['p', 'ph'],
  ['t', 'th'],
  ['k', 'kh'],
  ['b', 'p'],
  ['d', 't'],
  ['g', 'k'],
  ['m', 'm'],
  ['n', 'n'],
  ['s', 's'],
  ['l', 'l'],
  ['h', 'h'],
]

const DP_INITIALS = DP_INITIAL_MAP.map(([k]) => k).sort((a, b) => b.length - a.length)

const DP_ENTERING_ENDINGS: Record<string, string> = {
  b: 'p', d: 't', g: 'k', h: 'h',
}

function normalizeDp(input: string): string[] {
  const syllables = input.split(/[-\s]+/).filter((s) => s.length > 0)
  const candidatesPerSyllable = syllables.map(normalizeDpSyllable)
  return cartesian(candidatesPerSyllable).map((parts) => parts.join('-'))
}

function normalizeDpSyllable(syllable: string): string[] {
  const toneMatch = syllable.match(/^(.*?)([1-8])$/)
  const base = toneMatch ? toneMatch[1] : syllable
  const tone = toneMatch ? toneMatch[2] : ''

  let initial = ''
  let rest = base
  for (const dpInitial of DP_INITIALS) {
    if (base.startsWith(dpInitial)) {
      initial = dpInitial
      rest = base.substring(dpInitial.length)
      break
    }
  }

  const mappedInitial = DP_INITIAL_MAP.find(([k]) => k === initial)?.[1] ?? initial

  let vowel = rest
  let mappedEnding = ''
  const endingMatch = rest.match(/(ng|nn|b|d|g|h|m|n)$/)
  if (endingMatch) {
    const ending = endingMatch[1]
    vowel = rest.substring(0, rest.length - ending.length)
    mappedEnding = DP_ENTERING_ENDINGS[ending] ?? ending
  }

  const mappedVowel = vowel.replace(/ao/g, 'au')

  const result = mappedInitial + mappedVowel + mappedEnding + tone

  if (/(?<![ui])e/.test(mappedVowel)) {
    const variant = result.replace(/(?<![ui])e/g, 'ur')
    return [result, variant]
  }

  return [result]
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  const [first, ...rest] = arrays
  const restProduct = cartesian(rest)
  return first.flatMap((x) => restProduct.map((r) => [x, ...r]))
}
