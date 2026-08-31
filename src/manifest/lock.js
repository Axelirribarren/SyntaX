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
// sin cambiar el significado del digest.

import { readFileSync } from 'node:fs'

import { ALGORITHM } from './digest.js'

// Versión propia, aparte de digestAlgorithm: el formato del archivo y el
// algoritmo del hash evolucionan por separado.
export const LOCK_VERSION = 1

export function buildLock(entries) {
  return {
    lockVersion: LOCK_VERSION,
    digestAlgorithm: ALGORITHM,
    generatedAt: new Date().toISOString(),
    skills: [...entries].sort(
      (a, b) => a.id.localeCompare(b.id, 'en') || a.target.localeCompare(b.target, 'en')
    )
  }
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
    return { ok: false, reason: `lockVersion ${lock.lockVersion} no soportada (esperada ${LOCK_VERSION}).` }
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
