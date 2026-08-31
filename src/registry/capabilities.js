// Mapa capability -> providers.
//
// Semilla tomada de la metadata curada a mano del catálogo viejo (`src/data/kits.js`),
// que era la única parte de aquel producto que tenía valor real: alguien había
// verificado a mano qué hace cada componente.
//
// El modelo es capability-first a propósito. Lo que un entorno necesita es
// "control de navegador"; `chrome-devtools-mcp` es apenas una forma de
// cumplirlo. Eso permite dos cosas que un modelo artifact-first no permite:
// detectar que hay tres providers instalados para la misma necesidad, y que
// `build` elija el provider que el target soporta en vez de fallar.
//
// `confidence` es explícito porque el reporte lo muestra: afirmar una colisión
// que no existe le cuesta credibilidad a todo el reporte, que es el activo.
//   alta  -> los providers hacen lo mismo; tener dos es redundancia clara
//   media -> se solapan parcialmente; conviene revisarlo, no es un error seguro

export const CAPABILITIES = [
  {
    id: 'browser-control',
    label: 'Control e inspección de navegador',
    confidence: 'alta',
    why: 'Cada uno expone su propio juego de tools de navegador. Dos instalados duplican los schemas en cada arranque y el modelo tiene que elegir entre APIs equivalentes.',
    providers: [
      { id: 'chrome-devtools', kind: 'mcp', match: ['chrome-devtools', 'chrome-devtools-mcp'] },
      { id: 'playwright', kind: 'mcp', match: ['playwright', '@playwright/mcp'] },
      { id: 'puppeteer', kind: 'mcp', match: ['puppeteer', 'puppeteer-mcp'] },
      { id: 'browserbase', kind: 'mcp', match: ['browserbase'] }
    ]
  },
  {
    id: 'docs-lookup',
    label: 'Consulta de documentación de librerías',
    confidence: 'alta',
    why: 'Resuelven la misma necesidad: traer documentación actualizada al contexto.',
    providers: [
      { id: 'context7', kind: 'mcp', match: ['context7', '@upstash/context7-mcp'] },
      { id: 'ref', kind: 'mcp', match: ['ref', 'ref-tools'] },
      { id: 'deepwiki', kind: 'mcp', match: ['deepwiki'] }
    ]
  },
  {
    id: 'design-direction',
    label: 'Criterio visual y dirección de diseño',
    confidence: 'media',
    why: 'Se solapan en cuándo disparan: una descripción de "hacé que se vea mejor" matchea las dos, y el modelo tiene que desempatar sin criterio claro.',
    providers: [
      { id: 'frontend-design', kind: 'skill', match: ['frontend-design'] },
      { id: 'ui-ux-pro-max', kind: 'skill', match: ['ui-ux-pro-max'] }
    ]
  },
  {
    id: 'visual-audit',
    label: 'Auditoría de una interfaz ya construida',
    confidence: 'media',
    why: 'Ambas revisan una UI existente y reportan problemas; el alcance se pisa en buena parte.',
    providers: [
      { id: 'design-audit', kind: 'skill', match: ['design-audit'] },
      { id: 'a11y-audit', kind: 'skill', match: ['a11y-audit'] }
    ]
  }
]

// Un objeto del snapshot (server MCP o carpeta de skill) contra el mapa.
export function findCapability(object) {
  for (const capability of CAPABILITIES) {
    for (const provider of capability.providers) {
      if (provider.kind !== object.kind) continue
      if (matches(object, provider)) return { capability, provider }
    }
  }
  return null
}

function matches(object, provider) {
  const haystack = [object.id, object.command, ...(object.args || [])]
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLowerCase())

  return provider.match.some((needle) =>
    haystack.some((value) => value === needle || value.includes(needle))
  )
}
