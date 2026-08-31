import { findCapability } from '../../registry/capabilities.js'

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

  run({ snapshots }) {
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

      findings.push({
        severity: capability.confidence === 'alta' ? 'alta' : 'media',
        message: `${capability.label}: ${providers.size} providers instalados`,
        detail: capability.why,
        confidence: capability.confidence,
        items: [...providers.values()].map((entry) => `${entry.id} (${entry.target})`)
      })
    }

    return { findings }
  }
}
