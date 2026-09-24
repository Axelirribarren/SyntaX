import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { runImport } from '../src/import.js'
import { runVerify, EXIT } from '../src/verify.js'
import { proyecto, skill } from '../fixtures/proyecto.mjs'


function importado(skills, options) {
  const root = proyecto(skills)
  runImport(root, options)
  return root
}

test('limpio: exit 0', () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  assert.equal(runVerify(root).exit, EXIT.LIMPIO)
})

test('missing: la skill declarada ya no está', () => {
  const root = importado({
    '.claude/skills/una': skill('una'),
    '.claude/skills/otra': skill('otra')
  })
  rmSync(join(root, '.claude/skills/otra'), { recursive: true, force: true })

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.DIFERENCIAS)
  assert.deepEqual(resultado.missing, [{ id: 'otra', target: 'claude-code' }])
})

test('modified: el contenido cambió respecto del lock', () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  writeFileSync(join(root, '.claude/skills/una/SKILL.md'), `${skill('una')}\nalgo nuevo\n`)

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.DIFERENCIAS)
  assert.equal(resultado.modified[0].id, 'una')
})

test('un cambio de finales de línea NO es modified', () => {
  // Si esto fallara, `verify` sería inservible en un equipo mixto: git convierte
  // los finales de línea al hacer checkout en Windows.
  const root = importado({ '.claude/skills/una': skill('una') })
  const archivo = join(root, '.claude/skills/una/SKILL.md')
  writeFileSync(archivo, readFileSync(archivo, 'utf8').replace(/\n/g, '\r\n'))

  assert.equal(runVerify(root).exit, EXIT.LIMPIO)
})

test('diverged: mismo id, contenido distinto entre targets', () => {
  // Sin este estado las dos copias coinciden cada una con su propia entrada del
  // lock y pasan por válidas, aunque los runtimes se comporten distinto.
  const root = importado({
    '.claude/skills/compartida': skill('compartida'),
    '.agents/skills/compartida': skill('compartida')
  })
  writeFileSync(join(root, '.agents/skills/compartida/SKILL.md'), `${skill('compartida')}\nvariante\n`)

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.DIFERENCIAS)
  assert.equal(resultado.diverged[0].id, 'compartida')
})

test('unexpected: avisa pero no rompe, salvo --strict', () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  mkdirSync(join(root, '.claude/skills/nueva'), { recursive: true })
  writeFileSync(join(root, '.claude/skills/nueva/SKILL.md'), skill('nueva'))

  const normal = runVerify(root)
  assert.equal(normal.exit, EXIT.LIMPIO, 'probar una skill local no rompe el build del equipo')
  assert.deepEqual(normal.unexpected, [{ id: 'nueva', target: 'claude-code' }])

  assert.equal(runVerify(root, { strict: true }).exit, EXIT.DIFERENCIAS)
})

test('sin manifest ni lock: exit 2, que es error y no diferencia', () => {
  const root = proyecto({ '.claude/skills/una': skill('una') })
  const resultado = runVerify(root)

  assert.equal(resultado.exit, EXIT.ERROR)
  assert.match(resultado.error, /pactlock import/)
})

test('un lock de otro algoritmo es error, no un mundo de diferencias', () => {
  // Comparar digests incomparables reportaría que cambió absolutamente todo.
  const root = importado({ '.claude/skills/una': skill('una') })
  const lockPath = join(root, 'pactlock.lock')
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  lock.digestAlgorithm = 'syntax-skill-tree-v0'
  writeFileSync(lockPath, JSON.stringify(lock))

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.ERROR)
  assert.match(resultado.error, /regenerarlo/)
})

test('un manifest con YAML prohibido no se acepta a medias', () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  writeFileSync(
    join(root, 'pactlock.yaml'),
    'version: 2\nname: x\ntargets: &t\n  - claude-code\ncomponents: []\n'
  )

  const resultado = runVerify(root)
  assert.equal(resultado.exit, EXIT.ERROR)
  assert.match(resultado.error, /anchor/)
})

test('verify no escribe nada', () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  const antes = readdirSync(root, { recursive: true }).map(String).sort()

  runVerify(root)
  runVerify(root, { strict: true })

  assert.deepEqual(readdirSync(root, { recursive: true }).map(String).sort(), antes)
})

test('correr verify dos veces da lo mismo', () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  const uno = runVerify(root)
  const dos = runVerify(root)

  assert.deepEqual(dos, uno)
})
