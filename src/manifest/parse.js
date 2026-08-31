// Lectura de syntax.yaml con YAML deliberadamente restringido.
//
// Se usa un parser de verdad porque uno propio falla en silencio con el valor
// equivocado: `pin: 0123` devuelve el número 123, `deny: [no]` devuelve false.
// En una herramienta que después escribe en el repo de otra persona, ese es el
// peor modo de falla posible.
//
// Pero se acepta solo un subconjunto: anchors, aliases, multi-documento, tags
// custom y merge keys son potencia que el manifest no necesita y que vuelve
// difícil de razonar un archivo que un equipo revisa en un diff.
//
// La restricción se evalúa sobre el AST del parser, no con expresiones
// regulares sobre el texto: un `why:` que mencione `*` o `&` no tiene por qué
// hacer fallar la lectura.

import { readFileSync } from 'node:fs'
import { isAlias, isScalar, parseAllDocuments, visit } from 'yaml'

import { validateManifest } from './schema.js'

export function parseManifest(text) {
  const errors = []
  const warnings = []

  const documentos = parseAllDocuments(text, { merge: false, prettyErrors: true })

  if (documentos.length > 1) {
    errors.push('YAML no soportado: el manifest tiene que ser un único documento.')
  }

  const documento = documentos[0]
  if (!documento) return { ok: false, errors: ['El manifest está vacío.'], warnings }

  // Los warnings del parser se reportan, nunca se descartan en silencio: avisan
  // sobre construcciones ambiguas, que es justo lo que no se quiere en un
  // archivo que define un contrato.
  for (const aviso of documento.warnings || []) warnings.push(aviso.message)
  for (const problema of documento.errors || []) errors.push(problema.message)

  visit(documento, {
    Alias() {
      errors.push('YAML no soportado: aliases (*ref).')
    },
    Node(_, node) {
      if (node.anchor) errors.push(`YAML no soportado: anchor &${node.anchor}.`)
      if (node.tag) errors.push(`YAML no soportado: tag custom ${node.tag}.`)
    },
    Pair(_, pair) {
      if (isScalar(pair.key) && pair.key.value === '<<') {
        errors.push('YAML no soportado: merge keys (<<:).')
      }
      if (isAlias(pair.value)) errors.push('YAML no soportado: aliases (*ref).')
    }
  })

  if (errors.length) return { ok: false, errors: [...new Set(errors)], warnings }

  let value
  try {
    value = documento.toJS({ maxAliasCount: 0 })
  } catch (error) {
    return { ok: false, errors: [error.message], warnings }
  }

  const schemaErrors = validateManifest(value)
  if (schemaErrors.length) return { ok: false, errors: schemaErrors, warnings }

  return { ok: true, manifest: value, warnings }
}

export function readManifest(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    return {
      ok: false,
      errors: [`No se pudo leer ${path}: ${error.code || error.message}`],
      warnings: []
    }
  }
  return parseManifest(text)
}
