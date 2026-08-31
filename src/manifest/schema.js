// Forma del manifest. Todavía NO hay parser: `syntax.yaml` se escribe a mano y
// nadie lo consume. El schema se define primero y se valida contra un caso real
// —el entorno de este mismo repo— antes de congelarlo, porque un contrato
// portable que se define en abstracto se rompe en el primer caso concreto.
//
// La decisión de diseño que sostiene todo: el manifest es CAPABILITY-FIRST.
//
//   capabilities:  qué necesita el entorno   ("control de navegador")
//   components:    cómo se cumple            (chrome-devtools-mcp, o playwright)
//
// Un modelo artifact-first obliga a traducir 1:1 entre runtimes y falla cuando
// no hay equivalente. Capability-first deja que cada target elija un provider
// que sí soporta. La no-equivalencia entre runtimes pasa a ser el mecanismo del
// diseño en vez de un caso de error.

import { OBJECT_KINDS } from '../targets/contract.js'

export const SCHEMA_VERSION = 2

// Cómo se reparten los components entre targets.
//   faithful — cada component vale en los targets donde fue observado.
//              Es el default de `import`: describe lo que hay, sin inventar.
//   mirror   — todo component tiene que existir en TODOS los targets. Es una
//              política de convergencia: no se deduce del disco, la pide una
//              persona con `import --mirror` y queda escrita acá.
export const TARGET_POLICIES = ['faithful', 'mirror']

// Referencia de la forma esperada. Es documentación ejecutable: los tests la
// usan como fixture y `validateManifest` la respeta.
export const SHAPE = {
  version: 'number — SCHEMA_VERSION',
  name: 'string',
  capabilities: {
    '<capability-id>': {
      provider: 'string — id del component elegido',
      fallback: 'string[] — providers alternativos, en orden de preferencia'
    }
  },
  components: [
    {
      kind: `string — uno de: ${OBJECT_KINDS.join(', ')}`,
      id: 'string — identidad estable del objeto',
      source: 'string — owner/repo, paquete npm, o ruta local',
      path: 'string — ruta dentro del source (skills)',
      // pin es ORIGEN/VERSIÓN: sirve para reinstalar lo mismo. La integridad
      // de lo que hay hoy en disco NO vive acá: vive en syntax.lock como
      // digest. Son propiedades distintas y confundirlas haría creer que hay
      // reproducibilidad donde solo hay detección de cambios.
      pin: 'string — commit SHA o versión exacta. Sin pin no se puede reinstalar igual.',
      targets: 'string[] — targets donde vale este component (política faithful)',
      why: 'string — por qué está. Opcional; `import` no lo puede saber.',
      env: '{ [nombre]: "${secret}" } — nunca valores reales'
    }
  ],
  permissions: { deny: 'string[]', allow: 'string[]', ask: 'string[]' },
  targetPolicy: `string — uno de: ${TARGET_POLICIES.join(', ')} (default faithful)`,
  targets: 'string[] — ids de adapters'
}

export function validateManifest(value) {
  const errors = []

  if (!value || typeof value !== 'object') return ['El manifest tiene que ser un objeto.']
  if (value.version !== SCHEMA_VERSION) {
    errors.push(`version tiene que ser ${SCHEMA_VERSION} (llegó ${value.version}).`)
  }
  if (typeof value.name !== 'string' || !value.name) errors.push('Falta name.')
  if (!Array.isArray(value.targets) || !value.targets.length) {
    errors.push('targets tiene que listar al menos un runtime.')
  }

  for (const [index, component] of (value.components || []).entries()) {
    const where = `components[${index}]`
    if (!OBJECT_KINDS.includes(component.kind)) {
      errors.push(`${where}.kind '${component.kind}' no es un objeto universal.`)
    }
    if (!component.id) errors.push(`${where} no tiene id.`)

    // Un component con origen declarado pero sin pin no se puede reinstalar
    // igual: es el bug del instalador anterior. Un component sin `source` —lo
    // que produce `import`, que observa disco y no sabe de dónde vino— no tiene
    // por qué tener pin todavía.
    if (component.source && !component.pin) {
      errors.push(`${where} (${component.id}) declara source sin pin: no se puede reinstalar igual.`)
    }

    if (component.targets !== undefined) {
      if (!Array.isArray(component.targets) || !component.targets.length) {
        errors.push(`${where} (${component.id}).targets tiene que listar al menos un target.`)
      } else {
        for (const target of component.targets) {
          if (!(value.targets || []).includes(target)) {
            errors.push(`${where} (${component.id}) declara el target '${target}', que no está en targets.`)
          }
        }
      }
    }

    for (const [key, envValue] of Object.entries(component.env || {})) {
      if (envValue !== '${secret}') {
        errors.push(`${where}.env.${key} tiene un valor literal: los secretos no van al manifest.`)
      }
    }
  }

  if (value.targetPolicy !== undefined && !TARGET_POLICIES.includes(value.targetPolicy)) {
    errors.push(`targetPolicy '${value.targetPolicy}' no es válida (${TARGET_POLICIES.join(' | ')}).`)
  }

  for (const [id, capability] of Object.entries(value.capabilities || {})) {
    if (!capability.provider) errors.push(`capabilities.${id} no declara provider.`)
  }

  return errors
}
