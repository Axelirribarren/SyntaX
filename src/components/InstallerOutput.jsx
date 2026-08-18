import { useState } from 'react'
import { generatePowerShell, generateBash, mcpPreview, pluginCommands } from '../lib/install'

const OUTPUTS = [
  { id: 'ps1', label: 'install.ps1', filename: 'install-kit.ps1', build: generatePowerShell },
  { id: 'sh', label: 'install.sh', filename: 'install-kit.sh', build: generateBash },
  { id: 'mcp', label: '.mcp.json', filename: 'mcp.json', build: mcpPreview }
]

export default function InstallerOutput({ plan }) {
  const [output, setOutput] = useState('ps1')
  const [copied, setCopied] = useState(false)

  const active = OUTPUTS.find((o) => o.id === output)
  const script = plan.isEmpty ? '' : active.build(plan)

  async function copy() {
    await navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  function download() {
    // Windows PowerShell 5.1 lee un .ps1 sin BOM como ANSI y rompe los acentos,
    // así que el .ps1 se baja con BOM. El .sh no lo lleva: rompería el shebang.
    const body = active.id === 'ps1' ? '﻿' + script : script
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = active.filename
    a.click()
    URL.revokeObjectURL(url)
  }

  if (plan.isEmpty) {
    return <p className="status">Marcá al menos un item para generar el script.</p>
  }

  return (
    <>
      <p className="kit-output-summary">
        {plan.skills.length} skill(s) · {plan.servers.length} MCP server(s) ·{' '}
        {plan.plugins.length} plugin(s). Corrélo desde la raíz de tu proyecto.
      </p>

      <div className="chips">
        {OUTPUTS.map((o) => (
          <button
            key={o.id}
            className={`chip ${output === o.id ? 'active' : ''}`}
            onClick={() => setOutput(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="kit-output-actions">
        <button onClick={copy}>{copied ? '¡Copiado!' : 'Copiar'}</button>
        <button onClick={download}>Descargar {active.filename}</button>
      </div>

      <pre className="script">{script}</pre>

      {plan.plugins.length > 0 && (
        <div className="kit-note">
          <strong>Los plugins van aparte.</strong> No son shell: pegá estas líneas en Claude Code.
          <pre className="script small">{pluginCommands(plan).join('\n')}</pre>
        </div>
      )}
    </>
  )
}
