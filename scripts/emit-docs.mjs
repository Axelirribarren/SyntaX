// Compila docs/agent-brief.md a los archivos que lee cada runtime.
//
// Es deliberadamente el primer target adapter, en miniatura: un origen, varios
// destinos, una sección propia por runtime y verificación de drift. Cuando
// `syntax build` exista, este script se absorbe — y para entonces el repo ya
// venía compilando su propia documentación en vez de mantenerla a mano.
//
// Uso:
//   node scripts/emit-docs.mjs           escribe los destinos
//   node scripts/emit-docs.mjs --check   sale != 0 si algún destino quedó viejo

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'docs/agent-brief.md')

export const START = '<!-- SYNTAX:BRIEF:START — generado desde docs/agent-brief.md, no editar a mano -->'
export const END = '<!-- SYNTAX:BRIEF:END -->'

// Cada destino declara su archivo y lo poco que sí le es propio. La sección
// específica se escribe una sola vez: si el archivo ya existe, se respeta lo
// que haya fuera de los marcadores.
const TARGETS = [
  {
    id: 'claude-code',
    file: 'CLAUDE.md',
    specific: [
      '## Específico de Claude Code',
      '',
      'Comandos del repo:',
      '',
      '```bash',
      'npm test              # node --test',
      'npm run doctor        # auditar el entorno de este repo',
      'npm run docs          # regenerar CLAUDE.md y AGENTS.md desde el brief',
      '```',
      '',
      'El proyecto vive en `C:\\Proyectos GRANDES\\SyntaX\\SyntaX`, **fuera de OneDrive** a',
      'propósito: dentro de OneDrive la sincronización rompía `npm install`. No moverlo ni',
      'sugerir moverlo ahí.',
      '',
      'Este repo declara su propio entorno en `syntax.yaml` y es el caso de prueba de `doctor`.',
      'Si cambiás skills o MCP servers acá, corré `npm run doctor` y fijate que el reporte siga',
      'teniendo sentido: es el dogfood del producto.'
    ].join('\n')
  },
  {
    id: 'codex',
    file: 'AGENTS.md',
    specific: [
      '## Específico de Codex',
      '',
      'Comandos del repo:',
      '',
      '```bash',
      'npm test              # node --test',
      'npm run doctor        # auditar el entorno de este repo',
      'npm run docs          # regenerar CLAUDE.md y AGENTS.md desde el brief',
      '```',
      '',
      'Las skills para Codex viven en `.agents/skills/`. Hoy están desincronizadas respecto de',
      '`.claude/skills/` — ese drift es intencional mientras sirva de caso de prueba de `doctor`.',
      'No lo "arregles" copiando carpetas a mano sin avisar.'
    ].join('\n')
  }
]

// Un checkout de Windows con core.autocrlf trae CRLF; el bloque generado usa LF.
// Sin normalizar al leer, --check compara bytes y falla solo en Windows.
function readText(path) {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

function render(brief, target, previous) {
  const block = `${START}\n\n${brief.trim()}\n\n${END}`

  if (previous && previous.includes(START) && previous.includes(END)) {
    const before = previous.slice(0, previous.indexOf(START))
    const after = previous.slice(previous.indexOf(END) + END.length)
    return `${before}${block}${after}`
  }

  return `${block}\n\n${target.specific}\n`
}

function main() {
  const check = process.argv.includes('--check')
  const brief = readText(SOURCE)
  const stale = []

  for (const target of TARGETS) {
    const path = join(ROOT, target.file)
    const previous = existsSync(path) ? readText(path) : null
    const next = render(brief, target, previous)

    if (previous === next) continue

    if (check) {
      stale.push(target.file)
      continue
    }

    writeFileSync(path, next, 'utf8')
    console.log(`  ${previous === null ? 'creado' : 'actualizado'}  ${target.file}`)
  }

  if (!check) return

  if (stale.length) {
    console.error('Estos archivos quedaron viejos respecto de docs/agent-brief.md:')
    for (const file of stale) console.error(`  - ${file}`)
    console.error('\nCorré: npm run docs')
    process.exitCode = 1
    return
  }

  console.log('Documentación sincronizada.')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
