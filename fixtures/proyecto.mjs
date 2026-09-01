// Constructor de proyectos de prueba, compartido por varias suites.
//
// Vive en fixtures/ y no en test/ por dos razones: el runner de Node ejecuta
// todo lo que hay bajo test/, y si una suite importara el helper desde otra,
// los tests de esa otra correrían dos veces.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function proyecto(skills) {
  const root = mkdtempSync(join(tmpdir(), 'syntax-proyecto-'))
  for (const [ruta, cuerpo] of Object.entries(skills)) {
    const dir = join(root, ruta)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), cuerpo)
  }
  writeFileSync(join(root, 'CLAUDE.md'), '# Reglas\n')
  writeFileSync(join(root, 'AGENTS.md'), '# Reglas\n')
  return root
}

export const skill = (nombre) => `---\nname: ${nombre}\ndescription: hace algo.\n---\n\nCuerpo.\n`
