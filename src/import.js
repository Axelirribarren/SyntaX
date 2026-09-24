// `pactlock import` — convierte lo observado en contrato.
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

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

import { observeSkills, findDiverged, groupById } from './observe.js'
import { buildLock, serializeLock } from './manifest/lock.js'
import { readJournal, describeJournal } from './manifest/journal.js'
import { serializeManifest } from './manifest/serialize.js'
import { readManifest } from './manifest/parse.js'
import { writeAllAtomic } from './manifest/atomic.js'
import { SCHEMA_VERSION } from './manifest/schema.js'

export const MANIFEST_FILE = 'pactlock.yaml'
export const LOCK_FILE = 'pactlock.lock'

export function runImport(root, options = {}) {
  const manifestPath = join(root, MANIFEST_FILE)
  const lockPath = join(root, LOCK_FILE)

  if (options.relock) return runRelock(root, manifestPath, lockPath)

  // Sin --force a propósito. Si `accept` es el único lugar donde se acepta
  // drift, un flag que reescribe el manifest entero lo puentea y se lleva
  // puestos los `why`. Empezar de cero exige borrar el archivo a mano: es una
  // decisión visible, no un flag perdido en la historia del shell.
  if (existsSync(manifestPath)) {
    return {
      ok: false,
      reason: [
        `${MANIFEST_FILE} ya existe. import crea, no fusiona.`,
        'Para aceptar cambios puntuales: pactlock accept',
        `Para empezar de cero: borrá ${MANIFEST_FILE} y ${LOCK_FILE} a mano.`
      ].join('\n  ')
    }
  }

  const pendiente = readJournal(root)
  if (pendiente) {
    return { ok: false, reason: describeJournal(pendiente) }
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
      digest: skill.digest,
      inventory: skill.inventory
    })),
    manifest
  )

  if (options.dryRun) {
    return { ok: true, dryRun: true, manifest, lock, observed, diverged, mirror }
  }

  // Los dos archivos se escriben juntos, pero los dos renames NO son una sola
  // transacción: si el proceso muere en el medio queda un journal, y el próximo
  // comando lo informa. Ver el comentario de src/manifest/atomic.js.
  const written = writeAllAtomic(
    [
      { path: manifestPath, content: serializeManifest(manifest) },
      { path: lockPath, content: serializeLock(lock) }
    ],
    { root, command: 'import' }
  )

  if (!written.ok) return { ok: false, reason: `No se pudo escribir: ${written.reason}` }

  return { ok: true, manifest, lock, observed, diverged, mirror, written: written.written }
}

// Regenera SOLO el lock, conservando el manifest y sus `why`.
//
// Existe porque sacar `--force` dejó un hueco: ante un cambio de formato del
// lock, o un lock corrupto, la única salida habría sido borrar el manifest y
// perder todo lo que escribió una persona.
//
// Lo importante es que NO es un "aceptar todo" por la puerta de atrás. Una
// entrada solo se rehace con lo que hay en disco si su digest coincide con el
// que ya estaba: si el contenido no cambió, bendecirlo no otorga confianza
// nueva. Cuando el digest difiere, se conserva el ANTERIOR, y `verify` sigue
// reportando esa skill como modificada hasta que alguien la acepte a propósito.
function runRelock(root, manifestPath, lockPath) {
  if (!existsSync(manifestPath)) {
    return { ok: false, reason: `No hay ${MANIFEST_FILE} que conservar. Corré: pactlock import` }
  }

  const parsed = readManifest(manifestPath)
  if (!parsed.ok) return { ok: false, reason: parsed.errors.join('\n  ') }

  const previo = existsSync(lockPath) ? leerLockCrudo(lockPath) : null
  const observed = observeSkills(root)
  const conservados = []

  const entradas = observed.skills.map((skill) => {
    const anterior = (previo?.skills || []).find(
      (entry) => entry.id === skill.id && entry.target === skill.target
    )

    if (anterior && anterior.digest !== skill.digest) {
      conservados.push({ id: skill.id, target: skill.target })
      return { ...anterior }
    }

    return {
      id: skill.id,
      target: skill.target,
      path: skill.path,
      files: skill.files,
      digest: skill.digest,
      inventory: skill.inventory
    }
  })

  const lock = buildLock(entradas, parsed.manifest)
  const written = writeAllAtomic([{ path: lockPath, content: serializeLock(lock) }], {
    root,
    command: 'import --relock'
  })

  if (!written.ok) return { ok: false, reason: `No se pudo escribir: ${written.reason}` }

  return { ok: true, relock: true, lock, conservados, observed }
}

function leerLockCrudo(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function renderImport(result) {
  const lines = ['']

  if (!result.ok) {
    lines.push(`  ${result.reason}`, '')
    return lines.join('\n')
  }

  if (result.relock) {
    lines.push(`  ${LOCK_FILE} regenerado: ${result.lock.skills.length} entradas.`)
    lines.push(`  ${MANIFEST_FILE} intacto, con sus \`why\`.`)
    if (result.conservados.length) {
      lines.push('')
      lines.push('  Estas ya no coinciden con su digest anterior y se dejó el viejo,')
      lines.push('  para que verify las siga reportando hasta que alguien las acepte:')
      for (const entry of result.conservados) lines.push(`    ! ${entry.id} en ${entry.target}`)
    }
    lines.push('')
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
