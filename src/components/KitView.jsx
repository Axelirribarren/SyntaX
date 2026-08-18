import { useMemo, useState } from 'react'
import { KITS } from '../data/kits'
import { buildPlan } from '../lib/install'
import InstallerOutput from './InstallerOutput.jsx'

const TYPE_LABEL = {
  skill: { label: 'Skill', hint: 'se copia a .claude/skills/' },
  mcp: { label: 'MCP server', hint: 'se agrega a .mcp.json' },
  plugin: { label: 'Plugin', hint: 'slash command en Claude Code' }
}

function recommendedIds(kit) {
  return new Set(kit.items.filter((i) => i.recommended).map((i) => i.id))
}

export default function KitView() {
  const [kitId, setKitId] = useState(KITS[0].id)
  const kit = useMemo(() => KITS.find((k) => k.id === kitId), [kitId])
  const [selection, setSelection] = useState(() => recommendedIds(KITS[0]))

  function switchKit(id) {
    setKitId(id)
    setSelection(recommendedIds(KITS.find((k) => k.id === id)))
  }

  function toggle(itemId) {
    setSelection((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const plan = useMemo(() => buildPlan(kit, selection), [kit, selection])

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
        <InstallerOutput plan={plan} />
      </section>
    </div>
  )
}
