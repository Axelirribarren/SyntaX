import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runImport } from '../src/import.js'
import { runVerify, EXIT } from '../src/verify.js'
import { parseManifest } from '../src/manifest/parse.js'
import { writeAllAtomic } from '../src/manifest/atomic.js'
import { writeJournal } from '../src/manifest/journal.js'
import { proyecto, skill } from '../fixtures/proyecto.mjs'


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

  const { manifest } = parseManifest(readFileSync(join(root, 'pactlock.yaml'), 'utf8'))
  const compartida = manifest.components.find((c) => c.id === 'compartida')
  const soloClaude = manifest.components.find((c) => c.id === 'solo-claude')

  assert.deepEqual(compartida.targets.sort(), ['claude-code', 'codex'])
  assert.deepEqual(soloClaude.targets, ['claude-code'])
  assert.equal(manifest.targetPolicy, undefined, 'sin política explícita no se escribe ninguna')
})

test('--mirror escribe la política en el manifest y recién ahí aparece el drift', () => {
  const root = conDrift()
  runImport(root, { mirror: true })

  const { manifest } = parseManifest(readFileSync(join(root, 'pactlock.yaml'), 'utf8'))
  assert.equal(manifest.targetPolicy, 'mirror')

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.DIFERENCIAS)
  assert.deepEqual(resultado.missing, [{ id: 'solo-claude', target: 'codex' }])
})

test('el lock guarda una entrada por skill y por target', () => {
  const root = conDrift()
  runImport(root)

  const lock = JSON.parse(readFileSync(join(root, 'pactlock.lock'), 'utf8'))
  assert.equal(lock.skills.length, 3)
  assert.equal(lock.digestAlgorithm, 'syntax-skill-tree-v1')
  assert.equal(lock.lockVersion, 2)
  assert.ok(lock.manifestDigest, 'el lock tiene que poder decir a qué manifest corresponde')
  // El inventario por archivo es lo que le permite a `accept` decir qué cambió.
  assert.ok(lock.skills[0].inventory.length > 0)
  assert.ok(lock.skills[0].inventory[0].path)
})

test('import crea, no fusiona, y no tiene bypass', () => {
  // No hay --force: si `accept` es el único lugar donde se acepta drift, un
  // flag que reescribe el manifest entero lo puentea y pierde los `why`.
  const root = conDrift()
  runImport(root)

  const segundo = runImport(root, { force: true })
  assert.equal(segundo.ok, false)
  assert.match(segundo.reason, /pactlock accept/)
})

test('--dry-run no escribe nada', () => {
  const root = conDrift()
  const resultado = runImport(root, { dryRun: true })

  assert.equal(resultado.ok, true)
  assert.equal(existsSync(join(root, 'pactlock.yaml')), false)
  assert.equal(existsSync(join(root, 'pactlock.lock')), false)
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

test('si falla la escritura de uno, no queda el otro a medias', () => {
  const root = mkdtempSync(join(tmpdir(), 'pactlock-atomic-'))
  const bueno = join(root, 'uno.txt')

  const resultado = writeAllAtomic([
    { path: bueno, content: 'a' },
    { path: join(root, 'no', 'existe', 'dos.txt'), content: 'b' }
  ])

  assert.equal(resultado.ok, false)
  assert.equal(existsSync(bueno), false, 'no puede quedar un contrato sin su lock')
  assert.deepEqual(readdirSync(root), [])
})

test('una escritura interrumpida deja journal y bloquea los comandos', () => {
  // Dos renames no son una transacción: el proceso puede morir en el medio. No
  // se promete atomicidad, se promete que la interrupción sea DETECTABLE.
  const root = conDrift()
  runImport(root)
  writeJournal(root, { command: 'import', files: ['pactlock.yaml', 'pactlock.lock'] })

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.ERROR)
  assert.match(resultado.error, /se interrumpió/)
})

test('el par manifest/lock tiene que ir junto', () => {
  const root = conDrift()
  runImport(root)

  // Alguien edita el contrato y no regenera la línea base: comparar digests
  // daría diferencias falsas. Es un error de estado, no un montón de drift.
  const manifestPath = join(root, 'pactlock.yaml')
  writeFileSync(
    manifestPath,
    readFileSync(manifestPath, 'utf8').replace('id: solo-claude', 'id: renombrada')
  )

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.ERROR)
  assert.match(resultado.error, /no corresponde/)
})
