import { useMemo, useState } from 'react'
import { KITS } from '../data/kits'
import { buildPlan, generatePowerShell, generateBash, mcpPreview, pluginCommands } from '../lib/install'

const TYPE_LABEL = {
  skill: { label: 'Skill', hint: 'se copia a .claude/skills/' },
  mcp: { label: 'MCP server', hint: 'se agrega a .mcp.json' },
  plugin: { label: 'Plugin', hint: 'slash command en Claude Code' }
}

const OUTPUTS = [
  { id: 'ps1', label: 'install.ps1', filename: 'install-kit.ps1', build: generatePowerShell },
  { id: 'sh', label: 'install.sh', filename: 'install-kit.sh', build: generateBash },
  { id: 'mcp', label: '.mcp.json', filename: 'mcp.json', build: mcpPreview }
]

function recommendedIds(kit) {
  return new Set(kit.items.filter((i) => i.recommended).map((i) => i.id))
}

export default function KitView() {
  const [kitId, setKitId] = useState(KITS[0].id)
  const kit = useMemo(() => KITS.find((k) => k.id === kitId), [kitId])
  const [selection, setSelection] = useState(() => recommendedIds(KITS[0]))
  const [output, setOutput] = useState('ps1')
  const [copied, setCopied] = useState(false)

  function switchKit(id) {
    setKitId(id)
    setSelection(recommendedIds(KITS.find((k) => k.id === id)))
    setCopied(false)
  }

  function toggle(itemId) {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
    setCopied(false)
  }

  const plan = useMemo(() => buildPlan(kit, selection), [kit, selection])
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

  const grouped = ['skill', 'mcp', 'plugin']
    .map((type) => ({ type, items: kit.items.filter((i) => i.type === type) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="kits">
      <div className="chips">
        {KITS.map((k) => (
          <button
            key={k.id}
            className={`chip ${k.id === kitId ? 'active' : ''}`}
            onClick={() => switchKit(k.id)}
          >
            {k.name}
          </button>
        ))}
      </div>

      <div className="kit-intro">
        <h2>{kit.tagline}</h2>
        <p>{kit.description}</p>
      </div>

      <div className="kit-actions">
        <button className="link-btn" onClick={() => setSelection(recommendedIds(kit))}>
          Solo los recomendados
        </button>
        <button className="link-btn" onClick={() => setSelection(new Set(kit.items.map((i) => i.id)))}>
          Marcar todo
        </button>
        <button className="link-btn" onClick={() => setSelection(new Set())}>
          Limpiar
        </button>
      </div>

      {grouped.map(({ type, items }) => (
        <section key={type} className="kit-group">
          <h3>
            {TYPE_LABEL[type].label}
            <span className="kit-group-hint">{TYPE_LABEL[type].hint}</span>
          </h3>
          {items.map((item) => (
            <label key={item.id} className={`kit-item ${selection.has(item.id) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={selection.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <div className="kit-item-body">
                <div className="kit-item-head">
                  <span className="kit-item-name">{item.name}</span>
                  {item.recommended && <span className="badge rec">recomendado</span>}
                  {item.needsSecret && <span className="badge warn">necesita {item.needsSecret}</span>}
                </div>
                <p className="kit-item-why">{item.why}</p>
                <div className="card-meta">
                  <a href={`https://github.com/${item.repo}`} target="_blank" rel="noreferrer">
                    {item.repo}
                  </a>
                  <span className="badge">{item.license}</span>
                </div>
              </div>
            </label>
          ))}
        </section>
      ))}

      <section className="kit-output">
        <h3>Instalador</h3>
        {plan.isEmpty ? (
          <p className="status">Marcá al menos un item para generar el script.</p>
        ) : (
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
        )}
      </section>
    </div>
  )
}
