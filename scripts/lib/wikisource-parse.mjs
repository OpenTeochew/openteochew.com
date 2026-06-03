export function parseSubpageLinks(html) {
  const results = new Set()
  const re = /href="\/wiki\/Handbook_of_the_Swatow_Vernacular\/([^"]+)"/g
  let match
  while ((match = re.exec(html)) !== null) {
    results.add(decodeURIComponent(match[1]))
  }
  return [...results]
}

export function parsePageMarkers(html) {
  const markers = []
  const re = /<span[^>]*class="pagenum ws-pagenum"[^>]*>/g
  let match
  while ((match = re.exec(html)) !== null) {
    const tag = match[0]
    const pageNumMatch = tag.match(/data-page-number="([^"]+)"/)
    const pageIdxMatch = tag.match(/data-page-index="([^"]+)"/)
    if (pageNumMatch && pageIdxMatch) {
      markers.push({
        pageNumber: pageNumMatch[1],
        pageIndex: Number(pageIdxMatch[1]),
      })
    }
  }
  return markers
}

function isNumericPage(pageNumber) {
  return /^\d+$/.test(pageNumber)
}

export function extractSectionPageMap(subpagesWithMarkers) {
  const map = new Map()
  for (const { subpage, markers } of subpagesWithMarkers) {
    const numericMarkers = markers.filter((m) => isNumericPage(m.pageNumber))
    if (numericMarkers.length === 0) continue

    numericMarkers.sort((a, b) => a.pageIndex - b.pageIndex)

    const first = numericMarkers[0]
    const last = numericMarkers[numericMarkers.length - 1]

    map.set(subpage, {
      startPage: Number(first.pageNumber),
      endPage: Number(last.pageNumber),
      startPdfPage: first.pageIndex,
      endPdfPage: last.pageIndex,
    })
  }
  return map
}
