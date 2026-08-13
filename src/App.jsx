import { useEffect, useMemo, useState } from 'react'
import { searchByTopic, searchByKeyword } from './api/github'
import { listSources, fetchAwesomeList } from './api/awesomeList'
import { addFavorite, removeFavorite, listFavorites } from './db/favorites'
import SkillCard from './components/SkillCard.jsx'
import TokenSetup from './components/TokenSetup.jsx'
import KitView from './components/KitView.jsx'

const TOPIC_CHIPS = [
  { label: 'MCP Servers', topic: 'mcp-server' },
  { label: 'Claude Skills', topic: 'claude-skill' },
  { label: 'Claude Code Plugins', topic: 'claude-code-plugin' },
  { label: 'AI Agents', topic: 'ai-agent' }
]

export default function App() {
  const [view, setView] = useState('kits') // kits | search | favorites
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
        <button className={view === 'kits' ? 'active' : ''} onClick={() => setView('kits')}>
          Kits
        </button>
        <button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>
          Buscar
        </button>
        <button className={view === 'favorites' ? 'active' : ''} onClick={() => setView('favorites')}>
          Favoritos ({favorites.length})
        </button>
      </nav>

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

      {view === 'kits' && <KitView />}

      {view !== 'kits' && (
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
    </div>
  )
}
