import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runImport } from '../src/import.js'
import { runVerify, EXIT } from '../src/verify.js'
import { parseManifest } from '../src/manifest/parse.js'
import { writeAllAtomic } from '../src/manifest/atomic.js'

export function proyecto(skills) {
  const root = mkdtempSync(join(tmpdir(), 'syntax-import-'))
  for (const [ruta, cuerpo] of Object.entries(skills)) {
    const dir = join(root, ruta)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'SKILL.md'), cuerpo)
  }
  writeFileSync(join(root, 'CLAUDE.md'), '# Reglas\n')
  writeFileSync(join(root, 'AGENTS.md'), '# Reglas\n')
  return root
}

const skill = (nombre) => `---\nname: ${nombre}\ndescription: hace algo.\n---\n\nCuerpo.\n`

// El repo de referencia: una skill en los dos targets, otra solo en Claude Code.
function conDrift() {
  return proyecto({
    '.claude/skills/compartida': skill('compartida'),
    '.claude/skills/solo-claude': skill('solo-claude'),
    '.agents/skills/compartida': skill('compartida')
  })
}

test('la adopción fiel deja el primer verify limpio', () => {
  // Es LA prueba de que import observa sin inferir intención. Si el primer
  // verify fallara, import habría escrito una política de convergencia que
  // nadie pidió y que no se deduce del disco.
  const root = conDrift()
  const importado = runImport(root)

  assert.equal(importado.ok, true)
  assert.equal(runVerify(root).exit, EXIT.LIMPIO)
})

test('la adopción fiel declara cada skill donde se la observó', () => {
  const root = conDrift()
  runImport(root)

  const { manifest } = parseManifest(readFileSync(join(root, 'syntax.yaml'), 'utf8'))
  const compartida = manifest.components.find((c) => c.id === 'compartida')
  const soloClaude = manifest.components.find((c) => c.id === 'solo-claude')

  assert.deepEqual(compartida.targets.sort(), ['claude-code', 'codex'])
  assert.deepEqual(soloClaude.targets, ['claude-code'])
  assert.equal(manifest.targetPolicy, undefined, 'sin política explícita no se escribe ninguna')
})

test('--mirror escribe la política en el manifest y recién ahí aparece el drift', () => {
  const root = conDrift()
  runImport(root, { mirror: true })

  const { manifest } = parseManifest(readFileSync(join(root, 'syntax.yaml'), 'utf8'))
  assert.equal(manifest.targetPolicy, 'mirror')

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.DIFERENCIAS)
  assert.deepEqual(resultado.missing, [{ id: 'solo-claude', target: 'codex' }])
})

test('el lock guarda una entrada por skill y por target', () => {
  const root = conDrift()
  runImport(root)

  const lock = JSON.parse(readFileSync(join(root, 'syntax.lock'), 'utf8'))
  assert.equal(lock.skills.length, 3)
  assert.equal(lock.digestAlgorithm, 'syntax-skill-tree-v1')
  assert.equal(lock.lockVersion, 1)
})

test('import crea pero no fusiona', () => {
  const root = conDrift()
  runImport(root)

  const segundo = runImport(root)
  assert.equal(segundo.ok, false)
  assert.match(segundo.reason, /ya existe/)

  assert.equal(runImport(root, { force: true }).ok, true)
})

test('--dry-run no escribe nada', () => {
  const root = conDrift()
  const resultado = runImport(root, { dryRun: true })

  assert.equal(resultado.ok, true)
  assert.equal(existsSync(join(root, 'syntax.yaml')), false)
  assert.equal(existsSync(join(root, 'syntax.lock')), false)
})

test('detecta la divergencia antes de escribir', () => {
  const root = proyecto({
    '.claude/skills/compartida': skill('compartida'),
    '.agents/skills/compartida': `${skill('compartida')}\nEsta copia es distinta.\n`
  })

  const resultado = runImport(root, { dryRun: true })
  assert.equal(resultado.diverged.length, 1)
  assert.equal(resultado.diverged[0].id, 'compartida')
})

test('reporta el desacuerdo entre carpeta y frontmatter sin resolverlo solo', () => {
  const root = proyecto({ '.claude/skills/carpeta': skill('otro-nombre') })
  const resultado = runImport(root, { dryRun: true })

  const hallazgo = resultado.observed.problems.find((p) => p.kind === 'nombre-discordante')
  assert.ok(hallazgo)
  // La identidad sigue siendo la carpeta: es lo que el runtime carga.
  assert.equal(resultado.manifest.components[0].id, 'carpeta')
})

test('la escritura es atómica: si falla un archivo no queda el otro', () => {
  const root = mkdtempSync(join(tmpdir(), 'syntax-atomic-'))
  const bueno = join(root, 'uno.txt')

  const resultado = writeAllAtomic([
    { path: bueno, content: 'a' },
    { path: join(root, 'no', 'existe', 'dos.txt'), content: 'b' }
  ])

  assert.equal(resultado.ok, false)
  assert.equal(existsSync(bueno), false, 'no puede quedar un contrato sin su lock')
  assert.deepEqual(readdirSync(root), [])
})
