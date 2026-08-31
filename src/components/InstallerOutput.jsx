import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { generatePowerShell, generateBash, mcpPreview, pluginCommands, portablePlan, SKILL_TARGETS } from '../lib/install'

const OUTPUTS = [
  { id: 'ps1', label: 'install.ps1', filename: 'install-kit.ps1', build: generatePowerShell },
  { id: 'sh', label: 'install.sh', filename: 'install-kit.sh', build: generateBash },
  { id: 'mcp', label: '.mcp.json', filename: 'mcp.json', build: mcpPreview },
  {
    id: 'plan',
    label: 'SyntaX plan',
    filename: 'syntax-plan.json',
    build: (plan) => JSON.stringify(portablePlan(plan), null, 2) + '\n'
  }
]

export default function InstallerOutput({ plan }) {
  const [output, setOutput] = useState('ps1')
  const [copied, setCopied] = useState(false)
  const [targetMode, setTargetMode] = useState('codex')

  const skillTargets = targetMode === 'both' ? ['codex', 'claude'] : [targetMode]
  const effectivePlan = { ...plan, skillTargets }

  const active = OUTPUTS.find((o) => o.id === output)
  const script = plan.isEmpty ? '' : active.build(effectivePlan)

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
        {plan.packages.length} paquete(s) · {plan.plugins.length} plugin(s). Corrélo desde la raíz de tu proyecto.
      </p>

      {plan.skills.length > 0 && (
        <div className="target-picker">
          <div>
            <strong>¿Dónde querés instalar las skills?</strong>
            <span>Codex usa `.agents/skills`; Claude Code usa `.claude/skills`.</span>
          </div>
          <div className="chips">
            {[
              { id: 'codex', label: SKILL_TARGETS.codex.label },
              { id: 'claude', label: SKILL_TARGETS.claude.label },
              { id: 'both', label: 'Ambos' }
            ].map((target) => (
              <button
                key={target.id}
                className={`chip ${targetMode === target.id ? 'active' : ''}`}
                onClick={() => setTargetMode(target.id)}
              >
                {target.label}
              </button>
            ))}
          </div>
        </div>
      )}

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
        <button onClick={copy}>
          {/* AnimatePresence con mode="popLayout": el botón no cambia de ancho
              de golpe cuando "Copiar" (7 letras) se reemplaza por "¡Copiado!"
              (10 letras) — el layout se acomoda mientras el texto cruza. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={copied ? 'copiado' : 'copiar'}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.14 }}
              style={{ display: 'inline-block' }}
            >
              {copied ? '¡Copiado!' : 'Copiar'}
            </motion.span>
          </AnimatePresence>
        </button>
        <button onClick={download}>Descargar {active.filename}</button>
      </div>

      {/* Cross-fade al cambiar de pestaña (ps1/sh/.mcp.json): sin esto el
          contenido del <pre> se reemplaza de golpe y es fácil no notar que
          cambió de formato. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.pre
          key={output}
          className="script"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {script}
        </motion.pre>
      </AnimatePresence>

      {plan.plugins.length > 0 && (
        <div className="kit-note">
          <strong>Los plugins van aparte.</strong> No son shell: pegá estas líneas en Claude Code.
          <pre className="script small">{pluginCommands(plan).join('\n')}</pre>
        </div>
      )}
    </>
  )
}
