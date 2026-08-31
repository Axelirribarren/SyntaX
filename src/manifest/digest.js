// Digest portable del contenido de una skill.
//
// NO es integridad byte a byte: el algoritmo normaliza finales de línea, BOM y
// unicode de rutas, así que dos árboles con bytes distintos pueden dar el mismo
// digest. Eso es deliberado — sin esa normalización, la misma skill en Windows y
// en macOS daría digests distintos y `verify` marcaría todo como modificado el
// primer día. La promesa exacta es: *representación canónica del contenido
// observado, ignorando las diferencias portables que define el algoritmo*.
//
// Tampoco es una versión. Responde "¿esto cambió?", no "¿qué versión es?" ni
// "¿cómo lo reinstalo?". Eso llega con la resolución de origen y se suma al
// lock, no lo reemplaza.
//
// La spec completa, con vectores de prueba, está en docs/digest.md. Cualquier
// cambio acá se refleja allá y bump del nombre del algoritmo.

import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

export const ALGORITHM = 'syntax-skill-tree-v1'

const NUL = Buffer.from([0])

// Allowlist explícita: solo estos formatos se normalizan. Todo lo demás se
// hashea crudo.
//
// La asimetría es deliberada y es la decisión más importante del algoritmo. Un
// texto desconocido tratado como binario produce un `modified` falso por EOL:
// molesta, pero FALLA A LA VISTA. Un binario tratado como texto puede ocultar
// una diferencia real: FALLA EN SILENCIO. Por eso no se usa un heurístico
// (buscar NUL en los primeros KB), que se equivoca justo en la dirección
// peligrosa: un binario puede no tener NUL al principio y sí contener CRLF.
const TEXT_EXTENSIONS = new Set([
  'bash', 'c', 'cfg', 'cjs', 'cpp', 'css', 'csv', 'h', 'htm', 'html', 'ini',
  'java', 'js', 'json', 'jsonc', 'jsx', 'lua', 'markdown', 'md', 'mjs', 'mts',
  'php', 'pl', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'svg', 'toml', 'ts',
  'tsv', 'tsx', 'txt', 'xml', 'yaml', 'yml', 'zsh'
])

export function isTextFile(relativePath) {
  const name = relativePath.slice(relativePath.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return false
  return TEXT_EXTENSIONS.has(name.slice(dot + 1).toLowerCase())
}

export function canonicalize(content, text) {
  if (!text) return content

  let out = content
  // BOM UTF-8: lo agregan varios editores de Windows y no cambia el contenido.
  if (out.length >= 3 && out[0] === 0xef && out[1] === 0xbb && out[2] === 0xbf) {
    out = out.subarray(3)
  }
  // CRLF y CR sueltos a LF. Es la diferencia que git introduce solo al hacer
  // checkout en Windows, y la que haría inservible a `verify` en un equipo mixto.
  return Buffer.from(out.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8')
}

// Devuelve { ok: true, digest, files } o { ok: false, reason }.
// No tira: un digest no calculable es un hallazgo del reporte, no un crash.
export function computeSkillDigest(dir) {
  let entries
  try {
    entries = collect(dir, dir)
  } catch (error) {
    return { ok: false, reason: error.message }
  }

  // Colisión tras normalizar a NFC: dos nombres distintos en disco que quedan
  // iguales al normalizar. Elegir uno en silencio haría que el digest dependa
  // del orden del filesystem.
  const seen = new Map()
  for (const entry of entries) {
    const previo = seen.get(entry.path)
    if (previo && previo !== entry.rawPath) {
      return { ok: false, reason: `colisión de rutas al normalizar a NFC: ${previo} y ${entry.rawPath}` }
    }
    seen.set(entry.path, entry.rawPath)
  }

  // Orden por los bytes UTF-8 de la ruta. Nunca localeCompare: depende del
  // locale de quien corre el comando.
  entries.sort((a, b) => Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8')))

  const hash = createHash('sha256')
  // Prefijo de dominio: un digest de este algoritmo no puede confundirse con el
  // de otro, ni con el de otro tipo de objeto.
  hash.update(Buffer.from(ALGORITHM, 'utf8'))
  hash.update(NUL)

  for (const entry of entries) {
    let content
    try {
      content = canonicalize(readFileSync(entry.absolute), isTextFile(entry.path))
    } catch (error) {
      return { ok: false, reason: `no se pudo leer ${entry.path}: ${error.code || error.message}` }
    }

    hash.update(Buffer.from(entry.path, 'utf8'))
    hash.update(NUL)
    // Longitud del contenido YA normalizado, en decimal ASCII. Evita que un
    // corrimiento entre ruta y contenido produzca el mismo hash.
    hash.update(Buffer.from(String(content.length), 'ascii'))
    hash.update(NUL)
    hash.update(content)
  }

  return { ok: true, digest: `sha256:${hash.digest('hex')}`, files: entries.length }
}

function collect(dir, root, out = []) {
  for (const name of readdirSync(dir)) {
    const absolute = join(dir, name)

    // lstat y no el Dirent de readdirSync: el Dirent no reporta symlinks de
    // forma consistente entre plataformas (en Git Bash sobre Windows un enlace
    // a directorio aparece como directorio común).
    const stats = lstatSync(absolute)

    if (stats.isSymbolicLink()) {
      // No se siguen. Seguirlos permitiría que una skill referencie archivos
      // fuera del proyecto; saltearlos en silencio haría que Windows y Unix
      // vean inventarios distintos.
      throw new Error(`symlink no soportado: ${toPosix(relative(root, absolute))}`)
    }

    if (stats.isDirectory()) {
      collect(absolute, root, out)
      continue
    }

    if (!stats.isFile()) {
      throw new Error(`entrada no regular: ${toPosix(relative(root, absolute))}`)
    }

    const rawPath = toPosix(relative(root, absolute))
    out.push({ absolute, rawPath, path: rawPath.normalize('NFC') })
  }

  return out
}

function toPosix(value) {
  return value.split('\\').join('/')
}
