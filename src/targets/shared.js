// Lecturas de disco que comparten los adapters. Nada de esto escribe.

import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const BACKUP_SUFFIX = '.pactlock-backup-'

// Los de SyntaX, el nombre anterior del producto, siguen apareciendo en repos
// donde corrió la CLI vieja. Se reconocen igual: son residuos reales.
export const BACKUP_SUFFIXES = [BACKUP_SUFFIX, '.syntax-backup-']

export function isBackupName(name) {
  return BACKUP_SUFFIXES.some((suffix) => name.includes(suffix))
}

export function readJsonSafe(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return { __parseError: error.message }
  }
}

export function listDirectories(path) {
  if (!existsSync(path)) return []
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

export function listFiles(path, extension) {
  if (!existsSync(path)) return []
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => (extension ? name.endsWith(extension) : true))
  } catch {
    return []
  }
}

export function fileBytes(path) {
  if (!existsSync(path)) return 0
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

// El frontmatter de una skill es lo que el runtime inyecta en cada arranque para
// decidir si la skill aplica. Su tamaño es costo de contexto real, y su
// `description` es lo que dispara (o no) la skill — por eso importan las dos
// cosas: el texto para detectar solapamiento y los bytes para el costo.
export function readSkillMeta(dir) {
  const skillFile = join(dir, 'SKILL.md')
  if (!existsSync(skillFile)) return { hasSkillFile: false, frontmatter: '', description: '' }
  return { hasSkillFile: true, ...readMarkdownMeta(skillFile) }
}

// El frontmatter de un agente cumple el mismo rol que el de una skill: es lo
// que el runtime inyecta para decidir si corresponde usarlo.
export function readMarkdownMeta(path) {
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return { frontmatter: '', description: '', name: '' }
  }

  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const frontmatter = match ? match[1] : ''

  return {
    frontmatter,
    description: readScalar(frontmatter, 'description'),
    name: readScalar(frontmatter, 'name')
  }
}

// Lector deliberadamente mínimo: alcanza para `name` y `description`, que es
// todo lo que necesitan los checks. Si algún día hace falta YAML de verdad,
// entra una dependencia y se cambia acá y solo acá.
function readScalar(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/)
  const index = lines.findIndex((line) => line.startsWith(`${key}:`))
  if (index === -1) return ''

  let value = lines[index].slice(key.length + 1).trim()
  if (value === '>' || value === '|' || value === '>-' || value === '|-') value = ''

  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\S/.test(line)) break
    value += ` ${line.trim()}`
  }

  return value.replace(/^["']|["']$/g, '').trim()
}

// Separa las skills reales de los backups que dejó la CLI vieja. Los backups no
// son skills: no los cuenta como entorno, pero tampoco los esconde — son
// hallazgo del check de huérfanos.
export function readSkillsDirectory(root, relativeDir) {
  const base = join(root, relativeDir)
  const entries = listDirectories(base)
  const skills = []
  const backups = []

  for (const name of entries) {
    const path = join(base, name)
    if (isBackupName(name)) {
      backups.push({ id: name, path, relativePath: `${relativeDir}/${name}` })
      continue
    }
    // lstat y no el Dirent de readdirSync: el Dirent no reporta symlinks de
    // forma consistente entre plataformas. Una carpeta de skill que en realidad
    // es un enlace apunta afuera del proyecto y no se puede versionar; se marca
    // acá para que observe.js lo reporte en vez de tratarla como una skill más.
    let symlink = false
    try {
      symlink = lstatSync(path).isSymbolicLink()
    } catch {
      symlink = false
    }

    const meta = readSkillMeta(path)
    skills.push({
      id: name,
      symlink,
      kind: 'skill',
      path,
      relativePath: `${relativeDir}/${name}`,
      // Sin SKILL.md el runtime la ignora: existe en disco pero no forma parte
      // del entorno. Se conserva en el snapshot para que el check de huérfanos
      // la encuentre, marcada para que los demás checks no la cuenten.
      valid: meta.hasSkillFile,
      ...meta
    })
  }

  return { skills, backups }
}

// Los MCP servers vienen en dos formas y hay que soportar las dos: stdio lanza
// un proceso local, http apunta a un server alojado. Un lector que solo entienda
// la primera reporta mal cualquier entorno con servers remotos.
export function normalizeMcpServer(id, config) {
  if (!config || typeof config !== 'object') return { id, kind: 'mcp', transport: 'desconocido' }

  if (config.url) {
    return {
      id,
      kind: 'mcp',
      transport: 'http',
      url: config.url,
      env: Object.keys(config.headers || {})
    }
  }

  const server = {
    id,
    kind: 'mcp',
    transport: 'stdio',
    command: config.command,
    args: config.args || [],
    env: Object.keys(config.env || {}),
    // Los valores vacíos son placeholders esperando que el usuario los complete:
    // un server así no arranca, y es la causa más común de instalación fallida.
    emptyEnv: Object.entries(config.env || {})
      .filter(([, value]) => !value)
      .map(([key]) => key)
  }

  // Los valores de env hacen falta para levantar el server en `--deep`, pero no
  // enumerable a propósito: así `JSON.stringify` no los arrastra al reporte
  // `--json`, que suele terminar en un log de CI o pegado en un chat. Que la
  // clave ya esté en el .mcp.json no es motivo para multiplicar dónde aparece.
  Object.defineProperty(server, 'envValues', {
    value: config.env || {},
    enumerable: false
  })

  return server
}
