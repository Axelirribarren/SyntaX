#!/usr/bin/env node

import { resolve } from 'node:path'

import { runDoctor } from './doctor/index.js'
import { renderReport } from './doctor/report.js'
import { probeEnvironment, DEFAULT_TIMEOUT_MS } from './doctor/probe.js'
import { detectTargets, readAll } from './targets/index.js'

const COMMANDS = {
  doctor: {
    summary: 'Audita el entorno de agente de un proyecto. Solo lectura.',
    implemented: true
  },
  import: { summary: 'Genera syntax.yaml y syntax.lock desde lo que hay en disco.', implemented: true },
  build: { summary: 'Compila el manifest a un runtime, con reporte de pérdida.', implemented: false },
  lock: { summary: 'Fija SHAs y versiones en syntax.lock.', implemented: false },
  verify: { summary: 'Falla si el entorno derivó del contrato. Solo lectura, para CI.', implemented: true },
  rollback: { summary: 'Revierte la última aplicación.', implemented: false }
}

function usage() {
  const lines = ['', 'SyntaX — compilador de entornos de agente', '']
  for (const [name, command] of Object.entries(COMMANDS)) {
    const mark = command.implemented ? ' ' : '·'
    lines.push(`  ${mark} ${name.padEnd(10)} ${command.summary}`)
  }
  lines.push('')
  lines.push('  · = todavía no implementado')
  lines.push('')
  lines.push('  syntax doctor [ruta] [--json] [--deep] [--timeout <segundos>]')
  lines.push('  syntax import [ruta] [--mirror] [--force] [--dry-run]')
  lines.push('  syntax verify [ruta] [--strict] [--json]')
  lines.push('')
  lines.push('  --deep    levanta los MCP servers declarados para medir sus schemas.')
  lines.push('            Ejecuta los comandos del .mcp.json del proyecto auditado.')
  lines.push('  --mirror  declara que la unión de skills debe existir en todos los')
  lines.push('            targets. Es una política, no una observación: queda escrita')
  lines.push('            en el manifest.')
  lines.push('  --strict  hace que unexpected también rompa el build.')
  lines.push('')
  return lines.join('\n')
}

function parseFlags(args) {
  const timeoutIndex = args.indexOf('--timeout')
  const seconds = timeoutIndex === -1 ? null : Number(args[timeoutIndex + 1])

  return {
    json: args.includes('--json'),
    deep: args.includes('--deep'),
    timeoutMs: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_TIMEOUT_MS,
    root: resolve(args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--timeout') || '.')
  }
}

async function doctor(args) {
  const flags = parseFlags(args)
  let probes = null

  if (flags.deep) {
    const snapshots = readAll(flags.root, detectTargets(flags.root))
    const servers = snapshots.flatMap((snapshot) => snapshot.objects.mcp || [])

    // Se avisa antes de ejecutar, no después. Quien corre esto en un repo que
    // no escribió está lanzando procesos definidos por otra persona, y merece
    // verlo antes de que pase.
    if (!flags.json) {
      console.error(`\n  --deep va a ejecutar ${servers.length} comandos declarados en el .mcp.json de este proyecto.`)
      console.error('  Puede tardar: la primera vez npx descarga cada server.\n')
    }

    probes = await probeEnvironment(snapshots, { cwd: flags.root, timeoutMs: flags.timeoutMs })
  }

  const report = runDoctor(flags.root, { probes })
  console.log(flags.json ? JSON.stringify(report, null, 2) : renderReport(report))
}

function rootFrom(args) {
  return resolve(args.find((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--timeout') || '.')
}

// La capa de manifest se carga con import() dinámico. Es aislamiento del CAMINO
// DE EJECUCIÓN, no de supply chain: npx instala `yaml` igual. Lo que se evita es
// que `doctor` —el comando con el que alguien prueba SyntaX en un repo ajeno—
// parse nada ni pague el arranque de una dependencia que no usa.
async function importar(args) {
  const { runImport, renderImport } = await import('./import.js')
  const result = runImport(rootFrom(args), {
    mirror: args.includes('--mirror'),
    force: args.includes('--force'),
    dryRun: args.includes('--dry-run')
  })

  console.log(renderImport(result))
  if (!result.ok) process.exitCode = 1
}

async function verificar(args) {
  const { runVerify, renderVerify } = await import('./verify.js')
  const result = runVerify(rootFrom(args), { strict: args.includes('--strict') })

  console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : renderVerify(result))
  process.exitCode = result.exit
}

async function main(argv) {
  const args = argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    console.log(usage())
    return
  }

  const rest = args.slice(1)

  if (command === 'doctor') return doctor(rest)
  if (command === 'import') return importar(rest)
  if (command === 'verify') return verificar(rest)

  const known = COMMANDS[command]
  console.error(
    known
      ? `'${command}' todavía no está implementado: ${known.summary}`
      : `Comando desconocido: ${command}`
  )
  console.error(usage())
  process.exitCode = 1
}

main(process.argv)
