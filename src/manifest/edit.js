// Ediciones quirúrgicas del manifest.
//
// `accept` toca el archivo que una persona escribe y revisa en un diff, así que
// no lo regenera: opera sobre el `Document` de `yaml`, que preserva encabezado,
// comentarios al margen, orden y formato. Regenerar se llevaría puestos los
// `why` — el campo que existe precisamente porque los comentarios no sobreviven
// a las reescrituras.

import { readFileSync } from 'node:fs'
import { parseDocument } from 'yaml'

export function loadDocument(path) {
  return parseDocument(readFileSync(path, 'utf8'), { merge: false })
}

export function serializeDocument(doc) {
  return doc.toString({ lineWidth: 0 })
}

function componentsOf(doc) {
  return doc.get('components')
}

function findComponent(doc, id) {
  const components = componentsOf(doc)
  if (!components) return null
  return components.items.find((item) => item.get?.('id') === id) || null
}

export function addComponent(doc, { id, kind = 'skill', targets }) {
  if (findComponent(doc, id)) return false

  const components = componentsOf(doc)
  // createNode y no un objeto plano: la secuencia tiene que quedar con nodos del
  // documento, o el resto de las operaciones —y el serializador— no los saben
  // tratar.
  components.add(doc.createNode({ kind, id, targets: [...targets].sort() }))

  // Se mantiene el orden alfabético que produce `import`, para que el diff de
  // agregar una skill sea una línea y no un reordenamiento entero.
  components.items.sort((a, b) => idOf(a).localeCompare(idOf(b), 'en'))
  return true
}

function idOf(node) {
  return String(node?.get?.('id') ?? '')
}

// Saca un target de un component. Si se queda sin ninguno, el component entero
// se va: declarar una skill para cero runtimes no significa nada.
export function removeTarget(doc, id, target) {
  const component = findComponent(doc, id)
  if (!component) return { changed: false }

  const targets = component.get('targets')
  if (!targets) return { changed: false }

  const index = targets.items.findIndex((item) => item.value === target)
  if (index === -1) return { changed: false }

  targets.delete(index)

  if (targets.items.length === 0) {
    const components = componentsOf(doc)
    components.delete(components.items.indexOf(component))
    return { changed: true, componentRemoved: true }
  }

  return { changed: true, componentRemoved: false }
}

export function setAllowDivergence(doc, id, targets, why) {
  const component = findComponent(doc, id)
  if (!component) return false

  component.set('allowDivergence', [...targets].sort())
  component.set('divergenceWhy', why)
  return true
}

export function componentTargets(doc, id) {
  const component = findComponent(doc, id)
  if (!component) return []
  return (component.get('targets')?.items || []).map((item) => item.value)
}
