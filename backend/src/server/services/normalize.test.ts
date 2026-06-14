import { describe, it, expect } from 'vitest'
import { normalizeToLatnNorm } from './normalize'

describe('normalizeToLatnNorm — PUJ', () => {
  it('converts ts before a/o/u to ch', () => {
    expect(normalizeToLatnNorm('tsa5', 'puj')).toEqual(['cha5'])
  })

  it('converts tsh before a/o/u to chh', () => {
    expect(normalizeToLatnNorm('tshang5', 'puj')).toEqual(['chhang5'])
  })

  it('converts z before a/o/u to j', () => {
    expect(normalizeToLatnNorm('zang5', 'puj')).toEqual(['jang5'])
  })

  it('keeps ch/chh/j before i/e unchanged', () => {
    expect(normalizeToLatnNorm('chin5', 'puj')).toEqual(['chin5'])
    expect(normalizeToLatnNorm('chhin5', 'puj')).toEqual(['chhin5'])
  })

  it('converts superscript n to nn', () => {
    expect(normalizeToLatnNorm('tsua\u207F3', 'puj')).toEqual(['chuann3'])
  })

  it('handles multi-syllable input', () => {
    expect(normalizeToLatnNorm('tsa5-chin5', 'puj')).toEqual(['cha5-chin5'])
  })

  it('handles consonant-initial nasalized vowel', () => {
    expect(normalizeToLatnNorm('kuann5', 'puj')).toEqual(['kuann5'])
  })
})

describe('normalizeToLatnNorm — DP', () => {
  it('maps DP initials to latn_norm', () => {
    expect(normalizeToLatnNorm('bang5', 'dp')).toEqual(['pang5'])
    expect(normalizeToLatnNorm('pang5', 'dp')).toEqual(['phang5'])
    expect(normalizeToLatnNorm('zang1', 'dp')).toEqual(['chang1'])
    expect(normalizeToLatnNorm('cang1', 'dp')).toEqual(['chhang1'])
    expect(normalizeToLatnNorm('rang5', 'dp')).toEqual(['jang5'])
  })

  it('maps DP voiced initials', () => {
    expect(normalizeToLatnNorm('bhang5', 'dp')).toEqual(['bang5'])
    expect(normalizeToLatnNorm('ghang5', 'dp')).toEqual(['gang5'])
  })

  it('maps DP entering tone endings', () => {
    expect(normalizeToLatnNorm('zab8', 'dp')).toEqual(['chap8'])
    expect(normalizeToLatnNorm('sad4', 'dp')).toEqual(['sat4'])
    expect(normalizeToLatnNorm('sag4', 'dp')).toEqual(['sak4'])
  })

  it('preserves ng nasal ending (not entering)', () => {
    expect(normalizeToLatnNorm('bang5', 'dp')).toEqual(['pang5'])
  })

  it('maps ao to au', () => {
    expect(normalizeToLatnNorm('hao3', 'dp')).toEqual(['hau3'])
  })

  it('generates e-ambiguity candidates', () => {
    const result = normalizeToLatnNorm('se1', 'dp')
    expect(result).toContain('se1')
    expect(result).toContain('sur1')
    expect(result).toHaveLength(2)
  })

  it('does not generate e-ambiguity for ue/ie', () => {
    expect(normalizeToLatnNorm('hue1', 'dp')).toEqual(['hue1'])
    expect(normalizeToLatnNorm('hie1', 'dp')).toEqual(['hie1'])
  })

  it('handles multi-syllable with e-ambiguity', () => {
    const result = normalizeToLatnNorm('bang5-se1', 'dp')
    expect(result).toContain('pang5-se1')
    expect(result).toContain('pang5-sur1')
  })

  it('passes through unknown initials unchanged', () => {
    expect(normalizeToLatnNorm('mang5', 'dp')).toEqual(['mang5'])
    expect(normalizeToLatnNorm('sang5', 'dp')).toEqual(['sang5'])
  })
})
