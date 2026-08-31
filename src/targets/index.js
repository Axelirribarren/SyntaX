// Registro de adapters. Sumar un runtime es agregar un archivo y una línea acá.

import claudeCode from './claude-code.js'
import codex from './codex.js'

export const TARGETS = [claudeCode, codex]

export const TARGET_IDS = TARGETS.map((target) => target.id)

export function getTarget(id) {
  return TARGETS.find((target) => target.id === id) || null
}

// Los adapters cuyo runtime está efectivamente presente en el repo. `doctor`
// audita esto: no tiene sentido reportar Codex en un proyecto que nunca lo usó.
export function detectTargets(root) {
  return TARGETS.filter((target) => target.detect(root))
}

export function readAll(root, targets = detectTargets(root)) {
  return targets.map((target) => target.read(root))
}
