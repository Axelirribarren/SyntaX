import { useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { recommend } from '../lib/recommend'
import { buildPlan } from '../lib/install'
import { CONCEPT_LABELS } from '../data/concepts'
import InstallerOutput from './InstallerOutput.jsx'

const EJEMPLOS = [
  'Una landing linda para un restaurante, que se vea bien en el celular',
  'Mi app se ve genérica, quiero colores y tipografía con identidad propia',
  'Tengo el diseño en Figma y lo quiero pasar a React',
  'Necesito revisar por qué se rompe el layout y sacar capturas',
  'Quiero una landing inmersiva con Three.js, scroll animado y buen rendimiento',
  'Necesito crear previews GIF animadas para mostrar el producto'
]

const SHOWCASES = [
  {
    kicker: 'Visual / 3D',
    title: 'Una landing que se siente viva',
    copy: 'Escenas WebGL, scroll narrativo y movimiento con intención.',
    prompt: 'Quiero una landing inmersiva con Three.js, scroll animado y buen rendimiento',
    tone: 'violet',
    symbol: '◇'
  },
  {
    kicker: 'Producto / UI',
    title: 'Un sistema visual coherente',
    copy: 'Dirección de arte, glassmorphism, responsive y accesibilidad.',
    prompt: 'Quiero rediseñar mi producto con glassmorphism, buena tipografía, responsive y accesibilidad',
    tone: 'cyan',
    symbol: '⌁'
  },
  {
    kicker: 'Calidad / Runtime',
    title: 'Una experiencia que también funciona',
    copy: 'Rendimiento, accesibilidad y pruebas reales antes de entregar.',
    prompt: 'Quiero mejorar el rendimiento, la accesibilidad y probar la experiencia en un navegador real',
    tone: 'lime',
    symbol: '✓'
  }
]

const TYPE_TAG = { skill: 'skill', mcp: 'MCP', plugin: 'plugin', package: 'paquete' }

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

export default function IdeaFinder({ onNavigate }) {
  const heroRef = useRef(null)
  const reducedMotion = useReducedMotion()
  const [idea, setIdea] = useState('')
  const [consulta, setConsulta] = useState('')
  const [seleccion, setSeleccion] = useState(new Set())

  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start']
  })
  const heroVideoOpacity = useTransform(heroProgress, [0, 0.56, 0.9], [1, 1, 0.18])
  const heroVideoScale = useTransform(heroProgress, [0, 1], [1, 1.045])
  const heroCopyOpacity = useTransform(heroProgress, [0, 0.48, 0.78], [1, 1, 0])
  const heroCopyY = useTransform(heroProgress, [0, 0.8], [0, -18])

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
      <section className="idea-hero" ref={heroRef}>
        <motion.video
          className="idea-hero-video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          style={{
            opacity: reducedMotion ? 1 : heroVideoOpacity,
            scale: reducedMotion ? 1 : heroVideoScale
          }}
        >
          <source src="/Minimal_monochrome_animation.mp4" type="video/mp4" />
        </motion.video>

        <header className="idea-hero-nav">
          <button className="hero-brand" type="button" onClick={() => onNavigate?.('idea')} aria-label="Ir al inicio de SyntaX">
            <span>S<b>×</b></span>
            <strong>SyntaX</strong>
          </button>
          <nav aria-label="Navegación principal">
            <button className="active" type="button">Ideas</button>
            <button type="button" onClick={() => onNavigate?.('kits')}>Kits</button>
            <button type="button" onClick={() => onNavigate?.('search')}>Buscar</button>
          </nav>
          <div className="hero-nav-actions">
            <button className="hero-extra-link" type="button" onClick={() => onNavigate?.('profile')}><small>EXTRA</small> GitHub Profile</button>
            <button className="hero-nav-cta" type="button" onClick={() => onNavigate?.('kits')}>Explorar kits <span>↗</span></button>
          </div>
        </header>

        <motion.div
          className="idea-hero-copy"
          style={{ opacity: reducedMotion ? 1 : heroCopyOpacity, y: reducedMotion ? 0 : heroCopyY }}
        >
          <p className="hero-kicker">CAPABILITY STUDIO</p>
          <h2>Imaginá el resultado.<br /><em>SyntaX arma el camino.</em></h2>
          <p className="hero-lede">Describí una experiencia, una herramienta o una identidad. Convertimos la intención en skills, MCPs y dependencias listas para revisar.</p>
        </motion.div>

        <div className="hero-scroll-cue" aria-hidden="true"><span /> Deslizá para construir</div>
      </section>

      <section className="intent-bridge">
        <div className="intent-bridge-heading">
          <p>INTENT / INPUT</p>
          <h3>Convertí la visión en un plan ejecutable.</h3>
          <span>Escribí el resultado. SyntaX encuentra las capacidades.</span>
        </div>
        <form
          className="idea-form idea-composer"
          onSubmit={(e) => {
            e.preventDefault()
            buscar(idea)
          }}
        >
          <label htmlFor="idea-input">¿Qué querés hacer realidad?</label>
          <textarea
            id="idea-input"
            rows={3}
            value={idea}
            placeholder="Una experiencia 3D elegante, un perfil GitHub inolvidable, una UI con personalidad…"
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) buscar(idea)
            }}
          />
          <div className="composer-footer">
            <span>⌘/Ctrl + Enter</span>
            <motion.button type="submit" whileTap={{ scale: 0.97 }}>
              Explorar posibilidades <b>↗</b>
            </motion.button>
          </div>
        </form>

        <div className="hero-trust">
          <span><b /> Todo local</span>
          <span><b /> Preview reversible</span>
          <span><b /> Consciente de tu stack</span>
        </div>

        <div className="hero-prompts" aria-label="Ideas para probar">
          <span>Ideas para empezar</span>
          {EJEMPLOS.slice(0, 3).map((ej) => (
            <button key={ej} type="button" onClick={() => buscar(ej)}>{ej}<b>↗</b></button>
          ))}
        </div>
      </section>

      {!analisis && (
        <>
          <section className="showcase-section">
            <div className="section-heading"><p className="hero-kicker">CAPABILITY LAYERS</p><h3>No hace falta saber qué herramienta pedir.</h3><span>Elegí una dirección. SyntaX traduce la idea al stack.</span></div>
            <div className="showcase-grid">
              {SHOWCASES.map((item) => (
                <motion.button
                  className={`showcase-card ${item.tone}`}
                  key={item.title}
                  onClick={() => buscar(item.prompt)}
                  whileHover={{ y: -5 }}
                  whileTap={{ scale: 0.985 }}
                >
                  <span className="showcase-symbol" aria-hidden="true">{item.symbol}</span>
                  <span className="showcase-kicker">{item.kicker}</span>
                  <strong>{item.title}</strong>
                  <p>{item.copy}</p>
                  <span className="showcase-link">Abrir dirección <b>↗</b></span>
                </motion.button>
              ))}
            </div>
          </section>
        </>
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
