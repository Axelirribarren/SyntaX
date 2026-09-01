// Informa qué finales de línea produjo el checkout en esta máquina.
//
// Existe porque es fácil creer de más. "Los runners de Windows convierten a
// CRLF, entonces `verify` en verde prueba que la normalización funciona" asume
// que el checkout depende del sistema operativo, y en realidad depende de
// `core.autocrlf`, de `.gitattributes` y de los atributos `text` / `eol`.
//
// Si todos los runners terminaron con LF, `verify` en verde sigue siendo útil
// pero NO prueba la normalización de CRLF. Mejor que el log lo diga a que nos
// deje creer lo contrario.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const MUESTRAS = [
  'docs/agent-brief.md',
  'README.md',
  '.claude/skills/frontend-design/SKILL.md',
  '.agents/skills/frontend-design/SKILL.md'
]

let hayCrlf = false
const filas = []

for (const relativo of MUESTRAS) {
  const path = join(ROOT, relativo)
  if (!existsSync(path)) {
    filas.push([relativo, 'ausente'])
    continue
  }

  const raw = readFileSync(path)
  const crlf = contar(raw, Buffer.from('\r\n'))
  const lf = raw.filter((byte, index) => byte === 0x0a && raw[index - 1] !== 0x0d).length

  if (crlf > 0) hayCrlf = true
  filas.push([relativo, crlf > 0 ? `CRLF (${crlf})` : `LF (${lf})`])
}

console.log(`\nFinales de línea del checkout — ${process.platform}\n`)
for (const [nombre, estado] of filas) console.log(`  ${nombre.padEnd(48)} ${estado}`)

console.log('')
console.log(
  hayCrlf
    ? '  Hay archivos con CRLF: si `verify` pasa acá, la normalización del digest está probada de verdad.'
    : '  Todo el checkout llegó con LF: `verify` en verde NO prueba la normalización de CRLF en esta máquina.'
)
console.log('  La cobertura de CRLF con bytes fabricados está en test/digest.test.js.\n')

function contar(buffer, patron) {
  let total = 0
  let index = buffer.indexOf(patron)
  while (index !== -1) {
    total += 1
    index = buffer.indexOf(patron, index + patron.length)
  }
  return total
}
