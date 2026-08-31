import { findCapability } from '../../registry/capabilities.js'
import { formatTokens } from '../tokenize.js'

// Varios providers instalados para la misma capability.
//
// Es la causa más común de que agregar herramientas empeore al agente: dos
// servers de navegador inyectan dos juegos completos de schemas en cada
// arranque, y el modelo además tiene que elegir entre APIs equivalentes sin
// ningún criterio para desempatar.
//
// La colisión se reporta con la confianza declarada en el registry. Un aviso
// dudoso presentado como certeza le cuesta credibilidad a todo el reporte.
export default {
  id: 'providers',
  title: 'Providers duplicados',

  run({ snapshots, probes }) {
    const found = new Map()

    for (const snapshot of snapshots) {
      if (!snapshot.present) continue

      for (const kind of ['mcp', 'skill']) {
        for (const object of snapshot.objects[kind] || []) {
          const hit = findCapability({ ...object, kind })
          if (!hit) continue

          const key = hit.capability.id
          if (!found.has(key)) found.set(key, { capability: hit.capability, providers: new Map() })

          const entry = found.get(key)
          if (!entry.providers.has(hit.provider.id)) {
            entry.providers.set(hit.provider.id, { id: object.id, target: snapshot.label })
          }
        }
      }
    }

    const findings = []
    for (const { capability, providers } of found.values()) {
      if (providers.size < 2) continue

      const entries = [...providers.values()]
      const costs = entries
        .map((entry) => probes?.find((probe) => probe.ok && probe.id === entry.id)?.tokens)
        .filter((tokens) => typeof tokens === 'number')

      // Con `--deep` la redundancia deja de ser un consejo y pasa a tener
      // precio. Es la diferencia entre "tenés dos cosas parecidas" y "una de
      // las dos te cuesta esto en cada arranque".
      let ahorro = null
      if (costs.length === entries.length) {
        const total = costs.reduce((sum, tokens) => sum + tokens, 0)
        const menor = total - Math.max(...costs)
        const mayor = total - Math.min(...costs)
        ahorro =
          menor === mayor
            ? `Quedarte con uno ahorra ${formatTokens(menor)} tokens por arranque.`
            : `Quedarte con uno ahorra entre ${formatTokens(menor)} y ${formatTokens(mayor)} tokens por arranque.`
      }

      findings.push({
        severity: capability.confidence === 'alta' ? 'alta' : 'media',
        message: `${capability.label}: ${providers.size} providers instalados`,
        detail: ahorro ? `${capability.why} ${ahorro}` : capability.why,
        confidence: capability.confidence,
        items: entries.map((entry) => {
          const tokens = probes?.find((probe) => probe.ok && probe.id === entry.id)?.tokens
          const costo = typeof tokens === 'number' ? ` — ${formatTokens(tokens)} tokens` : ''
          return `${entry.id} (${entry.target})${costo}`
        })
      })
    }

    return { findings }
  }
}
