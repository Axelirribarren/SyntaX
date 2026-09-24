import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { probeServer, probeEnvironment } from '../src/doctor/probe.js'
import { runDoctor } from '../src/doctor/index.js'
import { renderReport } from '../src/doctor/report.js'
import { detectTargets, readAll } from '../src/targets/index.js'

// El fixture vive fuera de test/ a propósito: el runner de Node ejecuta todo lo
// que hay bajo ese directorio, y un server MCP esperando stdin cuelga la suite.
const FAKE = join(import.meta.dirname, '../fixtures/fake-mcp-server.mjs')

function server(id, flags = []) {
  return { id, kind: 'mcp', transport: 'stdio', command: process.execPath, args: [FAKE, ...flags] }
}

test('levanta un server y cuenta los tokens de sus schemas', async () => {
  const probe = await probeServer(server('falso'))

  assert.equal(probe.ok, true)
  assert.equal(probe.count, 2)
  assert.ok(probe.tokens > 0)
  assert.deepEqual(probe.tools.map((tool) => tool.name).sort(), ['captura', 'navegar'])
})

test('tolera un server que escribe logs por stdout antes del handshake', async () => {
  // Pasa seguido en servers reales y romper por eso haría el probe inservible.
  const probe = await probeServer(server('ruidoso', ['--ruidoso']))

  assert.equal(probe.ok, true)
  assert.equal(probe.count, 2)
})

test('reporta el server que no arranca en vez de colgarse', async () => {
  const probe = await probeServer(server('muerto', ['--muere']))

  assert.equal(probe.ok, false)
  assert.match(probe.reason, /código 1/)
})

test('corta por timeout al server que no responde', async () => {
  const probe = await probeServer(server('mudo', ['--mudo']), { timeoutMs: 400 })

  assert.equal(probe.ok, false)
  assert.match(probe.reason, /no respondió/)
})

test('no ejecuta un server sin credenciales ni uno remoto', async () => {
  // Levantar un server remoto sería salir a internet con claves ajenas, y uno
  // sin credencial no arranca igual: en los dos casos se dice por qué.
  const sinClave = await probeServer({
    id: 'figma',
    transport: 'stdio',
    command: 'npx',
    emptyEnv: ['FIGMA_API_KEY']
  })
  assert.equal(sinClave.skipped, true)
  assert.match(sinClave.reason, /sin credenciales/)

  const remoto = await probeServer({ id: 'hosted', transport: 'http', url: 'https://ejemplo' })
  assert.equal(remoto.skipped, true)
  assert.match(remoto.reason, /remoto/)
})

test('mide cada server una sola vez aunque lo declaren dos runtimes', async () => {
  const snapshots = [
    { objects: { mcp: [server('compartido')] } },
    { objects: { mcp: [server('compartido')] } }
  ]

  const probes = await probeEnvironment(snapshots)
  assert.equal(probes.length, 1)
})

test('el costo pasa de parcial a completo con los probes', async () => {
  // Sobre un proyecto de verdad: el costo se atribuye por target mirando qué
  // servers declara cada uno, así que un probe suelto sin proyecto no alcanza.
  const root = mkdtempSync(join(tmpdir(), 'pactlock-costo-'))
  mkdirSync(join(root, '.claude/skills'), { recursive: true })
  writeFileSync(
    join(root, '.mcp.json'),
    JSON.stringify({ mcpServers: { falso: { command: process.execPath, args: [FAKE] } } })
  )

  const snapshots = readAll(root, detectTargets(root))
  const probes = await probeEnvironment(snapshots)

  const parcial = runDoctor(root)
  const completo = runDoctor(root, { probes })

  assert.equal(parcial.deep, false)
  assert.match(renderReport(parcial), /\(parcial\)/)
  assert.ok(parcial.cost.byTarget.some((entry) => entry.unmeasured.length > 0))

  assert.equal(completo.deep, true)
  const schemas = completo.cost.byTarget
    .flatMap((entry) => entry.parts)
    .find((part) => part.label.includes('schemas'))
  assert.ok(schemas, 'esperaba los schemas medidos entre las partes del costo')
  assert.ok(schemas.breakdown.length > 0, 'el desglose por server es lo que hace accionable el total')
})

test('los valores de env no viajan al reporte json', async () => {
  // La clave ya está en el .mcp.json; el reporte suele terminar en un log de CI
  // o pegado en un chat, así que no se multiplica dónde aparece.
  const { normalizeMcpServer } = await import('../src/targets/shared.js')
  const normalizado = normalizeMcpServer('figma', {
    command: 'npx',
    env: { FIGMA_API_KEY: 'fig_secreto_real' }
  })

  assert.equal(normalizado.envValues.FIGMA_API_KEY, 'fig_secreto_real')
  assert.ok(!JSON.stringify(normalizado).includes('fig_secreto_real'))
})

test('con --deep la redundancia de providers viene con precio', async () => {
  const snapshots = [
    {
      present: true,
      label: 'Claude Code',
      objects: { mcp: [server('chrome-devtools'), server('playwright')], skill: [] }
    }
  ]
  const probes = await probeEnvironment(snapshots)
  const report = runDoctor(process.cwd(), { probes })

  const navegador = report.checks
    .find((check) => check.id === 'providers')
    .findings.find((finding) => finding.message.includes('navegador'))

  assert.ok(navegador)
  assert.match(navegador.detail, /ahorra/)
  assert.ok(navegador.items.every((item) => item.includes('tokens')))
})
