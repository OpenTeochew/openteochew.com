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

export function isFieldAnnotated(originalFields: string | null, fieldName: string): boolean {
  if (originalFields === null) return false
  const fields = originalFields.split(',').map(f => f.trim())
  return !fields.includes(fieldName)
}

export function formatField(val: string | null, orig: string | null, isAnnotated?: boolean) {
  if (!val && !orig) return ''

  if (isAnnotated) {
    return `<span class="rt-annotated"><span class="annotated-badge">注</span>${esc(val || '')}</span>`
  }

  if (!orig) return esc(val || '')
  const stripped = stripAnno(esc(orig))
  const revised = renderAnno(esc(val || ''))
  const revisedText = revised.replace(/<[^>]*>/g, '').trim()
  return revisedText ? `${stripped}<span class="rt-revised"><span class="revised-badge">校</span>${revised}</span>` : stripped
}
