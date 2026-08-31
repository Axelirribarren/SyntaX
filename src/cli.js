#!/usr/bin/env node

import { resolve } from 'node:path'

import { runDoctor } from './doctor/index.js'
import { renderReport } from './doctor/report.js'

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
  lines.push('  syntax doctor [ruta] [--json]')
  lines.push('')
  return lines.join('\n')
}

function main(argv) {
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

  const rest = args.slice(1)
  const json = rest.includes('--json')
  const root = resolve(rest.find((arg) => !arg.startsWith('--')) || '.')

  const report = runDoctor(root)
  console.log(json ? JSON.stringify(report, null, 2) : renderReport(report))
}

main(process.argv)
