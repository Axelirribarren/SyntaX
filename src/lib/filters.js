const MONTH_MS = 1000 * 60 * 60 * 24 * 30

export const DEFAULT_FILTERS = {
  freshness: 'any', // any | 12 | 6 (months since last push)
  minStars: 0,
  curatedOnly: false,
  sort: 'relevance' // relevance | stars | recent
}

export function monthsSince(dateString) {
  if (!dateString) return null
  const delta = Date.now() - new Date(dateString).getTime()
  if (Number.isNaN(delta)) return null
  return delta / MONTH_MS
}

// An abandoned MCP server is worse than a small active one, so staleness is a
// first-class signal rather than a footnote on the card.
export function staleness(item) {
  const months = monthsSince(item.updatedAt)
  if (months === null) return 'unknown'
  if (months <= 3) return 'active'
  if (months <= 12) return 'ok'
  return 'stale'
}

export function applyFilters(items, filters) {
  const { freshness, minStars, curatedOnly } = filters

  const filtered = items.filter((item) => {
    if (curatedOnly && !(item.curatedIn?.length)) return false
    if (minStars > 0 && (item.stars ?? 0) < minStars) return false

    if (freshness !== 'any') {
      const months = monthsSince(item.updatedAt)
      // Items with no date (raw awesome-list entries) are kept rather than
      // silently dropped — absence of data is not evidence of staleness.
      if (months !== null && months > Number(freshness)) return false
    }
    return true
  })

  return sortItems(filtered, filters.sort)
}

function sortItems(items, sort) {
  const copy = [...items]
  if (sort === 'stars') {
    return copy.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1))
  }
  if (sort === 'recent') {
    return copy.sort((a, b) => {
      const av = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
      const bv = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
      return bv - av
    })
  }
  return copy.sort((a, b) => score(b) - score(a))
}

// Relevance blends popularity, freshness and human curation so that a curated,
// actively-maintained project outranks a bigger repo that stopped shipping.
function score(item) {
  const stars = Math.log10((item.stars ?? 0) + 1) * 10
  const months = monthsSince(item.updatedAt)
  const freshness = months === null ? 5 : Math.max(0, 20 - months * 1.5)
  const curated = (item.curatedIn?.length || 0) * 12
  return stars + freshness + curated
}
