// El contrato de adapters — la decisión central de la arquitectura.
//
// El equipo puede traer cualquier runtime (opencode, Gemini CLI, Windsurf, lo
// que salga el mes que viene), así que sumar uno tiene que ser barato y
// declarativo. Un adapter declara como DATOS qué objetos sabe expresar y dónde
// los guarda; no escribe lógica de conversión.
//
// De ese `supports` declarativo salen dos cosas sin código adicional:
//
//   1. El reporte de pérdida. Todo objeto del manifest cuyo `kind` no aparece en
//      `supports` del target es una pérdida documentada. No hay código
//      específico por par de runtimes — que es justamente lo que hace que
//      migrar entre N runtimes no cueste N².
//   2. El check de drift. Comparar los objetos que dos adapters leyeron del
//      disco solo tiene sentido para los `kind` que ambos soportan.

// Los ocho objetos universales. Los cuatro últimos son los que rompen la
// portabilidad entre runtimes: son justamente donde cada vendor diferencia y
// por eso nadie los va a estandarizar.
export const OBJECT_KINDS = [
  'skill',
  'mcp',
  'agent',
  'rule',
  'command',
  'hook',
  'permission',
  'secret'
]

// Nombres en castellano para el reporte. Viven acá, junto a OBJECT_KINDS, para
// que sumar un objeto universal no deje textos en inglés por el camino.
const KIND_LABELS = {
  skill: ['skill', 'skills'],
  mcp: ['MCP server', 'MCP servers'],
  agent: ['agente', 'agentes'],
  rule: ['archivo de reglas', 'archivos de reglas'],
  command: ['comando', 'comandos'],
  hook: ['hook', 'hooks'],
  permission: ['permiso', 'permisos'],
  secret: ['secreto', 'secretos']
}

export function kindLabel(kind, count = 2) {
  const pair = KIND_LABELS[kind]
  if (!pair) return kind
  return count === 1 ? pair[0] : pair[1]
}

// Un `supports` es un objeto { [kind]: descriptor }. El descriptor dice dónde
// vive ese objeto en el runtime:
//
//   { dir: '.claude/skills' }                         una carpeta por objeto
//   { file: '.mcp.json', key: 'mcpServers' }          una clave dentro de un archivo
//   { file: 'CLAUDE.md', mode: 'merge-markdown' }     texto fusionado
//
// Campos opcionales del descriptor:
//   scope: 'project' (default) | 'user'   dónde vive de verdad la config
//   note:  string                          matiz que el reporte debe mostrar
export function defineTarget(spec) {
  const missing = ['id', 'label', 'detect', 'supports', 'read'].filter((key) => !spec[key])
  if (missing.length) {
    throw new Error(`Adapter incompleto (${spec.id || 'sin id'}): falta ${missing.join(', ')}`)
  }

  for (const kind of Object.keys(spec.supports)) {
    if (!OBJECT_KINDS.includes(kind)) {
      throw new Error(`Adapter ${spec.id}: '${kind}' no es un objeto universal conocido.`)
    }
  }

  return { scope: 'project', ...spec }
}

// Los objetos que el runtime carga de verdad. Lo que está en disco pero el
// runtime ignora (una carpeta de skill sin SKILL.md, por ejemplo) no es parte
// del entorno: cuenta como resto, no como capacidad instalada.
export function active(objects = []) {
  return objects.filter((object) => object.valid !== false)
}

export function supportedKinds(target) {
  return OBJECT_KINDS.filter((kind) => Boolean(target.supports[kind]))
}

// Los `kind` que este target no sabe expresar. Es el reporte de pérdida en su
// forma más simple: qué se cae al compilar hacia acá.
export function unsupportedKinds(target, kinds = OBJECT_KINDS) {
  return kinds.filter((kind) => !target.supports[kind])
}

// Los objetos que dos targets pueden compartir. Comparar drift fuera de esta
// intersección produce ruido: que Codex no tenga hooks no es un drift, es una
// limitación declarada del runtime.
export function comparableKinds(a, b) {
  return supportedKinds(a).filter((kind) => Boolean(b.supports[kind]))
}

// Forma que devuelve `read(root)`. Se construye siempre con este helper para
// que un adapter incompleto no rompa a los consumidores.
export function emptySnapshot(target) {
  return {
    target: target.id,
    label: target.label,
    present: false,
    objects: Object.fromEntries(OBJECT_KINDS.map((kind) => [kind, []])),
    notes: []
  }
}
