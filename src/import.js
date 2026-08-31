// `syntax import` — convierte lo observado en contrato.
//
// La regla que ordena todo el comando: OBSERVA, NO INFIERE INTENCIÓN.
//
// Adoptar la unión de skills entre targets y esperar que `verify` marque las
// faltantes no es observación: es una política de convergencia, y no se deduce
// del disco. Por eso el default es adopción fiel —cada skill se declara en los
// targets donde efectivamente está, y el primer `verify` sale limpio— y la
// política mirror es un pedido explícito que además queda escrito en el
// manifest, no un comportamiento implícito de la herramienta.
//
//   "encontré esto"  ·  "el equipo quiere esto"  ·  "supuse que el equipo quiere esto"
//
// La tercera solo se dice cuando alguien la pidió.

import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'

import { observeSkills, findDiverged, groupById } from './observe.js'
import { buildLock, serializeLock } from './manifest/lock.js'
import { serializeManifest } from './manifest/serialize.js'
import { writeAllAtomic } from './manifest/atomic.js'
import { SCHEMA_VERSION } from './manifest/schema.js'

export const MANIFEST_FILE = 'syntax.yaml'
export const LOCK_FILE = 'syntax.lock'

export function runImport(root, options = {}) {
  const manifestPath = join(root, MANIFEST_FILE)
  const lockPath = join(root, LOCK_FILE)

  if (existsSync(manifestPath) && !options.force) {
    return {
      ok: false,
      reason: `${MANIFEST_FILE} ya existe. import crea, no fusiona: usá --force para reemplazarlo.`
    }
  }

  const observed = observeSkills(root)

  if (!observed.targets.length) {
    return { ok: false, reason: 'No se detectó ningún runtime conocido en este proyecto.' }
  }

  // Se detecta ANTES de escribir. Un manifest que nace con una divergencia sin
  // declarar deja a `verify` reportando un problema que import ya había visto.
  const diverged = findDiverged(observed.skills)
  const targetIds = observed.targets.map((target) => target.id)
  const porId = groupById(observed.skills)

  const mirror = Boolean(options.mirror)
  const components = [...porId.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([id, targets]) => ({
      kind: 'skill',
      id,
      // Adopción fiel: los targets donde se observó. Con mirror, todos.
      targets: mirror ? [...targetIds] : [...targets].sort()
    }))

  const manifest = {
    version: SCHEMA_VERSION,
    name: basename(root) || 'proyecto',
    ...(mirror ? { targetPolicy: 'mirror' } : {}),
    targets: targetIds,
    components
  }

  const lock = buildLock(
    observed.skills.map((skill) => ({
      id: skill.id,
      target: skill.target,
      path: skill.path,
      files: skill.files,
      digest: skill.digest
    }))
  )

  if (options.dryRun) {
    return { ok: true, dryRun: true, manifest, lock, observed, diverged, mirror }
  }

  // Los dos archivos o ninguno: un contrato sin su línea base de integridad
  // deja a `verify` sin poder distinguir "nadie tocó nada" de "no sé qué había".
  const written = writeAllAtomic([
    { path: manifestPath, content: serializeManifest(manifest) },
    { path: lockPath, content: serializeLock(lock) }
  ])

  if (!written.ok) return { ok: false, reason: `No se pudo escribir: ${written.reason}` }

  return { ok: true, manifest, lock, observed, diverged, mirror, written: written.written }
}

export function renderImport(result) {
  const lines = ['']

  if (!result.ok) {
    lines.push(`  ${result.reason}`, '')
    return lines.join('\n')
  }

  const { manifest, lock, observed, diverged, mirror } = result

  lines.push(`  ${result.dryRun ? 'Se escribiría' : 'Importado'}: ${manifest.components.length} skills`)
  lines.push(
    `  Política: ${mirror ? 'mirror — la unión tiene que existir en todos los targets' : 'adopción fiel — cada skill vale donde se la observó'}`
  )
  lines.push('')

  for (const target of observed.targets) {
    const cuantas = observed.skills.filter((skill) => skill.target === target.id).length
    lines.push(`    ${target.label.padEnd(14)} ${cuantas} skills observadas`)
  }
  lines.push('')

  if (diverged.length) {
    lines.push('  Divergencias — mismo id, contenido distinto entre targets')
    for (const entry of diverged) {
      lines.push(`    ! ${entry.id}`)
      for (const copia of entry.copias) {
        lines.push(`      ${copia.target.padEnd(14)} ${copia.digest.slice(0, 19)}…`)
      }
    }
    lines.push('    Quedan registradas en el lock: verify las va a reportar.')
    lines.push('')
  }

  if (observed.problems.length) {
    lines.push('  Hallazgos')
    for (const problem of observed.problems) {
      lines.push(`    ! [${problem.target}] ${problem.id}: ${problem.detail}`)
    }
    lines.push('')
  }

  if (!result.dryRun) {
    lines.push(`  Escritos ${MANIFEST_FILE} y ${LOCK_FILE}.`)
    lines.push(`  Completá los \`why:\` que importen: import observó, no puede saber el porqué.`)
    lines.push(`  ${lock.skills.length} entradas en el lock.`)
    lines.push('')
  }

  return lines.join('\n')
}
