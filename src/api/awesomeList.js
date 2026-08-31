// Parses curated "awesome-*" markdown lists into skill entries.
// These act as a pre-vetted layer on top of raw GitHub search.

const SOURCES = [
  {
    id: 'awesome-mcp-servers',
    label: 'Awesome MCP Servers',
    rawUrl: 'https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md'
  },
  {
    id: 'awesome-claude-code',
    label: 'Awesome Claude Code',
    rawUrl: 'https://raw.githubusercontent.com/hesreallyhim/awesome-claude-code/main/README.md'
  }
]

const LINK_LINE = /^[-*]\s*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\s*[-–—:]?\s*(.*)$/

export function listSources() {
  return SOURCES
}

export async function fetchAwesomeList(sourceId) {
  const source = SOURCES.find((s) => s.id === sourceId)
  if (!source) throw new Error(`Unknown source: ${sourceId}`)

  const res = await fetch(source.rawUrl)
  if (!res.ok) throw new Error(`Failed to fetch ${source.label} (${res.status})`)
  const text = await res.text()

  return parseMarkdownList(text, source)
}

function parseMarkdownList(markdown, source) {
  const items = []
  const lines = markdown.split('\n')

  for (const line of lines) {
    const match = line.match(LINK_LINE)
    if (!match) continue
    const [, name, url, description] = match

    // Skip obvious non-project links (anchors, badges, license/back-to-top links).
    if (!/^https?:\/\/(github\.com|gitlab\.com)\//.test(url)) continue

    items.push({
      id: `${source.id}-${url}`,
      source: source.id,
      sourceLabel: source.label,
      name: name.trim(),
      description: description.trim(),
      url,
      stars: null,
      license: 'unverified',
      updatedAt: null,
      topics: []
    })
  }

  return items
}
