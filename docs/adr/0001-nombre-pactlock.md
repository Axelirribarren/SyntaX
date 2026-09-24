# ADR 0001: el producto se llama pactlock

- **Estado:** aceptado
- **Fecha:** 2026-09-23
- **Decide:** el usuario (autor del proyecto)

## Contexto

El producto cambió de esencia dos veces: nació como buscador de skills, pasó a compilador de
entornos y hoy es **lockfile y política para entornos de agente** (`docs/direction.md`, "Foco
vigente"). El nombre SyntaX venía del primer producto y no dice nada del actual.

Además, SyntaX no se puede publicar:

- `syntax` está tomado en npm (verificado el 2026-09-23).
- Se consideró `agent-pact`: está libre en npm, pero **AgentPact** ya es un producto activo del
  mismo ecosistema (un marketplace de agentes de IA con SDK `agentpact` en npm, servidor MCP
  publicado y lanzamiento en Hacker News), y hay varios repos chicos con ese nombre, uno de ellos
  presentado como estándar de gobernanza de agentes. Buscar la herramienta devolvería a otros, con
  posible conflicto de marca.
- Se consideró mantener SyntaX como nombre de una familia de herramientas. Se descartó: el cambio
  es de esencia, no de catálogo, y un nombre de familia sin una segunda herramienta es costo sin
  beneficio.

## Decisión

**El producto se llama `pactlock`.** "Pact" es el contrato del equipo (`import` → contrato,
`accept` → autorización); "lock" es la línea base de integridad que `verify` hace cumplir.

- Paquete npm: `pactlock` (libre al 2026-09-23). Binario: `pactlock`. Uso: `npx pactlock doctor`.
- Repositorio: `Axelirribarren/pactlock` (renombrar el repo en GitHub mantiene la redirección
  desde la URL vieja).
- Archivos del contrato: `pactlock.yaml` (manifest) y `pactlock.lock` (lock).
- **SyntaX queda como nombre histórico.** Las secciones de historia de `direction.md` y del
  backlog lo conservan; todo lo operativo y público usa `pactlock`. El README lo menciona una vez:
  *"formerly SyntaX"*.

### Sin compatibilidad con los nombres viejos

No hay usuarios externos: nada se publicó. Por eso **no se lee `syntax.yaml` ni `syntax.lock`**
después de la migración, no hay período de deprecación y no hace falta un comando `migrate`. El
único proyecto con archivos viejos es este repo, y se migra una vez, a mano, siguiendo el
checklist. Mantener compatibilidad para cero usuarios es deuda sin beneficio.

### El algoritmo del digest también se renombra, ahora

`syntax-skill-tree-v1` y `syntax-skill-file-v1` no son solo etiquetas: son el **prefijo de
dominio** del hash (`docs/digest.md`, paso 1). Renombrarlos cambia todos los digests y los
vectores de prueba.

Se renombran igual, a `pactlock-skill-tree-v1` y `pactlock-skill-file-v1`, porque este es el
**único momento barato**: antes de la primera publicación, ningún lock ajeno depende de ellos.
Después de publicar, los identificadores de algoritmo quedan congelados para siempre y un cambio
exige una versión nueva (`-v2`), como ya dice la spec. Un `pactlock.lock` que declara
`syntax-skill-tree-v1` sería confuso para cualquier persona que lo lea por primera vez.

## Inventario de la migración

Relevado con `grep` el 2026-09-23 (sin `node_modules`, `.git` ni las skills vendorizadas de
`.claude/` y `.agents/`, cuyos matches son falsos positivos: la palabra "syntax" en datos de
terceros).

| Superficie | Hoy | Después |
|---|---|---|
| Paquete y binario | `package.json`: `name: syntax`, `bin.syntax`, `"private": true` | `name: pactlock`, `bin.pactlock`, sin `private` |
| Archivos del contrato | `syntax.yaml`, `syntax.lock` (`src/import.js`: `MANIFEST_FILE`, `LOCK_FILE`) | `pactlock.yaml`, `pactlock.lock` |
| Algoritmos del digest | `syntax-skill-tree-v1`, `syntax-skill-file-v1` (`src/manifest/digest.js`) | `pactlock-skill-tree-v1`, `pactlock-skill-file-v1`, con vectores nuevos en `docs/digest.md` y `test/digest.test.js` |
| Archivos temporales y de journal | `.syntax-journal.json`, `*.syntax-tmp-*`, `*.syntax-prev-*` (`src/manifest/journal.js`, `atomic.js`) | `.pactlock-journal.json`, `*.pactlock-tmp-*`, `*.pactlock-prev-*` |
| Directorio de trabajo reservado | `.syntax/` | `.pactlock/` |
| Detección de backups huérfanos | `syntax-backup` (`src/doctor/checks/orphans.js`) | **Se conserva** la detección de `*.syntax-backup-*`: son residuos reales del producto anterior en repos ajenos, y `doctor` tiene que seguir reconociéndolos. Se agrega `pactlock-backup` para el futuro. |
| Handshake MCP | `clientInfo.name: 'syntax-doctor'` (`src/doctor/probe.js`) | `'pactlock-doctor'`, con la versión tomada de `package.json` en lugar de estar fija |
| Ayuda y mensajes de la CLI | `syntax doctor`, `Corré: syntax import`, etc. (`src/cli.js`, `import.js`, `verify.js`, `accept.js`) | `pactlock …`, en la misma migración (el rename no se parte). La migración de mensajes a claves e inglés viene después, en la fase 1: los tests que hacen match de texto se tocan dos veces, un costo chico a cambio de no dejar la CLI con dos nombres |
| Marcadores del brief | `SYNTAX:BRIEF:START/END` (`scripts/emit-docs.mjs`) | `PACTLOCK:BRIEF:START/END`, regenerando `CLAUDE.md` y `AGENTS.md` |
| `.gitignore` | patrones `syntax` | patrones `pactlock`, conservando `*.syntax-backup-*` |
| Tests, fixtures y scripts | prefijos de directorios temporales (`syntax-doctor-`, `syntax-home-`, …), asserts sobre nombres de archivo | prefijo `pactlock-` |
| CI | comentario y pasos del dogfood sobre `syntax.lock` | `pactlock.lock` |
| Manifest propio | `name: SyntaX` en `syntax.yaml` | `name: pactlock` en `pactlock.yaml` |
| Documentación | README, brief, `direction`, `digest`, `landscape`, `backlog`, `implementation-plan`, `licensing`, `manifest-example.yaml` | `pactlock`; lo histórico conserva SyntaX |
| Imagen suelta | `SyntaX` en la raíz (PNG de 1,6 MB sin extensión) y `docs/assets/syntax.png` | Borrar la suelta. El logo se rehace con el nombre nuevo o se quita del README hasta tenerlo |
| Fuera del repo (lo hace el usuario) | Repo `Axelirribarren/SyntaX`; carpeta local `SyntaX/SyntaX` | Renombrar el repo en GitHub; mover la carpeta a `C:\Proyectos GRANDES\pactlock` (sin anidar, fuera de OneDrive) y actualizar la ruta en la sección propia de `CLAUDE.md` en `scripts/emit-docs.mjs` |

## Orden de la migración

Un solo cambio coherente, en este orden, con la suite verde al final de cada paso:

1. **Línea base:** con los nombres viejos, `npm test` en verde y `verify` limpio sobre este repo.
2. **Código:** renombrar las constantes y los mensajes del inventario. Los tests que hacen match de
   nombres se actualizan en el mismo paso.
3. **Algoritmo:** renombrar los identificadores, recalcular los vectores de `docs/digest.md` y
   `test/digest.test.js`, y verificar que **solo** cambian por el prefijo: la normalización es la
   misma.
4. **Contrato propio:** mover `syntax.yaml` → `pactlock.yaml` conservando los `why` y regenerar el
   lock con el algoritmo nuevo (`pactlock import --relock`; si `--relock` rechaza el cambio de
   algoritmo, que es lo esperado, se regenera con `import` y se reponen los `why` a mano). Después,
   `pactlock verify --strict` tiene que salir limpio.
5. **Documentación:** README, brief (`npm run docs`), specs y ejemplos.
6. **Fuera del repo:** el usuario renombra el repo en GitHub y mueve la carpeta; después se
   actualiza la ruta en `scripts/emit-docs.mjs` y se corre `npm run docs`.
7. **Comprobación final:** `grep -ri syntax` fuera de `node_modules`, `.git`, las skills
   vendorizadas y las secciones históricas devuelve solo la detección de `*.syntax-backup-*` y las
   menciones deliberadas a "formerly SyntaX".

Git es del usuario: cada paso deja el árbol listo para que el usuario revise y commitee.

## Consecuencias

- `npx pactlock doctor` es el comando de adopción; el README y los posts lo usan desde el primer
  día.
- Los digests de este repo cambian una vez. No afecta a nadie más.
- "Pact" también es el nombre de una herramienta conocida de *contract testing* de APIs (pact.io),
  que usa el término "pactfile". Es otro dominio (tests de APIs, no agentes) y el nombre
  compuesto `pactlock` no choca; se anota en `docs/landscape.md` para vigilarlo.
- Si en el futuro aparece una segunda herramienta, la discusión de un nombre de familia se reabre
  con un ADR nuevo.
