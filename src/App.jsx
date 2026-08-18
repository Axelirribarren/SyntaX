import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { searchByTopic, searchByKeyword } from './api/github'
import { listSources, fetchAwesomeList } from './api/awesomeList'
import { addFavorite, removeFavorite, listFavorites } from './db/favorites'
import SkillCard from './components/SkillCard.jsx'
import TokenSetup from './components/TokenSetup.jsx'
import KitView from './components/KitView.jsx'
import IdeaFinder from './components/IdeaFinder.jsx'

const TOPIC_CHIPS = [
  { label: 'MCP Servers', topic: 'mcp-server' },
  { label: 'Claude Skills', topic: 'claude-skill' },
  { label: 'Claude Code Plugins', topic: 'claude-code-plugin' },
  { label: 'AI Agents', topic: 'ai-agent' }
]

const VIEWS = ['idea', 'kits', 'search', 'favorites']

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
    <div className="app">
      <header className="header">
        <h1>SyntaX</h1>
        <p className="subtitle">Buscador de skills, MCP servers y plugins gratuitos y open-source</p>
        <TokenSetup />
      </header>

      <nav className="tabs">
        {VIEWS.map((id) => (
          <Tab key={id} id={id} current={view} onSelect={setView}>
            {id === 'idea' && 'Tu idea'}
            {id === 'kits' && 'Kits'}
            {id === 'search' && 'Buscar'}
            {id === 'favorites' && `Favoritos (${favorites.length})`}
          </Tab>
        ))}
      </nav>

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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          {view === 'search' && (
            <>
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

          {view === 'idea' && <IdeaFinder />}
          {view === 'kits' && <KitView />}

          {view !== 'kits' && view !== 'idea' && (
            <>
              {loading && <p className="status">Cargando…</p>}
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
  )
}
