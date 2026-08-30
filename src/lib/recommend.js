// Recomendador: texto libre del usuario -> items del catálogo, con el motivo.
//
// Deliberadamente sin IA. Para un catálogo de un solo dominio (diseño frontend)
// alcanza con reconocer conceptos y sumar pesos: es instantáneo, funciona sin
// conexión, no cuesta nada y se puede depurar mirando qué concepto matcheó.
// Si algún día el catálogo crece a cientos de items, esto sigue sirviendo como
// primer filtro.

import { KITS } from '../data/kits.js'
import { VOCABULARY, ITEM_CONCEPTS, FALLBACK_IDS } from '../data/concepts.js'

// Saca acentos y mayúsculas para que "diseño" y "diseno" sean lo mismo.
const COMBINING_MARKS = /[̀-ͯ]/g

export function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
}

// El mismo item aparece en varios kits (con un "why" adaptado a cada uno).
// Para recomendar necesitamos la lista única; gana la primera aparición.
export function flatCatalog() {
  const byId = new Map()
  for (const kit of KITS) {
    for (const item of kit.items) {
      if (!byId.has(item.id)) byId.set(item.id, item)
    }
  }
  return [...byId.values()]
}

const WORD_SPLIT = /[^a-z0-9]+/

// Devuelve Map<concepto, cantidad de términos distintos que matchearon>.
export function detectConcepts(text) {
  const clean = normalize(text)
  const words = clean.split(WORD_SPLIT).filter(Boolean)
  const hits = new Map()

  for (const [concept, terms] of Object.entries(VOCABULARY)) {
    let matches = 0
    for (const rawTerm of terms) {
      const term = normalize(rawTerm)
      const matched = term.includes(' ')
        ? clean.includes(term)
        : words.some((w) => (term.length >= 4 ? w.startsWith(term) : w === term))
      if (matched) matches++
    }
    if (matches > 0) hits.set(concept, matches)
  }

  return hits
}

// Un mismo concepto nombrado de tres formas distintas no vale el triple:
// que lo repita da algo de señal, pero se aplana rápido.
function conceptStrength(matches) {
  return 1 + Math.min(matches - 1, 2) * 0.25
}

export function recommend(text, { limit = 8 } = {}) {
  const concepts = detectConcepts(text)
  const catalog = flatCatalog()

  const scored = catalog
    .map((item) => {
      const weights = ITEM_CONCEPTS[item.id] || {}
      let score = 0
      const matched = []

      for (const [concept, matches] of concepts) {
        const weight = weights[concept]
        if (!weight) continue
        score += weight * conceptStrength(matches)
        matched.push({ concept, weight })
      }

      // El que sirve a varios conceptos a la vez es mejor candidato que el
      // que clava uno solo: cubre más de lo que el usuario pidió.
      if (matched.length > 1) score *= 1 + (matched.length - 1) * 0.1

      // Un item que solo matcheó conceptos donde es tangencial (peso 1) es una
      // sugerencia, no una recomendación. Sin esta distinción, "diseño" arrastra
      // medio catálogo: brand-guidelines aplica la marca de Anthropic y Figma
      // pide una API key — ninguno de los dos debería venir tildado porque
      // alguien escribió "linda".
      const strong = matched.some((m) => m.weight >= 2)

      matched.sort((a, b) => b.weight - a.weight)
      return { item, score, strong, matched: matched.map((m) => m.concept) }
    })
    .filter((r) => r.score > 0)
    .sort(
      (a, b) =>
        Number(b.strong) - Number(a.strong) ||
        b.score - a.score ||
        a.item.name.localeCompare(b.item.name)
    )

  if (scored.length === 0) {
    return {
      fallback: true,
      concepts: [],
      results: catalog
        .filter((item) => FALLBACK_IDS.includes(item.id))
        .map((item) => ({ item, score: 0, strong: true, matched: [] }))
    }
  }

  const top = scored.slice(0, limit)
  const max = top[0].score

  return {
    fallback: false,
    concepts: [...concepts.keys()],
    results: top.map((r) => ({ ...r, relevance: Math.round((r.score / max) * 100) }))
  }
}
