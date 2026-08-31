import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { defineTarget, emptySnapshot } from './contract.js'
import { fileBytes, readSkillsDirectory } from './shared.js'

export default defineTarget({
  id: 'codex',
  label: 'Codex',

  detect(root) {
    return existsSync(join(root, '.agents')) || existsSync(join(root, 'AGENTS.md'))
  },

  // Menos expresivo que Claude Code, y esa asimetría es información, no una
  // carencia a disimular: todo `kind` ausente de acá aparece en el reporte de
  // pérdida al compilar hacia Codex.
  //
  // El matiz importante es `mcp`: la configuración de MCP de Codex es de
  // usuario, no de proyecto. No viaja con el repo. Un equipo que comparte
  // AGENTS.md NO comparte sus MCP servers, y esa es exactamente la clase de
  // divergencia silenciosa que este producto existe para mostrar.
  supports: {
    skill: { dir: '.agents/skills' },
    rule: { file: 'AGENTS.md', mode: 'merge-markdown' },
    mcp: {
      file: '.codex/config.toml',
      key: 'mcp_servers',
      scope: 'user',
      note: 'La config de MCP de Codex es de usuario, no de proyecto: no viaja con el repo.'
    }
  },

  read(root) {
    const snapshot = emptySnapshot(this)
    snapshot.present = this.detect(root)
    if (!snapshot.present) return snapshot

    const { skills, backups } = readSkillsDirectory(root, '.agents/skills')
    snapshot.objects.skill = skills
    snapshot.backups = backups

    const rulesPath = join(root, 'AGENTS.md')
    if (existsSync(rulesPath)) {
      snapshot.objects.rule = [
        { id: 'AGENTS.md', kind: 'rule', relativePath: 'AGENTS.md', bytes: fileBytes(rulesPath) }
      ]
    }

    // Solo se lee si el proyecto trae su propio config.toml. El del usuario
    // queda deliberadamente fuera: `doctor` audita un repo, y prometer que ve
    // MCP que en realidad viven en el home de cada persona sería mentir sobre
    // el alcance del reporte.
    const configPath = join(root, '.codex/config.toml')
    if (existsSync(configPath)) {
      snapshot.objects.mcp = readTomlServerNames(configPath).map((id) => ({
        id,
        kind: 'mcp',
        transport: 'stdio',
        relativePath: '.codex/config.toml'
      }))
    } else {
      snapshot.notes.push(
        'MCP de Codex no auditado: vive en la config de usuario, fuera del repo.'
      )
    }

    return snapshot
  }
})

// Extracción mínima de nombres de server, sin parser de TOML. Alcanza para
// contar y comparar, que es lo único que hace `doctor` hoy. Cuando `build`
// necesite escribir este archivo va a hacer falta un parser de verdad.
function readTomlServerNames(path) {
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return []
  }

  const names = new Set()
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*\[mcp_servers\.([^\]]+)\]/)
    if (match) names.add(match[1].replace(/^["']|["']$/g, ''))
  }
  return [...names]
}
