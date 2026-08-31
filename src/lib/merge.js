// Results arrive from two very different shapes of source:
//   - GitHub search: rich metadata (stars, license, updatedAt) but no curation signal
//   - awesome-lists: curated by a human, but no metadata at all
// The same repo often appears in both. Merging them gives a card that has the
// metadata AND the trust signal, instead of two half-empty duplicates.

// github.com/Owner/Repo -> "owner/repo". Used as the join key across sources.
export function repoKey(url) {
  const match = url?.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/i)
  if (!match) return null
  return `${match[1]}/${match[2].replace(/\.git$/, '')}`.toLowerCase()
}

// Merges lists of items into one deduped list. Later lists enrich earlier ones
// rather than replacing them, so field-level precedence is explicit below.
export function mergeResults(...lists) {
  const byKey = new Map()
  const unkeyed = []

  for (const list of lists) {
    for (const item of list || []) {
      const key = repoKey(item.url)
      if (!key) {
        unkeyed.push(item)
        continue
      }
      const existing = byKey.get(key)
      byKey.set(key, existing ? combine(existing, item) : { ...item, key })
    }
  }

  return [...byKey.values(), ...unkeyed]
}

function combine(a, b) {
  const curatedIn = [...new Set([...(a.curatedIn || []), ...(b.curatedIn || [])])]

  // Whichever side came from a curated list contributes the curation badge;
  // whichever side has real GitHub metadata contributes the numbers.
  if (b.source !== 'github') curatedIn.push(b.sourceLabel)
  if (a.source !== 'github') curatedIn.push(a.sourceLabel)

  return {
    ...a,
    ...b,
    // Prefer real metadata over the awesome-list placeholders.
    stars: pickNumber(a.stars, b.stars),
    license: pickLicense(a.license, b.license),
    updatedAt: a.updatedAt || b.updatedAt,
    description: longer(a.description, b.description),
    topics: [...new Set([...(a.topics || []), ...(b.topics || [])])],
    curatedIn: [...new Set(curatedIn.filter(Boolean))]
  }
}

function pickNumber(a, b) {
  if (typeof a === 'number') return a
  if (typeof b === 'number') return b
  return null
}

function pickLicense(a, b) {
  const known = (v) => v && v !== 'unverified' && v !== 'unknown'
  if (known(a)) return a
  if (known(b)) return b
  return a || b || 'unknown'
}

function longer(a = '', b = '') {
  return a.length >= b.length ? a : b
}
