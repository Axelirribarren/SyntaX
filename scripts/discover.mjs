#!/usr/bin/env node
// Descubre candidatos nuevos para el catálogo y los verifica mecánicamente.
//
// Uso:
//   node scripts/discover.mjs                 # sin token: pocas consultas, más lento
//   GITHUB_TOKEN=ghp_... node scripts/discover.mjs
//
// No decide nada: deja un JSON con los candidatos que pasaron la verificación,
// para que un humano (o Claude Code) juzgue cuáles entran a src/data/kits.js.
//
// Diseño: buscamos por FECHA, no por estrellas. Un repo publicado hace tres
// semanas tiene 9 estrellas por definición, y es justo lo que queremos
// encontrar. El filtro de calidad no es la popularidad — es si el repo
// contiene de verdad un artefacto instalable.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..')

const TOKEN = process.env.GITHUB_TOKEN || ''
const HEADERS = {
  'User-Agent': 'syntax-discover',
  Accept: 'application/vnd.github+json',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
}

// Licencias que consideramos suficientemente libres (mismo criterio que src/api/github.js).
const LICENCIAS_OSS = new Set([
  'mit', 'apache-2.0', 'gpl-3.0', 'gpl-2.0', 'lgpl-3.0', 'lgpl-2.1',
  'bsd-3-clause', 'bsd-2-clause', 'mpl-2.0', 'unlicense', 'agpl-3.0', 'isc'
])

// Consultas orientadas a diseño frontend. `sort=updated` + filtro de creación
// reciente sesga hacia lo nuevo en vez de hacia lo consagrado.
const DESDE = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)

const CONSULTAS = [
  { etiqueta: 'mcp nuevos', q: `topic:mcp-server created:>${DESDE} archived:false` },
  { etiqueta: 'mcp diseño', q: `topic:mcp-server design ui archived:false` },
  { etiqueta: 'mcp browser/visual', q: `topic:mcp-server browser screenshot archived:false` },
  { etiqueta: 'claude skills', q: `topic:claude-skill archived:false` },
  { etiqueta: 'agent skills', q: `topic:agent-skills archived:false` },
  { etiqueta: 'claude plugins', q: `topic:claude-code-plugin archived:false` },
  { etiqueta: 'skills frontend', q: `claude skill frontend design in:name,description archived:false` }
]

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function traer(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset') || 0) * 1000
    const espera = Math.max(reset - Date.now(), 15_000)
    console.error(`  rate limit — esperando ${Math.round(espera / 1000)}s`)
    await dormir(Math.min(espera, 70_000))
    return traer(url)
  }
  if (!res.ok) return null
  return res.json()
}

async function buscar({ etiqueta, q }) {
  const url =
    'https://api.github.com/search/repositories' +
    `?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=30`
  const data = await traer(url)
  const items = data?.items || []
  console.error(`  ${etiqueta}: ${items.length} resultados`)
  return items.map((r) => ({ ...r, _origen: etiqueta }))
}

// ¿Qué hay realmente adentro del repo? Esta es la verificación que importa:
// separa un artefacto instalable de un blog post con un topic bien puesto.
async function inspeccionar(fullName) {
  const raiz = await traer(`https://api.github.com/repos/${fullName}/contents/`)
  if (!Array.isArray(raiz)) return null

  const nombres = new Set(raiz.map((e) => e.name))
  const señales = {
    skillMd: nombres.has('SKILL.md'),
    carpetaSkills: nombres.has('skills'),
    pluginManifest: nombres.has('.claude-plugin'),
    packageJson: nombres.has('package.json'),
    mcpJson: nombres.has('.mcp.json')
  }

  let npm = null
  if (señales.packageJson) {
    const pkg = await traer(
      `https://raw.githubusercontent.com/${fullName}/HEAD/package.json`
    ).catch(() => null)
    const nombre = pkg?.name
    if (nombre) {
      const reg = await fetch(
        `https://registry.npmjs.org/${nombre.replace('/', '%2f')}`,
        { headers: { 'User-Agent': 'syntax-discover' } }
      )
      npm = { nombre, resuelve: reg.ok, bin: !!pkg?.bin }
    }
  }

  const tipo = señales.pluginManifest
    ? 'plugin'
    : señales.skillMd || señales.carpetaSkills
      ? 'skill'
      : npm?.resuelve
        ? 'mcp'
        : null

  return { señales, npm, tipo }
}

async function main() {
  console.error(`Token de GitHub: ${TOKEN ? 'sí' : 'no (límites bajos)'}`)
  console.error(`Buscando repos creados desde ${DESDE}...\n`)

  const crudos = []
  for (const consulta of CONSULTAS) {
    crudos.push(...(await buscar(consulta)))
    await dormir(TOKEN ? 800 : 6500) // search: 30/min con token, 10/min sin
  }

  // Dedupe + descarte mecánico. Nada de esto necesita criterio.
  const porNombre = new Map()
  for (const r of crudos) if (!porNombre.has(r.full_name)) porNombre.set(r.full_name, r)

  const seisMeses = Date.now() - 180 * 24 * 3600 * 1000
  const candidatos = [...porNombre.values()].filter((r) => {
    const lic = r.license?.spdx_id?.toLowerCase()
    return (
      !r.archived &&
      !r.fork &&
      lic &&
      LICENCIAS_OSS.has(lic) &&
      new Date(r.pushed_at).getTime() > seisMeses // sigue vivo
    )
  })

  console.error(`\n${crudos.length} resultados -> ${porNombre.size} únicos -> ${candidatos.length} pasan el filtro básico`)
  console.error('Inspeccionando contenido de cada repo...\n')

  const verificados = []
  for (const r of candidatos.slice(0, 40)) {
    const dentro = await inspeccionar(r.full_name)
    if (!dentro?.tipo) continue
    verificados.push({
      repo: r.full_name,
      tipo: dentro.tipo,
      descripcion: r.description,
      licencia: r.license.spdx_id,
      estrellas: r.stargazers_count,
      creado: r.created_at.slice(0, 10),
      ultimoPush: r.pushed_at.slice(0, 10),
      topics: r.topics,
      npm: dentro.npm,
      señales: dentro.señales,
      origen: r._origen,
      url: r.html_url
    })
    console.error(`  ✓ ${r.full_name} (${dentro.tipo}, ${r.stargazers_count}★, creado ${r.created_at.slice(0, 10)})`)
    await dormir(TOKEN ? 200 : 1200)
  }

  // Lo nuevo primero: es lo que un catálogo curado a mano no tiene.
  verificados.sort((a, b) => b.creado.localeCompare(a.creado))

  const salida = resolve(RAIZ, 'scripts', 'candidatos.json')
  mkdirSync(dirname(salida), { recursive: true })
  writeFileSync(salida, JSON.stringify({ generado: new Date().toISOString(), verificados }, null, 2))

  console.error(`\n${verificados.length} candidatos verificados -> scripts/candidatos.json`)
  console.error('Ninguno entra al catálogo automáticamente: falta el paso de juicio.')
}

main().catch((e) => {
  console.error('Falló:', e.message)
  process.exit(1)
})
