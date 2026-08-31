import test from 'node:test'
import assert from 'node:assert/strict'

import { KITS } from '../src/data/kits.js'
import { buildPlan, generateBash, generatePowerShell, portablePlan } from '../src/lib/install.js'
import { detectConcepts, recommend } from '../src/lib/recommend.js'
import { createProfileMarkdown, safeUsername } from '../src/lib/profile.js'
import { commandInvocation } from '../scripts/run-command.mjs'
import { replaceSkillDirectory } from '../scripts/skill-files.mjs'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('detecta una experiencia 3D animada y con rendimiento', () => {
  const concepts = detectConcepts('Landing inmersiva con Three.js, scroll animado y buen rendimiento')
  assert.equal(concepts.has('tres_d'), true)
  assert.equal(concepts.has('animacion'), true)
  assert.equal(concepts.has('rendimiento'), true)
})

test('no confunde una animación de interfaz con una exportación GIF o video', () => {
  const concepts = detectConcepts('Landing 3D con scroll animado y transiciones')
  assert.equal(concepts.has('animacion'), true)
  assert.equal(concepts.has('gif_video'), false)
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

  assert.equal(portable.schemaVersion, 2)
  assert.deepEqual(portable.installation.skillTargets, ['codex'])
  assert.deepEqual(portable.requirements.frameworks, ['react'])
  assert.deepEqual(portable.operations.packages, [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    'motion'
  ])
})

test('los instaladores descargables respaldan MCPs y skills existentes', () => {
  const kit = KITS.find((entry) => entry.id === 'visual-3d')
  const plan = buildPlan(kit, new Set(['frontend-design', 'chrome-devtools-mcp']))

  const powershell = generatePowerShell(plan)
  const bash = generateBash(plan)

  assert.match(powershell, /Copy-Item -Force \$mcpPath/)
  assert.match(powershell, /Copy-Item -Recurse -Force \$dest \$backup/)
  assert.match(bash, /fs\.copyFileSync\(target/)
  assert.match(bash, /mv "\$SKILLS_ROOT\/frontend-design"/)
})

test('puede instalar una misma selección para Codex y Claude Code', () => {
  const kit = KITS.find((entry) => entry.id === 'visual-3d')
  const plan = {
    ...buildPlan(kit, new Set(['frontend-design'])),
    skillTargets: ['codex', 'claude']
  }

  const portable = portablePlan(plan)
  const powershell = generatePowerShell(plan)
  const bash = generateBash(plan)

  assert.deepEqual(portable.installation.skillTargets, ['codex', 'claude'])
  assert.match(powershell, /\.agents\\skills/)
  assert.match(powershell, /\.claude\\skills/)
  assert.match(bash, /\.agents\/skills/)
  assert.match(bash, /\.claude\/skills/)
})

test('genera un README de perfil sin incorporar un usuario inválido', () => {
  const markdown = createProfileMarkdown({ username: '@axel<script>', name: 'Axel <dev>', style: 'aurora', project: 'SyntaX' })
  assert.equal(safeUsername('@axel<script>'), 'axelscript')
  assert.match(markdown, /github\.com\/axelscript\.png/)
  assert.match(markdown, /Proyecto destacado/)
  assert.match(markdown, /Axel &lt;dev&gt;/)
})

test('exporta stack de GitHub Profile sin incorporar banners HTTP inseguros', () => {
  const markdown = createProfileMarkdown({
    name: 'SyntaX',
    bannerUrl: 'http://sitio-inseguro.test/banner.png',
    stack: 'React, Three.js',
    showStats: false,
    style: 'prism'
  })
  assert.match(markdown, /React/)
  assert.match(markdown, /Three\.js/)
  assert.doesNotMatch(markdown, /sitio-inseguro/)
})

test('ejecuta npm mediante cmd.exe en Windows sin usar shell:true', () => {
  const invocation = commandInvocation('npm', ['install', '@react-three/fiber'], 'win32')
  assert.match(invocation.command.toLowerCase(), /cmd\.exe$/)
  assert.deepEqual(invocation.args, ['/d', '/s', '/c', 'npm.cmd install @react-three/fiber'])
  assert.deepEqual(commandInvocation('bun', ['add', 'three'], 'win32'), {
    command: 'bun',
    args: ['add', 'three']
  })
})

test('respalda una skill antes de reemplazar su contenido', () => {
  const root = mkdtempSync(join(tmpdir(), 'syntax-skill-test-'))
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
