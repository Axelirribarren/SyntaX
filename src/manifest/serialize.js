// Escritura de syntax.yaml.
//
// El manifest es el archivo que edita una persona y que un equipo revisa en un
// diff, así que se genera con un encabezado que explica qué es y qué falta
// completar. `import` no puede saber el porqué de nada: deja `why` sin poner y
// lo dice arriba.

import { stringify } from 'yaml'

import { SCHEMA_VERSION } from './schema.js'

const ENCABEZADO = [
  '# syntax.yaml — el contrato: qué entorno queremos, y por qué.',
  '#',
  '# Generado por `syntax import` a partir de lo que había en disco. Lo que la',
  '# herramienta NO puede saber es el porqué de cada cosa: completá `why:` en',
  '# los components que importen. Ese texto sobrevive a las reescrituras; los',
  '# comentarios no.',
  '#',
  '# La integridad de lo instalado no vive acá: vive en syntax.lock.',
  ''
]

export function serializeManifest(manifest) {
  const ordenado = {
    version: manifest.version ?? SCHEMA_VERSION,
    name: manifest.name,
    ...(manifest.targetPolicy ? { targetPolicy: manifest.targetPolicy } : {}),
    targets: manifest.targets,
    ...(manifest.capabilities ? { capabilities: manifest.capabilities } : {}),
    components: manifest.components,
    ...(manifest.permissions ? { permissions: manifest.permissions } : {})
  }

  const cuerpo = stringify(ordenado, {
    // Sin anchors ni aliases en la salida: el parser los rechaza al leer, así
    // que emitirlos produciría un archivo que la propia herramienta no acepta.
    aliasDuplicateObjects: false,
    lineWidth: 0,
    nullStr: ''
  })

  return `${ENCABEZADO.join('\n')}\n${cuerpo}`
}
