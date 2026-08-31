import { kindLabel } from '../targets/contract.js'
import { formatTokens } from './tokenize.js'

// Salida legible en terminal. Sin colores ni dependencias: el reporte tiene que
// verse igual en una terminal de Windows, en un log de CI y pegado en un chat.

const MARKS = { alta: 'x', media: '!', info: '·' }

export function renderReport(report) {
  const lines = []

  lines.push('')
  lines.push(`SyntaX doctor · ${report.root}`)
  lines.push('')

  renderEnvironment(report, lines)
  renderCost(report, lines)

  for (const check of report.checks) {
    if (!check.findings?.length) continue
    renderCheck(check, lines)
  }

  renderLoss(report, lines)
  renderUnsupported(report, lines)
  renderVerdict(report, lines)

  return lines.join('\n')
}

function renderEnvironment(report, lines) {
  if (!report.environment.length) {
    lines.push('  No se detectó ningún runtime conocido en este proyecto.')
    lines.push('')
    return
  }

  for (const entry of report.environment) {
    const counts = Object.entries(entry.counts)
      .map(([kind, count]) => `${count} ${kindLabel(kind, count)}`)
      .join(' · ')
    lines.push(`  ${entry.label.padEnd(14)} ${counts || 'sin objetos'}`)
    for (const note of entry.notes) lines.push(`  ${' '.repeat(14)} · ${note}`)
  }
  lines.push('')
}

function renderCost(report, lines) {
  if (!report.cost) return

  const alcance = report.deep ? '' : '  (parcial)'
  lines.push(`  Costo de arranque       ${formatTokens(report.cost.total)} tokens${alcance}`)
  for (const part of report.cost.parts) {
    lines.push(
      `    ${part.label.padEnd(24)} ${formatTokens(part.tokens).padStart(9)}   ${part.detail || ''}`.trimEnd()
    )
    for (const item of part.breakdown || []) {
      lines.push(`      ${item.label.padEnd(22)} ${formatTokens(item.tokens).padStart(9)}   ${item.count} herramientas`)
    }
  }
  for (const gap of report.cost.unmeasured) {
    lines.push(`    ${'NO MEDIDO'.padEnd(24)} ${gap.label} — ${gap.reason}`)
  }
  lines.push('')
}

function renderCheck(check, lines) {
  lines.push(`  ${check.title}`)
  for (const finding of check.findings) {
    const mark = MARKS[finding.severity] || MARKS.info
    const confidence = finding.confidence === 'media' ? ' (confianza media)' : ''
    lines.push(`    ${mark} ${finding.message}${confidence}`)
    if (finding.detail) lines.push(`      ${finding.detail}`)
    for (const item of finding.items || []) lines.push(`      - ${item}`)
  }
  lines.push('')
}

function renderLoss(report, lines) {
  if (!report.loss.length) return

  lines.push('  Pérdida al compilar')
  for (const entry of report.loss) {
    if (entry.missing.length) {
      const kinds = entry.missing.map((kind) => kindLabel(kind)).join(', ')
      lines.push(`    ${entry.label}: no sabe expresar ${kinds}`)
    }
    for (const caveat of entry.caveats) {
      lines.push(`    ${entry.label}: ${caveat.note || `${caveat.kind} es de alcance ${caveat.scope}`}`)
    }
  }
  lines.push('')
}

function renderUnsupported(report, lines) {
  if (!report.unsupportedRuntimes.length) return

  lines.push('  Runtimes presentes sin adapter')
  for (const runtime of report.unsupportedRuntimes) {
    lines.push(`    ${runtime.label} (${runtime.found.join(', ')})`)
  }
  lines.push('    Sumar uno: ver "Cómo sumar un runtime" en docs/agent-brief.md')
  lines.push('')
}

function renderVerdict(report, lines) {
  const findings = report.checks.flatMap((check) => check.findings || [])
  const high = findings.filter((finding) => finding.severity === 'alta').length

  if (!findings.length) {
    lines.push('  Sin hallazgos.')
    lines.push('')
    return
  }

  lines.push(`  ${findings.length} hallazgos (${high} de severidad alta).`)
  lines.push(
    report.deep
      ? '  doctor levantó los MCP servers para medirlos; no modificó nada.'
      : '  doctor es solo lectura: no se modificó nada. Para medir los MCP: --deep'
  )
  lines.push('')
}
