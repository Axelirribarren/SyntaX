import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
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

// Stagger de dos niveles: la sección (motion.section) dispara staggerChildren
// sobre sus hijos directos (lectura, grillas, instalador), y cada grilla a su
// vez dispara su propio staggerChildren sobre las tarjetas. motion propaga el
// estado "show" del padre a cualquier hijo con variants y sin animate propio,
// así que no hace falta orquestar nada a mano.
const seccionVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } }
}
const bloqueVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } }
}
const grillaVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } }
}
const tarjetaVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } }
}

function Tarjeta({ resultado, elegido, onToggle }) {
  const { item, matched, relevance } = resultado
  return (
    <motion.label
      className={`idea-card ${elegido ? 'on' : ''}`}
      variants={tarjetaVariants}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
    >
      <div className="idea-card-top">
        <input type="checkbox" checked={elegido} onChange={() => onToggle(item.id)} />
        <span className="idea-card-name">{item.name}</span>
        <span className="badge type">{TYPE_TAG[item.type]}</span>
      </div>

      {relevance != null && (
        <div className="idea-bar" title={`Relevancia ${relevance}%`}>
          {/* Ancho animado: la barra se llena al aparecer en vez de nacer
              con su valor final — muestra el puntaje calculándose. */}
          <motion.span
            initial={{ width: '0%' }}
            animate={{ width: `${relevance}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
          />
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
    </motion.label>
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
        <motion.button type="submit" whileTap={{ scale: 0.97 }}>
          Recomendame skills
        </motion.button>
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
        // key={consulta}: cada búsqueda nueva remonta la sección entera, así
        // el stagger vuelve a correr desde cero en vez de quedar "gastado"
        // después de la primera vez.
        <motion.section key={consulta} variants={seccionVariants} initial="hidden" animate="show">
          <motion.div className="idea-lectura" variants={bloqueVariants}>
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
          </motion.div>

          <motion.div className="idea-grid" variants={grillaVariants}>
            {fuertes.map((r) => (
              <Tarjeta
                key={r.item.id}
                resultado={r}
                elegido={seleccion.has(r.item.id)}
                onToggle={toggle}
              />
            ))}
          </motion.div>

          {sugeridos.length > 0 && (
            <motion.div variants={bloqueVariants}>
              <h3 className="idea-subtitulo">
                También podría servirte
                <span className="kit-group-hint">
                  coincidencias laterales — no vienen tildadas
                </span>
              </h3>
              <motion.div className="idea-grid" variants={grillaVariants} initial="hidden" animate="show">
                {sugeridos.map((r) => (
                  <Tarjeta
                    key={r.item.id}
                    resultado={r}
                    elegido={seleccion.has(r.item.id)}
                    onToggle={toggle}
                  />
                ))}
              </motion.div>
            </motion.div>
          )}

          <motion.section className="kit-output" variants={bloqueVariants}>
            <h3>Instalador</h3>
            <InstallerOutput plan={plan} />
          </motion.section>
        </motion.section>
      )}
    </div>
  )
}
