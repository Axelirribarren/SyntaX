import test from 'node:test'
import assert from 'node:assert/strict'

import { KITS } from '../src/data/kits.js'
import { buildPlan, portablePlan } from '../src/lib/install.js'
import { detectConcepts, recommend } from '../src/lib/recommend.js'

test('detecta una experiencia 3D animada y con rendimiento', () => {
  const concepts = detectConcepts('Landing inmersiva con Three.js, scroll animado y buen rendimiento')
  assert.equal(concepts.has('tres_d'), true)
  assert.equal(concepts.has('animacion'), true)
  assert.equal(concepts.has('rendimiento'), true)
})

test('recomienda el stack React Three para una idea 3D', () => {
  const result = recommend('Quiero una web 3D con Three.js y shaders')
  const recommendation = result.results.find((entry) => entry.item.id === 'react-three-stack')
  assert.ok(recommendation)
  assert.equal(recommendation.strong, true)
})

test('genera un plan portable con requisitos y paquetes deduplicados', () => {
  const kit = KITS.find((entry) => entry.id === 'visual-3d')
  const plan = buildPlan(kit, new Set(['react-three-stack', 'motion-package']))
  const portable = portablePlan(plan)

  assert.equal(portable.schemaVersion, 1)
  assert.deepEqual(portable.requirements.frameworks, ['react'])
  assert.deepEqual(portable.operations.packages, [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    'motion'
  ])
})
