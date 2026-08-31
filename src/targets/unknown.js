// Runtimes que sabemos reconocer pero todavía no sabemos compilar.
//
// Reportarlos como "presente, sin adapter" en vez de ignorarlos cumple dos
// funciones: es honesto con quien corre `doctor` en un repo mixto (le decimos
// que vimos su Cursor y que no lo cubrimos), y es el embudo de contribución —
// la persona del equipo que trabaja con ese runtime sabe exactamente qué falta.

import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const KNOWN_SIGNATURES = [
  { id: 'cursor', label: 'Cursor', paths: ['.cursor/rules', '.cursor/mcp.json', '.cursorrules'] },
  { id: 'windsurf', label: 'Windsurf', paths: ['.windsurf', '.windsurfrules'] },
  { id: 'gemini-cli', label: 'Gemini CLI', paths: ['GEMINI.md', '.gemini'] },
  { id: 'copilot', label: 'GitHub Copilot', paths: ['.github/copilot-instructions.md'] },
  { id: 'opencode', label: 'opencode', paths: ['opencode.json', '.opencode'] },
  { id: 'cline', label: 'Cline / Roo', paths: ['.clinerules', '.roo'] },
  { id: 'continue', label: 'Continue', paths: ['.continue'] },
  { id: 'aider', label: 'Aider', paths: ['.aider.conf.yml', 'CONVENTIONS.md'] }
]

export function detectUnsupported(root, supportedIds = []) {
  return KNOWN_SIGNATURES.filter((signature) => !supportedIds.includes(signature.id))
    .map((signature) => {
      const found = signature.paths.filter((path) => existsSync(join(root, path)))
      return found.length ? { ...signature, found } : null
    })
    .filter(Boolean)
}
