export function makeKey(row, sectionTitle) {
  return JSON.stringify([row.puj || '', row.han || '', row.en || '', sectionTitle || ''])
}

export function diffRows(oldRows, newRows) {
  const oldMap = new Map()
  const newMap = new Map()

  for (const row of oldRows) {
    oldMap.set(makeKey(row, row._section), row)
  }
  for (const row of newRows) {
    newMap.set(makeKey(row, row._section), row)
  }

  const added = []
  const modified = []
  const removed = []

  for (const [key, newRow] of newMap) {
    if (!oldMap.has(key)) {
      added.push(newRow)
    } else {
      const oldRow = oldMap.get(key)
      if (
        oldRow.puj_orig !== newRow.puj_orig ||
        oldRow.han_orig !== newRow.han_orig ||
        oldRow.en_orig !== newRow.en_orig
      ) {
        modified.push(newRow)
      }
    }
  }

  for (const [key, oldRow] of oldMap) {
    if (!newMap.has(key)) {
      removed.push(oldRow)
    }
  }

  return { added, modified, removed }
}
