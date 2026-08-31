const API_BASE = 'https://api.github.com'

// SPDX ids GitHub reports that we consider "free & open-source" enough to surface.
const OSS_LICENSES = new Set([
  'mit', 'apache-2.0', 'gpl-3.0', 'gpl-2.0', 'lgpl-3.0', 'lgpl-2.1',
  'bsd-3-clause', 'bsd-2-clause', 'mpl-2.0', 'unlicense', 'agpl-3.0', 'isc'
])

export function getToken() {
  return localStorage.getItem('gh_token') || ''
}

export function setToken(token) {
  if (token) localStorage.setItem('gh_token', token)
  else localStorage.removeItem('gh_token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Searches GitHub repos by topic and returns only OSS-licensed, non-archived results.
export async function searchByTopic(topic, { perPage = 30 } = {}) {
  const url = `${API_BASE}/search/repositories?q=${encodeURIComponent(
    `topic:${topic} archived:false`
  )}&sort=stars&order=desc&per_page=${perPage}`

  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`GitHub API error (${res.status}): ${body.message || res.statusText}`)
  }
  const data = await res.json()

  return data.items
    .filter((repo) => repo.license && OSS_LICENSES.has(repo.license.spdx_id?.toLowerCase()))
    .map(normalizeRepo)
}

export async function searchByKeyword(keyword, { perPage = 30 } = {}) {
  const url = `${API_BASE}/search/repositories?q=${encodeURIComponent(
    `${keyword} archived:false`
  )}&sort=stars&order=desc&per_page=${perPage}`

  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`GitHub API error (${res.status}): ${body.message || res.statusText}`)
  }
  const data = await res.json()

  return data.items
    .filter((repo) => repo.license && OSS_LICENSES.has(repo.license.spdx_id?.toLowerCase()))
    .map(normalizeRepo)
}

function normalizeRepo(repo) {
  return {
    id: `gh-${repo.id}`,
    source: 'github',
    name: repo.full_name,
    description: repo.description || '',
    url: repo.html_url,
    stars: repo.stargazers_count,
    license: repo.license?.spdx_id || 'unknown',
    updatedAt: repo.updated_at,
    topics: repo.topics || []
  }
}
