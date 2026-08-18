import { useMemo, useState } from 'react'
import { recommend } from '../lib/recommend'
import { buildPlan } from '../lib/install'
import { CONCEPT_LABELS } from '../data/concepts'
import InstallerOutput from './InstallerOutput.jsx'

const EJEMPLOS = [
  'Una landing linda para un restaurante, que se vea bien en el celular',
  'Mi app se ve genérica, quiero colores y tipografía con identidad propia',
  'Tengo el diseño en Figma y lo quiero pasar a React',
  'Necesito revisar por qué se rompe el layout y sacar capturas'
]

const TYPE_TAG = { skill: 'skill', mcp: 'MCP', plugin: 'plugin' }

function Tarjeta({ resultado, elegido, onToggle }) {
  const { item, matched, relevance } = resultado
  return (
    <label className={`idea-card ${elegido ? 'on' : ''}`}>
      <div className="idea-card-top">
        <input type="checkbox" checked={elegido} onChange={() => onToggle(item.id)} />
        <span className="idea-card-name">{item.name}</span>
        <span className="badge type">{TYPE_TAG[item.type]}</span>
      </div>

      {relevance != null && (
        <div className="idea-bar" title={`Relevancia ${relevance}%`}>
          <span style={{ width: `${relevance}%` }} />
        </div>
      )}

      <p className="kit-item-why">{item.why}</p>

      <div className="card-meta">
        {matched.map((c) => (
          <span key={c} className="badge match">
            {CONCEPT_LABELS[c] || c}
          </span>
        ))}
        {item.needsSecret && <span className="badge warn">necesita {item.needsSecret}</span>}
      </div>

      <div className="card-meta">
        <a href={`https://github.com/${item.repo}`} target="_blank" rel="noreferrer">
          {item.repo}
        </a>
        <span className="badge">{item.license}</span>
      </div>
    </label>
  )
}

export default function IdeaFinder() {
  const [idea, setIdea] = useState('')
  const [consulta, setConsulta] = useState('')
  const [seleccion, setSeleccion] = useState(new Set())

  const analisis = useMemo(() => (consulta ? recommend(consulta) : null), [consulta])

  function buscar(texto) {
    const limpio = texto.trim()
    if (!limpio) return
    setIdea(texto)
    setConsulta(limpio)
    // Solo se pre-tilda lo que matcheó fuerte y no pide una clave: el usuario
    // suma las sugerencias si quiere, pero el script sale limpio por defecto.
    setSeleccion(
      new Set(
        recommend(limpio)
          .results.filter((r) => r.strong && !r.item.needsSecret)
          .map((r) => r.item.id)
      )
    )
  }

  function toggle(id) {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const fuertes = analisis ? analisis.results.filter((r) => r.strong) : []
  const sugeridos = analisis ? analisis.results.filter((r) => !r.strong) : []

  const plan = useMemo(() => {
    if (!analisis) return null
    const kitSintetico = {
      name: consulta.length > 60 ? consulta.slice(0, 57) + '…' : consulta,
      items: analisis.results.map((r) => r.item)
    }
    return buildPlan(kitSintetico, seleccion)
  }, [analisis, seleccion, consulta])

  return (
    <div className="idea">
      <form
        className="idea-form"
        onSubmit={(e) => {
          e.preventDefault()
          buscar(idea)
        }}
      >
        <label htmlFor="idea-input">¿Qué querés construir?</label>
        <textarea
          id="idea-input"
          rows={3}
          value={idea}
          placeholder="Ej: quiero una landing linda para un restaurante, con buena tipografía y que se vea bien en el celular"
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) buscar(idea)
          }}
        />
        <button type="submit">Recomendame skills</button>
      </form>

      {!analisis && (
        <div className="idea-ejemplos">
          <span>O probá con:</span>
          {EJEMPLOS.map((ej) => (
            <button key={ej} className="chip" onClick={() => buscar(ej)}>
              {ej}
            </button>
          ))}
        </div>
      )}

      {analisis && (
        <>
          <div className="idea-lectura">
            {analisis.fallback ? (
              <p>
                No reconocí nada específico en lo que escribiste, así que te muestro el núcleo
                de diseño frontend. Probá nombrando qué querés lograr: colores, mobile, Figma,
                probar en el navegador…
              </p>
            ) : (
              <p>
                Entendí que se trata de{' '}
                {analisis.concepts.map((c, i) => (
                  <span key={c}>
                    {i > 0 && (i === analisis.concepts.length - 1 ? ' y ' : ', ')}
                    <strong>{CONCEPT_LABELS[c] || c}</strong>
                  </span>
                ))}
                .
              </p>
            )}
          </div>

          <div className="idea-grid">
            {fuertes.map((r) => (
              <Tarjeta
                key={r.item.id}
                resultado={r}
                elegido={seleccion.has(r.item.id)}
                onToggle={toggle}
              />
            ))}
          </div>

          {sugeridos.length > 0 && (
            <>
              <h3 className="idea-subtitulo">
                También podría servirte
                <span className="kit-group-hint">
                  coincidencias laterales — no vienen tildadas
                </span>
              </h3>
              <div className="idea-grid">
                {sugeridos.map((r) => (
                  <Tarjeta
                    key={r.item.id}
                    resultado={r}
                    elegido={seleccion.has(r.item.id)}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </>
          )}

          <section className="kit-output">
            <h3>Instalador</h3>
            <InstallerOutput plan={plan} />
          </section>
        </>
      )}
    </div>
  )
}
