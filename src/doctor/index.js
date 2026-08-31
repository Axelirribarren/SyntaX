import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { OBJECT_KINDS } from '../targets/contract.js'
import { TARGET_IDS, detectTargets, readAll } from '../targets/index.js'
import { detectUnsupported } from '../targets/unknown.js'

import drift from './checks/drift.js'
import providers from './checks/providers.js'
import orphans from './checks/orphans.js'
import staticCost from './checks/static-cost.js'

export const CHECKS = [staticCost, drift, providers, orphans]

// `doctor` no escribe nunca, no lanza procesos y no toca la red. Esa propiedad
// es lo que permite correrlo en el repo de otra persona sin pedirle confianza —
// y es la razón por la que es el primer comando del producto y no el último.
export function runDoctor(root) {
  const targets = detectTargets(root)
  const snapshots = readAll(root, targets)
  const targetsById = Object.fromEntries(targets.map((target) => [target.id, target]))

  const context = {
    root,
    targets,
    targetsById,
    snapshots,
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
