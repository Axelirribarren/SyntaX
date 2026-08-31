import test from 'node:test'
import assert from 'node:assert/strict'

import { OBJECT_KINDS, comparableKinds, defineTarget, supportedKinds, unsupportedKinds } from '../src/targets/contract.js'
import { TARGETS, getTarget } from '../src/targets/index.js'
import { detectUnsupported } from '../src/targets/unknown.js'
import { validateManifest } from '../src/manifest/schema.js'

test('un adapter incompleto se rechaza al definirse, no al usarse', () => {
  assert.throws(() => defineTarget({ id: 'roto', label: 'Roto' }), /falta detect/)
})

test('un adapter no puede declarar objetos que no son universales', () => {
  assert.throws(
    () => defineTarget({ id: 'x', label: 'X', detect: () => false, read: () => ({}), supports: { plugin: {} } }),
    /no es un objeto universal/
  )
})

test('la pérdida sale del supports declarado', () => {
  const codex = getTarget('codex')
  const perdidos = unsupportedKinds(codex)

  // Codex no sabe expresar hooks ni permisos. Eso no se escribe en ningún lado:
  // se deduce de que su `supports` no los declara. Es lo que hace que sumar un
  // runtime no cueste escribir conversiones contra todos los demás.
  assert.ok(perdidos.includes('hook'))
  assert.ok(perdidos.includes('permission'))
  assert.ok(!perdidos.includes('skill'))
})

test('solo se comparan los objetos que ambos runtimes soportan', () => {
  const compartidos = comparableKinds(getTarget('claude-code'), getTarget('codex'))

  assert.deepEqual(compartidos.sort(), ['mcp', 'rule', 'skill'])
})

test('todos los adapters registrados cumplen el contrato', () => {
  for (const target of TARGETS) {
    assert.ok(target.id && target.label)
    assert.ok(supportedKinds(target).length > 0)
    for (const kind of supportedKinds(target)) assert.ok(OBJECT_KINDS.includes(kind))
  }
})

test('reconoce runtimes que todavía no sabemos compilar', () => {
  const encontrados = detectUnsupported(process.cwd(), ['claude-code', 'codex'])
  assert.ok(Array.isArray(encontrados))
})

test('el manifest sin pin se reporta como no reproducible', () => {
  const errores = validateManifest({
    version: 2,
    name: 'x',
    targets: ['claude-code'],
    components: [{ kind: 'skill', id: 'frontend-design', source: 'anthropics/skills' }]
  })

  assert.ok(errores.some((error) => /no es reproducible/.test(error)))
})

test('el manifest rechaza secretos literales', () => {
  const errores = validateManifest({
    version: 2,
    name: 'x',
    targets: ['claude-code'],
    components: [{ kind: 'mcp', id: 'figma', env: { FIGMA_API_KEY: 'fig_123' } }]
  })

  assert.ok(errores.some((error) => /los secretos no van al manifest/.test(error)))
})
