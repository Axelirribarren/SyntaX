import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'

import { START, END, readText } from '../scripts/emit-docs.mjs'

const ROOT = join(import.meta.dirname, '..')

// El guard de drift más barato posible, y es la tesis del producto aplicada a
// su propio repo: una sola fuente, varios destinos, y una verificación que
// falla cuando divergen. Si esto no se sostiene acá, no hay autoridad para
// venderlo afuera.
const DESTINOS = ['CLAUDE.md', 'AGENTS.md']

function bloqueDe(contenido) {
  const inicio = contenido.indexOf(START)
  const fin = contenido.indexOf(END)
  if (inicio === -1 || fin === -1) return null
  return contenido.slice(inicio + START.length, fin).trim()
}

test('CLAUDE.md y AGENTS.md llevan el brief sin editar', () => {
  const brief = readText(join(ROOT, 'docs/agent-brief.md')).trim()

  for (const destino of DESTINOS) {
    const contenido = readText(join(ROOT, destino))
    const bloque = bloqueDe(contenido)

    assert.ok(bloque !== null, `${destino} perdió los marcadores del brief`)
    assert.equal(bloque, brief, `${destino} quedó viejo: corré npm run docs`)
  }
})

test('cada destino conserva su sección propia fuera del bloque compartido', () => {
  for (const destino of DESTINOS) {
    const contenido = readText(join(ROOT, destino))
    const despues = contenido.slice(contenido.indexOf(END) + END.length)

    assert.match(despues, /## Específico de/, `${destino} perdió su sección propia`)
  }
})
