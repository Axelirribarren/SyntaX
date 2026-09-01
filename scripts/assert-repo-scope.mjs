// Verifica que la observación mire SOLO el repo auditado.
//
// Si `verify` tomara skills globales del home del usuario, `--strict` en CI
// quedaría a merced de la imagen del runner: un cambio en la imagen de GitHub
// Actions rompería builds sin que nadie hubiera tocado el proyecto. Y en una
// máquina de trabajo, el resultado dependería de qué tiene instalado cada uno.

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { observeSkills } from '../src/observe.js'

const home = mkdtempSync(join(tmpdir(), 'syntax-home-'))
const proyecto = mkdtempSync(join(tmpdir(), 'syntax-scope-'))

// Una skill "global", del tipo que podría tener cualquiera en su máquina.
mkdirSync(join(home, '.claude/skills/global'), { recursive: true })
writeFileSync(
  join(home, '.claude/skills/global/SKILL.md'),
  '---\nname: global\ndescription: no debería aparecer.\n---\n'
)

// Un proyecto con una sola skill propia.
mkdirSync(join(proyecto, '.claude/skills/propia'), { recursive: true })
writeFileSync(
  join(proyecto, '.claude/skills/propia/SKILL.md'),
  '---\nname: propia\ndescription: la del repo.\n---\n'
)

process.env.HOME = home
process.env.USERPROFILE = home

const observado = observeSkills(proyecto)
const ids = observado.skills.map((skill) => skill.id).sort()

if (ids.length !== 1 || ids[0] !== 'propia') {
  console.error(`\n  La observación salió del repo. Esperaba ['propia'], encontró ${JSON.stringify(ids)}\n`)
  process.exit(1)
}

console.log('\n  La observación mira solo el repo: las skills del home no entran.\n')
