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
  import: { summary: 'Genera syntax.yaml desde lo que ya hay en disco.', implemented: false },
  build: { summary: 'Compila el manifest a un runtime, con reporte de pérdida.', implemented: false },
  lock: { summary: 'Fija SHAs y versiones en syntax.lock.', implemented: false },
  verify: { summary: 'Falla si el entorno derivó del manifest. Para CI.', implemented: false },
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
  lines.push('')
  lines.push('  --deep  levanta los MCP servers declarados para medir sus schemas.')
  lines.push('          Ejecuta los comandos del .mcp.json del proyecto auditado.')
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

async function main(argv) {
  const args = argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    console.log(usage())
    return
  }

  if (command !== 'doctor') {
    const known = COMMANDS[command]
    console.error(
      known
        ? `'${command}' todavía no está implementado: ${known.summary}`
        : `Comando desconocido: ${command}`
    )
    console.error(usage())
    process.exitCode = 1
    return
  }

  await doctor(args.slice(1))
}

main(process.argv)
