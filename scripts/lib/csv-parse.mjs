export function parseCsv(text) {
  const rows = []
  let i = 0

  function parseField() {
    if (text[i] === '"') {
      i++
      let value = ''
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            value += '"'
            i += 2
          } else {
            i++
            break
          }
        } else {
          value += text[i]
          i++
        }
      }
      return value
    }
    let value = ''
    while (i < text.length && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
      value += text[i]
      i++
    }
    return value
  }

  function parseRow() {
    const fields = []
    while (i < text.length) {
      fields.push(parseField())
      if (text[i] === ',') {
        i++
      } else {
        break
      }
    }
    if (text[i] === '\r') i++
    if (text[i] === '\n') i++
    return fields
  }

  while (i < text.length) {
    const row = parseRow()
    if (row.length > 0 && !(row.length === 1 && row[0] === '' && i >= text.length)) {
      rows.push(row)
    }
  }

  const headers = rows[0]
  return rows.slice(1).map((fields) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = fields[idx] || ''
    })
    return obj
  })
}
