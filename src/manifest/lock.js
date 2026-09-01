// syntax.lock — la línea base de integridad.
//
// Es la tercera capa: observación (los adapters, en memoria), contrato
// (syntax.yaml, escrito por personas), integridad (esto, generado). Nunca se
// edita a mano, así que el contenido es JSON: se lee sin parser y no ensucia el
// diff del archivo que la gente sí edita.
//
// Una entrada por skill Y POR TARGET. La misma skill instalada en .claude/skills
// y en .agents/skills son dos copias con digests independientes: que difieran es
// un hallazgo (`diverged`), no algo que se promedie.
//
// Cuando llegue la resolución de origen, se SUMA acá (de dónde bajar cada cosa)
// sin cambiar el significado del digest. Por eso `updateEntry` toca campo por
// campo y nunca reconstruye la entrada: lo que no conoce, no lo pisa.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { ALGORITHM } from './digest.js'

// Versión propia, aparte de digestAlgorithm: el formato del archivo y el
// algoritmo del hash evolucionan por separado.
export const LOCK_VERSION = 2

export function buildLock(entries, manifest) {
  return {
    lockVersion: LOCK_VERSION,
    digestAlgorithm: ALGORITHM,
    manifestDigest: manifestDigest(manifest),
    generatedAt: new Date().toISOString(),
    skills: [...entries].sort(
      (a, b) => a.id.localeCompare(b.id, 'en') || a.target.localeCompare(b.target, 'en')
    )
  }
}

// Digest SEMÁNTICO del manifest: solo lo que es contrato. Deja afuera `why`,
// `name` y los comentarios a propósito, para que alguien pueda mejorar la
// justificación de una decisión sin invalidar el par manifest/lock.
//
// Sirve para detectar que los dos archivos no van juntos —alguien commiteó uno
// y no el otro, o una escritura se cortó a la mitad— y decirlo como error de
// estado en vez de reportar un mundo de diferencias falsas.
export function manifestDigest(manifest) {
  if (!manifest) return null

  const contrato = {
    targets: [...(manifest.targets || [])].sort(),
    targetPolicy: manifest.targetPolicy || 'faithful',
    components: (manifest.components || [])
      .map((component) => ({
        kind: component.kind,
        id: component.id,
        targets: [...(component.targets || [])].sort(),
        allowDivergence: [...(component.allowDivergence || [])].sort()
      }))
      .sort((a, b) => a.id.localeCompare(b.id, 'en') || a.kind.localeCompare(b.kind, 'en'))
  }

  return `sha256:${createHash('sha256').update(JSON.stringify(contrato)).digest('hex')}`
}

export function serializeLock(lock) {
  return `${JSON.stringify(lock, null, 2)}\n`
}

export function readLock(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch (error) {
    return { ok: false, reason: `No se pudo leer ${path}: ${error.code || error.message}` }
  }

  let lock
  try {
    lock = JSON.parse(raw)
  } catch (error) {
    return { ok: false, reason: `${path} no es JSON válido: ${error.message}` }
  }

  if (lock.lockVersion !== LOCK_VERSION) {
    return {
      ok: false,
      reason: `lockVersion ${lock.lockVersion} no soportada (esperada ${LOCK_VERSION}): hay que regenerarlo.`
    }
  }

  // Comparar digests de algoritmos distintos daría diferencias falsas en todo.
  // Mejor decir que el lock quedó viejo que reportar que cambió todo el mundo.
  if (lock.digestAlgorithm !== ALGORITHM) {
    return {
      ok: false,
      reason: `el lock usa el algoritmo '${lock.digestAlgorithm}' y el vigente es '${ALGORITHM}': hay que regenerarlo.`
    }
  }

  return { ok: true, lock }
}

export function findEntry(lock, id, target) {
  return (lock.skills || []).find((entry) => entry.id === id && entry.target === target) || null
}

// Actualiza SOLO los campos de integridad. Todo lo demás que la entrada tenga
// —hoy nada, mañana origen o commit— sobrevive intacto.
export function updateEntry(lock, id, target, observed) {
  const entrada = findEntry(lock, id, target)
  if (!entrada) return false

  entrada.digest = observed.digest
  entrada.files = observed.files
  entrada.inventory = observed.inventory
  return true
}

export function addEntry(lock, entry) {
  lock.skills.push(entry)
  lock.skills.sort((a, b) => a.id.localeCompare(b.id, 'en') || a.target.localeCompare(b.target, 'en'))
}

export function removeEntry(lock, id, target) {
  const antes = lock.skills.length
  lock.skills = lock.skills.filter((entry) => !(entry.id === id && entry.target === target))
  return lock.skills.length !== antes
}
