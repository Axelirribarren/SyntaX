import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { searchByTopic, searchByKeyword } from './api/github'
import { listSources, fetchAwesomeList } from './api/awesomeList'
import { addFavorite, removeFavorite, listFavorites } from './db/favorites'
import SkillCard from './components/SkillCard.jsx'
import TokenSetup from './components/TokenSetup.jsx'
import KitView from './components/KitView.jsx'
import IdeaFinder from './components/IdeaFinder.jsx'
import ProfileStudio from './components/ProfileStudio.jsx'
import LaunchScreen from './components/LaunchScreen.jsx'

const TOPIC_CHIPS = [
  { label: 'MCP Servers', topic: 'mcp-server' },
  { label: 'Claude Skills', topic: 'claude-skill' },
  { label: 'Claude Code Plugins', topic: 'claude-code-plugin' },
  { label: 'AI Agents', topic: 'ai-agent' }
]

const VIEWS = ['idea', 'kits', 'profile', 'search', 'favorites']

function Tab({ id, current, onSelect, children }) {
  const active = current === id
  return (
    <button className={active ? 'active' : ''} onClick={() => onSelect(id)}>
      {children}
      {active && (
        // Un solo layoutId compartido entre las cuatro tabs: motion anima el
        // salto de posición solo, sin medir nada a mano.
        <motion.span className="tab-indicator" layoutId="tab-indicator" transition={{ duration: 0.22, ease: 'easeOut' }} />
      )}
    </button>
  )
}

export default function App() {
  const reducedMotion = useReducedMotion()
  const appRef = useRef(null)
  const [booting, setBooting] = useState(true)
  const [view, setView] = useState('idea') // idea | kits | search | favorites
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [favorites, setFavorites] = useState([])
  const [activeSource, setActiveSource] = useState('github')

  useEffect(() => {
    refreshFavorites()
  }, [])

  useEffect(() => {
    let active = true
    const minimum = new Promise((resolve) => setTimeout(resolve, reducedMotion ? 120 : 720))
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    Promise.all([minimum, fontsReady]).then(() => active && setBooting(false))
    return () => { active = false }
  }, [reducedMotion])

  function moveAmbientLight(event) {
    if (reducedMotion || !appRef.current) return
    const rect = appRef.current.getBoundingClientRect()
    appRef.current.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`)
    appRef.current.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`)
  }

  async function refreshFavorites() {
    setFavorites(await listFavorites())
  }

  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites])

  async function runTopicSearch(topic) {
    setLoading(true)
    setError('')
    setActiveSource('github')
    try {
      const items = await searchByTopic(topic)
      setResults(items)
    } catch (e) {
      setError(e.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function runKeywordSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setActiveSource('github')
    try {
      const items = await searchByKeyword(query.trim())
      setResults(items)
    } catch (e) {
      setError(e.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function runAwesomeList(sourceId) {
    setLoading(true)
    setError('')
    setActiveSource(sourceId)
    try {
      const items = await fetchAwesomeList(sourceId)
      setResults(items)
    } catch (e) {
      setError(e.message)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function toggleFav(item) {
    if (favIds.has(item.id)) {
      await removeFavorite(item.id)
    } else {
      await addFavorite(item)
    }
    refreshFavorites()
  }

  const shown = view === 'favorites' ? favorites : results

  return (
    <>
      <AnimatePresence>{booting && <LaunchScreen />}</AnimatePresence>
      <div className="app" ref={appRef} onPointerMove={moveAmbientLight}>
      <div className="ambient-cursor" aria-hidden="true" />
      {view !== 'idea' && <header className="header">
        <div className="brand-lockup">
          <div className="brand-mark">S<span>×</span></div>
          <div><h1>SyntaX</h1></div>
        </div>
        <div className="header-status"><span className="live-dot" /> local-first <TokenSetup /></div>
      </header>}

      {view !== 'idea' && <nav className="tabs">
        {VIEWS.map((id) => (
          <Tab key={id} id={id} current={view} onSelect={setView}>
            {id === 'idea' && 'Tu idea'}
            {id === 'kits' && 'Kits'}
            {id === 'profile' && 'GitHub Profile'}
            {id === 'search' && 'Buscar'}
            {id === 'favorites' && `Favoritos (${favorites.length})`}
          </Tab>
        ))}
      </nav>}

      {/* key={view}: cada cambio de tab desmonta la vista anterior y monta la
          nueva, así que el cross-fade se dispara solo en cada click.
          mode="popLayout" (no "wait"): la vista nueva se monta de inmediato,
          sin esperar a que la vieja termine de salir. Con "wait" un exit que
          no llega a completar (pestaña en segundo plano, tab del SO sin foco)
          deja el click sin efecto — el botón activo cambia pero el contenido
          no. La navegación entre tabs no puede depender de que una animación
          termine para funcionar. */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={view}
          className={`view-stage view-${view}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {view === 'search' && (
            <>
              <div className="view-intro"><p>CAPABILITY INDEX</p><h2>Buscá una capacidad concreta.</h2><span>Explorá skills, MCPs, plugins y agentes sin salir del sistema.</span></div>
              <form className="search-bar" onSubmit={runKeywordSearch}>
                <input
                  type="text"
                  placeholder="Buscar por palabra clave (ej: pdf to markdown)"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit">Buscar</button>
              </form>

              <div className="chips">
                {TOPIC_CHIPS.map((chip) => (
                  <button
                    key={chip.topic}
                    className={`chip ${activeSource === 'github' ? '' : ''}`}
                    onClick={() => runTopicSearch(chip.topic)}
                  >
                    {chip.label}
                  </button>
                ))}
                {listSources().map((source) => (
                  <button
                    key={source.id}
                    className={`chip curated ${activeSource === source.id ? 'active' : ''}`}
                    onClick={() => runAwesomeList(source.id)}
                  >
                    {source.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {view === 'idea' && <IdeaFinder onNavigate={setView} />}
          {view === 'kits' && <KitView />}
          {view === 'profile' && <ProfileStudio />}

          {view === 'favorites' && <div className="view-intro"><p>SAVED INDEX</p><h2>Capacidades guardadas.</h2><span>Tu selección local para volver a consultar cuando quieras.</span></div>}

          {view !== 'kits' && view !== 'idea' && view !== 'profile' && (
            <>
              {loading && (
                <div className="search-loading" role="status" aria-label="Buscando capacidades">
                  <span>Explorando capacidades</span>
                  <div className="loading-grid">
                    {[0, 1, 2].map((item) => <i key={item} />)}
                  </div>
                </div>
              )}
              {error && <p className="status error">{error}</p>}
              {!loading && !error && shown.length === 0 && (
                <p className="status">
                  {view === 'favorites'
                    ? 'Todavía no guardaste nada.'
                    : 'Elegí una categoría o buscá algo.'}
                </p>
              )}

              <div className="grid">
                {shown.map((item) => (
                  <SkillCard
                    key={item.id}
                    item={item}
                    isFav={favIds.has(item.id)}
                    onToggleFav={toggleFav}
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      </div>
    </>
  )
}
