export function parseSection(sourceField) {
  const parts = sourceField.split(' > ')
  return parts.length >= 2 ? parts.slice(1).join(' > ').trim() : null
}

export function parseBookId(sourceField) {
  const parts = sourceField.split(' > ')
  return parts[0].trim()
}
