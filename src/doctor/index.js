import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { OBJECT_KINDS } from '../targets/contract.js'
import { TARGET_IDS, detectTargets, readAll } from '../targets/index.js'
import { detectUnsupported } from '../targets/unknown.js'

import drift from './checks/drift.js'
import providers from './checks/providers.js'
import orphans from './checks/orphans.js'
import health from './checks/health.js'
import staticCost from './checks/static-cost.js'

export const CHECKS = [staticCost, drift, providers, orphans, health]

// `doctor` no escribe nunca. Esa propiedad no se negocia: es lo que permite
// correrlo en el repo de otra persona sin pedirle confianza, y la razón por la
// que es el primer comando del producto y no el último.
//
// Por defecto tampoco lanza procesos. La excepción es `--deep`, que levanta los
// MCP servers declarados para medir sus schemas — o sea, ejecuta comandos que
// vienen del repo auditado. Por eso es opt-in, la CLI lo advierte antes, y esta
// función solo recibe los resultados ya obtenidos (`options.probes`): la parte
// que ejecuta vive aislada en `probe.js` y nunca se activa sola.
export function runDoctor(root, options = {}) {
  const targets = detectTargets(root)
  const snapshots = readAll(root, targets)
  const targetsById = Object.fromEntries(targets.map((target) => [target.id, target]))

  const context = {
    root,
    targets,
    targetsById,
    snapshots,
    probes: options.probes || null,
    gitignore: readGitignore(root)
  }

  const results = CHECKS.map((check) => ({
    id: check.id,
    title: check.title,
    ...check.run(context)
  }))

  return {
    root,
    generatedAt: new Date().toISOString(),
    deep: Boolean(options.probes),
    environment: summarize(snapshots),
    cost: results.find((result) => result.cost)?.cost || null,
    checks: results.map(({ cost, ...rest }) => rest),
    loss: describeLoss(targets, snapshots),
    unsupportedRuntimes: detectUnsupported(root, TARGET_IDS)
  }
}

function summarize(snapshots) {
  return snapshots
    .filter((snapshot) => snapshot.present)
    .map((snapshot) => ({
      target: snapshot.target,
      label: snapshot.label,
      counts: Object.fromEntries(
        OBJECT_KINDS.map((kind) => [kind, (snapshot.objects[kind] || []).length]).filter(
          ([, count]) => count > 0
        )
      ),
      notes: snapshot.notes
    }))
}

// El reporte de pérdida sale del `supports` declarativo de cada adapter, sin
// una línea de código específica por par de runtimes. Se reporta solo lo que
// duele de verdad: los objetos que existen en este repo y que el target no sabe
// expresar. Enumerar todo lo que un runtime no soporta en abstracto es ruido.
function describeLoss(targets, snapshots) {
  const existing = new Set()
  for (const snapshot of snapshots) {
    for (const kind of OBJECT_KINDS) {
      if ((snapshot.objects[kind] || []).length) existing.add(kind)
    }
  }

  return targets
    .map((target) => {
      const missing = [...existing].filter((kind) => !target.supports[kind])
      const caveats = Object.entries(target.supports)
        .filter(([, descriptor]) => descriptor.note || descriptor.scope === 'user')
        .map(([kind, descriptor]) => ({ kind, note: descriptor.note, scope: descriptor.scope }))

      if (!missing.length && !caveats.length) return null
      return { target: target.id, label: target.label, missing, caveats }
    })
    .filter(Boolean)
}

function readGitignore(root) {
  const path = join(root, '.gitignore')
  if (!existsSync(path)) return ''
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}
