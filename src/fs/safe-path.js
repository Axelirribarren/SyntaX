import { basename, isAbsolute, relative, resolve } from 'node:path'

// Toda escritura de SyntaX cae dentro del proyecto del usuario. Una ruta que
// escapa del destino previsto (por un `path` con `..` en el manifest, o por un
// nombre de skill con separadores) deja de ser un bug de la herramienta y pasa a
// ser escritura arbitraria en la máquina de quien la corre. Se valida siempre,
// aunque el dato venga de una fuente que ya se considera confiable.
export function assertInside(candidate, parent) {
  const rel = relative(resolve(parent), resolve(candidate))
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) return
  throw new Error(`Ruta fuera del destino permitido: ${basename(candidate)}`)
}

export function isInside(candidate, parent) {
  try {
    assertInside(candidate, parent)
    return true
  } catch {
    return false
  }
}

// Un solo segmento de nombre, sin separadores ni traversal. Para nombres que
// vienen del manifest y se usan como carpeta de destino.
export function safeSegment(value) {
  if (typeof value !== 'string' || !value.length) return null
  if (value === '.' || value === '..') return null
  if (/[\\/]/.test(value)) return null
  return value
}
