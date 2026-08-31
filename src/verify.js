// `syntax verify` — el entorno que corre, ¿es el que acordamos?
//
// Estrictamente solo lectura: sin red, sin procesos, sin escribir. Nunca
// corrige. Aceptar drift tiene que ser una acción deliberada de una persona
// (será `accept`), porque una herramienta que se autorepara esconde justo lo
// que vino a mostrar.
//
// Exit codes, que es lo que lo convierte en algo más que un reporte:
//   0  limpio
//   1  diferencias que fallan
//   2  error (manifest o lock ausente o ilegible)

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { observeSkills, findDiverged } from './observe.js'
import { readManifest } from './manifest/parse.js'
import { readLock, findEntry } from './manifest/lock.js'
import { MANIFEST_FILE, LOCK_FILE } from './import.js'

export const EXIT = { LIMPIO: 0, DIFERENCIAS: 1, ERROR: 2 }

export function runVerify(root, options = {}) {
  const manifestPath = join(root, MANIFEST_FILE)
  const lockPath = join(root, LOCK_FILE)

  if (!existsSync(manifestPath) || !existsSync(lockPath)) {
    return {
      exit: EXIT.ERROR,
      error: `Faltan ${MANIFEST_FILE} o ${LOCK_FILE}. Corré: syntax import`
    }
  }

  const parsed = readManifest(manifestPath)
  if (!parsed.ok) return { exit: EXIT.ERROR, error: parsed.errors.join('\n  '), warnings: parsed.warnings }

  const locked = readLock(lockPath)
  if (!locked.ok) return { exit: EXIT.ERROR, error: locked.reason }

  const manifest = parsed.manifest
  const lock = locked.lock
  const observed = observeSkills(root)

  const instaladas = new Set(observed.skills.map((skill) => `${skill.id}@${skill.target}`))
  const declaradas = new Set()

  const missing = []
  const modified = []
  const unexpected = []

  const mirror = manifest.targetPolicy === 'mirror'

  for (const component of manifest.components || []) {
    if (component.kind !== 'skill') continue

    const targets = mirror ? manifest.targets : component.targets || manifest.targets
    for (const target of targets) {
      declaradas.add(`${component.id}@${target}`)

      const presente = observed.skills.find(
        (skill) => skill.id === component.id && skill.target === target
      )

      if (!presente) {
        missing.push({ id: component.id, target })
        continue
      }

      const entrada = findEntry(lock, component.id, target)
      if (!entrada) {
        // Declarada e instalada, pero sin línea base: no se puede afirmar que
        // no cambió. Se reporta como modificada, que es la lectura conservadora.
        modified.push({ id: component.id, target, detail: 'sin entrada en el lock' })
        continue
      }

      if (entrada.digest !== presente.digest) {
        modified.push({ id: component.id, target, detail: 'el contenido cambió' })
      }
    }
  }

  for (const clave of instaladas) {
    if (!declaradas.has(clave)) {
      const [id, target] = clave.split('@')
      unexpected.push({ id, target })
    }
  }

  const diverged = findDiverged(observed.skills)

  // `unexpected` no rompe por defecto: alguien tiene que poder probar una skill
  // sin romperle el build al equipo. Quien quiera entorno sellado usa --strict.
  const fallan =
    missing.length + modified.length + diverged.length + (options.strict ? unexpected.length : 0)

  return {
    exit: fallan ? EXIT.DIFERENCIAS : EXIT.LIMPIO,
    strict: Boolean(options.strict),
    policy: manifest.targetPolicy || 'faithful',
    missing,
    modified,
    diverged,
    unexpected,
    problems: observed.problems,
    warnings: parsed.warnings
  }
}

export function renderVerify(result) {
  const lines = ['']

  if (result.exit === 2) {
    lines.push(`  ${result.error}`, '')
    return lines.join('\n')
  }

  for (const aviso of result.warnings || []) lines.push(`  aviso del parser: ${aviso}`)

  const bloque = (titulo, entradas, formato) => {
    if (!entradas.length) return
    lines.push(`  ${titulo}`)
    for (const entrada of entradas) lines.push(`    ${formato(entrada)}`)
    lines.push('')
  }

  bloque('missing — declaradas y no instaladas', result.missing, (e) => `x ${e.id} en ${e.target}`)
  bloque('modified — el contenido no coincide con el lock', result.modified, (e) =>
    `x ${e.id} en ${e.target}: ${e.detail}`
  )
  bloque('diverged — mismo id, contenido distinto entre targets', result.diverged, (e) =>
    `x ${e.id}: ${e.copias.map((c) => c.target).join(' ≠ ')}`
  )
  bloque(
    `unexpected — instaladas y no declaradas${result.strict ? '' : ' (no rompe sin --strict)'}`,
    result.unexpected,
    (e) => `${result.strict ? 'x' : '!'} ${e.id} en ${e.target}`
  )

  if (result.problems.length) {
    lines.push('  Hallazgos de observación')
    for (const problem of result.problems) {
      lines.push(`    ! [${problem.target}] ${problem.id}: ${problem.detail}`)
    }
    lines.push('')
  }

  if (result.exit === 0) {
    lines.push(`  Entorno verificado: coincide con el contrato (política ${result.policy}).`)
  } else {
    const total = result.missing.length + result.modified.length + result.diverged.length
    lines.push(`  ${total} diferencias que rompen${result.strict ? ', modo estricto' : ''}.`)
    lines.push('  verify no corrige nada: actualizar la línea base es una acción aparte.')
  }
  lines.push('')

  return lines.join('\n')
}
