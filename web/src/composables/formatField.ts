const ANNO_RE = /\[([^\]\d]+)\]/g
const ESC_RE = /[&<>"']/g
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function esc(s: string) {
  return s.replace(ESC_RE, c => ESC_MAP[c])
}

export function renderAnno(text: string) {
  return text.replace(ANNO_RE, '<sup class="ocr-anno">$1</sup>')
}

export function stripAnno(text: string) {
  return text.replace(ANNO_RE, '')
}

export function formatField(val: string | null, orig: string | null) {
  if (!val && !orig) return ''
  if (!orig) return esc(val || '')
  const stripped = stripAnno(esc(orig))
  const revised = renderAnno(esc(val || ''))
  return `${stripped}<span class="orig">(${revised})</span>`
}
