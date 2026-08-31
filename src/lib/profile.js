const THEME_BY_STYLE = {
  minimal: 'transparent',
  aurora: 'tokyonight',
  prism: 'tokyonight',
  editorial: 'default',
  terminal: 'github_dark'
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

export function safeUsername(value) {
  return String(value || '').trim().replace(/^@/, '').replace(/[^a-zA-Z0-9-]/g, '')
}

export function profileAvatar(profile) {
  const supplied = String(profile.avatarUrl || '').trim()
  if (/^https:\/\//.test(supplied)) return supplied
  const username = safeUsername(profile.username)
  return username ? `https://github.com/${username}.png?size=160` : ''
}

export function profileBanner(profile) {
  const supplied = String(profile.bannerUrl || '').trim()
  return /^https:\/\//.test(supplied) ? supplied : ''
}

export function createProfileMarkdown(profile) {
  const username = safeUsername(profile.username)
  const name = String(profile.name || username || 'Tu nombre').trim()
  const role = String(profile.role || '').trim()
  const bio = String(profile.bio || '').trim()
  const project = String(profile.project || '').trim()
  const projectUrl = String(profile.projectUrl || '').trim()
  const links = String(profile.links || '').split(/\r?\n/).map((link) => link.trim()).filter(Boolean)
  const avatar = profileAvatar(profile)
  const banner = profileBanner(profile)
  const stack = String(profile.stack || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8)
  const theme = THEME_BY_STYLE[profile.style] || THEME_BY_STYLE.aurora
  const lines = ['<!-- Generado localmente con SyntaX. Revisá y personalizá antes de publicar. -->', '']

  if (banner) lines.push(`<p align="center"><img src="${escapeHtml(banner)}" width="100%" alt="Banner de ${escapeHtml(name)}" /></p>`, '')
  if (avatar) lines.push(`<p align="center"><img src="${escapeHtml(avatar)}" width="120" alt="Avatar de ${escapeHtml(name)}" /></p>`, '')
  lines.push(`<h1 align="center">${escapeHtml(name)}</h1>`)
  if (role) lines.push(`<p align="center">${escapeHtml(role)}</p>`)
  lines.push('')
  if (bio) lines.push('## Sobre mí', '', bio, '')
  if (stack.length) {
    lines.push('## Stack', '')
    lines.push(`<p>${stack.map((item) => `<img src="https://img.shields.io/badge/${encodeURIComponent(item)}-11131d?style=flat-square" alt="${escapeHtml(item)}" />`).join(' ')}</p>`, '')
  }
  if (project) {
    lines.push('## Proyecto destacado', '')
    lines.push(projectUrl && /^https:\/\//.test(projectUrl) ? `- [${project}](${projectUrl})` : `- ${project}`)
    lines.push('')
  }
  if (username && profile.showStats !== false) {
    lines.push('## GitHub', '')
    lines.push(`<img src="https://github-readme-stats.vercel.app/api?username=${username}&show_icons=true&theme=${theme}" alt="Estadísticas de ${username}" />`, '')
  }
  if (links.length) lines.push('## Encontrame', '', ...links.map((link) => `- ${link}`), '')
  lines.push('<!-- Podés reemplazar o quitar cualquier bloque: el README es tuyo. -->', '')
  return lines.join('\n')
}
