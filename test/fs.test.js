import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { commandInvocation } from '../src/fs/run.js'
import { replaceSkillDirectory } from '../src/fs/skill-dir.js'
import { assertInside, isInside, safeSegment } from '../src/fs/safe-path.js'

// Estas tres utilidades sobrevivieron al cambio de rumbo porque no eran del
// buscador: son las que hacen que escribir en el proyecto de otra persona sea
// seguro y reversible. `build` las va a usar tal cual.

test('ejecuta npm mediante cmd.exe en Windows sin usar shell:true', () => {
  const invocation = commandInvocation('npm', ['install', '@react-three/fiber'], 'win32')
  assert.match(invocation.command.toLowerCase(), /cmd\.exe$/)
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm.cmd install @react-three/fiber'])
  assert.deepEqual(commandInvocation('bun', ['add', 'three'], 'win32'), {
    command: 'bun',
    args: ['add', 'three']
  })
})

test('rechaza argumentos que podrían inyectar operadores del shell', () => {
  assert.throws(() => commandInvocation('npm', ['install', 'x && rm -rf /'], 'win32'), /inseguro/)
})

test('respalda una skill antes de reemplazar su contenido', () => {
  const root = mkdtempSync(join(tmpdir(), 'pactlock-skill-test-'))
  const source = join(root, 'source')
  const destination = join(root, 'destination')
  mkdirSync(source)
  mkdirSync(destination)
  writeFileSync(join(source, 'SKILL.md'), 'nueva')
  writeFileSync(join(destination, 'SKILL.md'), 'anterior')

  const result = replaceSkillDirectory(source, destination, 'test')

  assert.equal(readFileSync(join(destination, 'SKILL.md'), 'utf8'), 'nueva')
  assert.equal(readFileSync(join(result.backup, 'SKILL.md'), 'utf8'), 'anterior')
})

test('no deja escribir fuera del destino permitido', () => {
  assert.throws(() => assertInside('/proyecto/../otro/archivo', '/proyecto'), /fuera del destino/)
  assert.equal(isInside('/proyecto/skills/x', '/proyecto'), true)
})

test('un nombre de skill no puede traer separadores ni traversal', () => {
  assert.equal(safeSegment('frontend-design'), 'frontend-design')
  assert.equal(safeSegment('../../etc'), null)
  assert.equal(safeSegment('a/b'), null)
  assert.equal(safeSegment('..'), null)
})
