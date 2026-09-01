// `syntax accept` — el único lugar donde una persona autoriza algo.
//
// No es un actualizador de hashes. Dos razones por las que el diseño es más
// estricto de lo que parece necesario:
//
//   - Un `unexpected` es una capacidad ejecutable nueva para el agente.
//     Aceptarlo no es actualizar información: es ESTABLECER CONFIANZA.
//   - Un `modified` puede ser accidental o malicioso, y desde el hash no hay
//     forma de distinguirlo. "Es reversible" solo vale si está en git; pisar el
//     digest del lock no es, por sí mismo, reversible.
//
// De ahí las dos reglas duras:
//
//   1. Nada se acepta en bloque sin mirar. Interactivo con TTY; sin TTY no
//      modifica nada.
//   2. La acción se nombra, nunca se infiere del estado. `accept foo` no puede
//      borrar una declaración en una máquina y actualizar un digest en otra.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { runVerify, EXIT } from './verify.js'
import { MANIFEST_FILE, LOCK_FILE } from './import.js'
import { diffInventories } from './manifest/digest.js'
import { addEntry, manifestDigest, removeEntry, serializeLock, updateEntry } from './manifest/lock.js'
import {
  addComponent,
  loadDocument,
  removeTarget,
  serializeDocument,
  setAllowDivergence
} from './manifest/edit.js'
import { writeAllAtomic } from './manifest/atomic.js'
import { confirm, isInteractive } from './prompt.js'

export function planAccept(root, options = {}) {
  const diagnostico = runVerify(root)
  if (diagnostico.exit === EXIT.ERROR) {
    return { ok: false, reason: diagnostico.error }
  }

  const acciones = []
  const observado = (id, target) =>
    diagnostico.observed.skills.find((skill) => skill.id === id && skill.target === target)

  if (options.id) {
    const accion = accionExplicita(options, diagnostico, observado)
    if (!accion.ok) return accion
    acciones.push(accion.accion)
  }

  // --all-modified y --all-unexpected van por separado a propósito. Un `--all`
  // genérico mezclaría "cambió contenido que ya había autorizado" con "apareció
  // algo que nunca autoricé": es la puerta al "que quede todo verde".
  if (options.allModified) {
    for (const entry of diagnostico.modified) {
      acciones.push({ tipo: 'modified', id: entry.id, target: entry.target })
    }
  }

  if (options.allUnexpected) {
    for (const entry of diagnostico.unexpected) {
      acciones.push({ tipo: 'adopt', id: entry.id, target: entry.target })
    }
  }

  return { ok: true, diagnostico, acciones: acciones.map((a) => describir(a, diagnostico, observado)) }
}

function accionExplicita(options, diagnostico, observado) {
  const { id } = options
  const target = options.target

  if (options.remove) {
    if (!target) {
      return { ok: false, reason: 'Retirar una declaración exige --target: la misma skill puede estar en varios runtimes.' }
    }
    return { ok: true, accion: { tipo: 'remove', id, target } }
  }

  if (options.allowDivergence) {
    if (!options.why) {
      return { ok: false, reason: 'Autorizar divergencia exige --why: una excepción sin motivo escrito se vuelve permanente sola.' }
    }
    const entrada = diagnostico.diverged.find((entry) => entry.id === id)
    if (!entrada) return { ok: false, reason: `${id} no está divergente.` }
    return {
      ok: true,
      accion: { tipo: 'allow-divergence', id, targets: entrada.copias.map((c) => c.target), why: options.why }
    }
  }

  if (options.adopt) {
    const candidatos = diagnostico.unexpected.filter(
      (entry) => entry.id === id && (!target || entry.target === target)
    )
    if (!candidatos.length) return { ok: false, reason: `${id} no aparece como unexpected.` }
    if (candidatos.length > 1) {
      return { ok: false, reason: `${id} es unexpected en varios runtimes: elegí uno con --target.` }
    }
    return { ok: true, accion: { tipo: 'adopt', id, target: candidatos[0].target } }
  }

  // Sin flag, la acción por defecto es la menos destructiva: aceptar contenido
  // modificado. Nunca borra ni adopta por inferir el estado.
  const candidatos = diagnostico.modified.filter(
    (entry) => entry.id === id && (!target || entry.target === target)
  )
  if (!candidatos.length) {
    return {
      ok: false,
      reason: `${id} no aparece como modificado. Para otra cosa, nombrala: --adopt, --remove --target X, o --allow-divergence --why "…"`
    }
  }
  if (candidatos.length > 1) {
    return { ok: false, reason: `${id} está modificada en varios runtimes: elegí uno con --target.` }
  }

  return { ok: true, accion: { tipo: 'modified', id, target: candidatos[0].target } }
}

// Autorizar tiene que ser informado: sin esto, `accept` solo puede decir
// "confiá en este hash nuevo".
function describir(accion, diagnostico, observado) {
  if (accion.tipo !== 'modified' && accion.tipo !== 'adopt') return accion

  const actual = observado(accion.id, accion.target)
  const previo = (diagnostico.lock.skills || []).find(
    (entry) => entry.id === accion.id && entry.target === accion.target
  )

  return {
    ...accion,
    path: actual?.path,
    digestPrevio: previo?.digest || null,
    digestNuevo: actual?.digest || null,
    archivosPrevios: previo?.files ?? null,
    archivosNuevos: actual?.files ?? null,
    cambios: diffInventories(previo?.inventory, actual?.inventory)
  }
}

export function renderAccion(accion) {
  const lines = []

  if (accion.tipo === 'remove') {
    lines.push(`  retirar   ${accion.id} de ${accion.target}`)
    lines.push('    Se saca del contrato y del lock. La carpeta en disco no se toca.')
    return lines.join('\n')
  }

  if (accion.tipo === 'allow-divergence') {
    lines.push(`  divergir  ${accion.id} entre ${accion.targets.join(' y ')}`)
    lines.push(`    Motivo: ${accion.why}`)
    lines.push('    Se acepta que sean distintas entre sí, NO que cambien sin que nadie mire:')
    lines.push('    cada copia sigue comparándose contra su propio digest.')
    return lines.join('\n')
  }

  const titulo = accion.tipo === 'adopt' ? 'adoptar ' : 'aceptar '
  lines.push(`  ${titulo}  ${accion.id} en ${accion.target}   ${accion.path || ''}`.trimEnd())

  if (accion.tipo === 'adopt') {
    lines.push('    Es una capacidad ejecutable nueva para el agente: aceptarla es autorizarla.')
  }

  if (accion.digestPrevio) {
    lines.push(`    ${accion.digestPrevio.slice(0, 23)}…  ->  ${accion.digestNuevo.slice(0, 23)}…`)
  }
  if (accion.archivosPrevios !== null && accion.archivosPrevios !== accion.archivosNuevos) {
    lines.push(`    archivos: ${accion.archivosPrevios} -> ${accion.archivosNuevos}`)
  }

  const { agregados = [], eliminados = [], modificados = [] } = accion.cambios || {}
  for (const path of agregados) lines.push(`    + ${path}`)
  for (const path of eliminados) lines.push(`    - ${path}`)
  for (const path of modificados) lines.push(`    ~ ${path}`)

  return lines.join('\n')
}

export function applyAccept(root, acciones, diagnostico) {
  const manifestPath = join(root, MANIFEST_FILE)
  const lockPath = join(root, LOCK_FILE)

  const doc = loadDocument(manifestPath)
  const lock = diagnostico.lock
  const observado = (id, target) =>
    diagnostico.observed.skills.find((skill) => skill.id === id && skill.target === target)

  for (const accion of acciones) {
    if (accion.tipo === 'modified') {
      updateEntry(lock, accion.id, accion.target, observado(accion.id, accion.target))
      continue
    }

    if (accion.tipo === 'adopt') {
      const skill = observado(accion.id, accion.target)
      // Solo el target observado. Extenderlo a todos sería inventar una
      // política de convergencia que nadie pidió.
      addComponent(doc, { id: accion.id, targets: [accion.target] })
      addEntry(lock, {
        id: skill.id,
        target: skill.target,
        path: skill.path,
        files: skill.files,
        digest: skill.digest,
        inventory: skill.inventory
      })
      continue
    }

    if (accion.tipo === 'remove') {
      removeTarget(doc, accion.id, accion.target)
      removeEntry(lock, accion.id, accion.target)
      continue
    }

    if (accion.tipo === 'allow-divergence') {
      setAllowDivergence(doc, accion.id, accion.targets, accion.why)
    }
  }

  // El digest del manifest se recalcula sobre el documento ya editado: si no,
  // el par quedaría marcado como inconsistente por nuestra propia escritura.
  lock.manifestDigest = manifestDigest(doc.toJS())
  lock.generatedAt = new Date().toISOString()

  return writeAllAtomic(
    [
      { path: manifestPath, content: serializeDocument(doc) },
      { path: lockPath, content: serializeLock(lock) }
    ],
    { root, command: 'accept' }
  )
}

export async function runAccept(root, options = {}) {
  if (!existsSync(join(root, MANIFEST_FILE))) {
    return { ok: false, reason: `No hay ${MANIFEST_FILE}. Corré: syntax import` }
  }

  const plan = planAccept(root, options)
  if (!plan.ok) return plan

  const explicito = Boolean(options.id || options.allModified || options.allUnexpected)

  if (!explicito) {
    // Sin flags, la única forma de aceptar algo es que una persona lo confirme.
    if (!options.interactive) {
      return {
        ok: false,
        reason: [
          'accept sin argumentos necesita una terminal interactiva: la autorización es de una persona.',
          'Para automatización, nombrá qué aceptás: --all-modified, --all-unexpected, o un id.'
        ].join('\n  '),
        diagnostico: plan.diagnostico
      }
    }

    const pendientes = [
      ...plan.diagnostico.modified.map((e) => ({ tipo: 'modified', id: e.id, target: e.target })),
      ...plan.diagnostico.unexpected.map((e) => ({ tipo: 'adopt', id: e.id, target: e.target }))
    ]

    if (!pendientes.length) return { ok: true, sinCambios: true, diagnostico: plan.diagnostico }

    const aceptadas = []
    for (const accion of pendientes) {
      const descripta = describir(accion, plan.diagnostico, (id, target) =>
        plan.diagnostico.observed.skills.find((s) => s.id === id && s.target === target)
      )
      console.log(`\n${renderAccion(descripta)}\n`)
      if (await confirm('¿Aceptar?')) aceptadas.push(descripta)
    }

    if (!aceptadas.length) return { ok: true, sinCambios: true, diagnostico: plan.diagnostico }
    if (options.dryRun) return { ok: true, dryRun: true, acciones: aceptadas }

    const written = applyAccept(root, aceptadas, plan.diagnostico)
    return written.ok
      ? { ok: true, acciones: aceptadas }
      : { ok: false, reason: `No se pudo escribir: ${written.reason}` }
  }

  if (!plan.acciones.length) return { ok: true, sinCambios: true, diagnostico: plan.diagnostico }
  if (options.dryRun) return { ok: true, dryRun: true, acciones: plan.acciones }

  const written = applyAccept(root, plan.acciones, plan.diagnostico)
  return written.ok
    ? { ok: true, acciones: plan.acciones }
    : { ok: false, reason: `No se pudo escribir: ${written.reason}` }
}

export function renderAccept(result) {
  const lines = ['']

  if (!result.ok) {
    lines.push(`  ${result.reason}`, '')
    return lines.join('\n')
  }

  if (result.sinCambios) {
    lines.push('  Nada que aceptar.', '')
    return lines.join('\n')
  }

  lines.push(`  ${result.dryRun ? 'Se aceptaría' : 'Aceptado'}:`, '')
  for (const accion of result.acciones) lines.push(renderAccion(accion), '')

  if (!result.dryRun) {
    lines.push(`  Actualizados ${MANIFEST_FILE} y ${LOCK_FILE}.`, '')
  }

  return lines.join('\n')
}

export { isInteractive }
