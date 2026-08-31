# SyntaX — brief para agentes

Este bloque se genera desde `docs/agent-brief.md`, que es la **única fuente** de lo que leen
todos los runtimes. No lo edites en `CLAUDE.md` ni en `AGENTS.md`: se pisa y el test de drift
falla. Editá el brief y corré `npm run docs`.

## Qué es SyntaX

**El compilador de entornos de agente: un manifest, todos los runtimes, con costo y pérdida
medidos antes de aplicar.**

Un entorno de agente (skills, MCP servers, reglas, agentes, hooks, permisos) se declara una vez
en `syntax.yaml` y se compila a cada runtime — Claude Code, Codex, y los que sumen. Antes de
escribir nada, SyntaX dice cuánto cuesta ese entorno en tokens, qué se pierde en cada runtime y
si lo que hay en disco coincide con lo acordado.

## Qué dejó de ser

Un buscador e instalador de skills. Esa tesis se abandonó: el catálogo lo ganan por volumen los
registries grandes y lo absorben los propios vendors. Si encontrás código de búsqueda en GitHub,
favoritos, recomendador por palabras clave o UI de kits, es residuo — está en `src/legacy/` o
pendiente de borrar, y **no se extiende**.

## Los objetos universales

Ocho. Los cuatro últimos son los que rompen la portabilidad entre runtimes y por eso importan más
de lo que parece:

`Skill` · `MCP` · `Agent` · `Rule` · `Command` · `Hook` · `Permission` · `Env/Secret`

El manifest es **capability-first**: `capabilities` declara qué se necesita (control de
navegador), `components` declara cómo se cumple (`chrome-devtools-mcp`, con fallback a
`playwright-mcp`). Un target elige el provider que soporta en vez de fallar. La no-equivalencia
entre runtimes es el mecanismo del diseño, no un bug a tapar.

## Estado real

Implementado: `doctor` con cinco checks, el contrato de adapters, los adapters de Claude Code y
Codex en modo lectura, y `doctor --deep`, que levanta cada MCP server por stdio y mide los tokens
de sus schemas de verdad.

No implementado todavía: `import`, `build`, `lock`, `verify`, `rollback` y el visor web de
reportes. `src/manifest/schema.js` define la forma del manifest pero **no hay parser**:
`syntax.yaml` está escrito a mano y todavía no lo consume nadie.

Al describir el proyecto, no presentes como funcionando lo que está en la lista de no
implementado.

Lo que quedó abierto —incluidas las decisiones que todavía no se tomaron y las que van a doler
más adelante— está en `docs/backlog.md`. **Leelo antes de proponer trabajo nuevo**: es probable
que ya esté anotado ahí, con el motivo por el que se dejó pendiente.

## Reglas duras

- **Git es del usuario.** Nunca `git init`, `add`, `commit`, `push`, `reset` ni ninguna otra
  operación de git. El usuario maneja su historial.
- **Todo lo que escribe en un proyecto ajeno es reversible.** Backup antes de pisar, y el backup
  tiene que ser listable y revertible por un comando. Backups sueltos acumulándose en el repo del
  usuario es un bug, no una función.
- **Nada entra al registry sin verificar** que el repo existe, que el paquete resuelve y que la
  ruta de la skill es real. Un item que no se puede instalar de forma determinista no entra.
- **Los secretos nunca se escriben a disco.** Van como placeholder para que el usuario los
  complete; así no termina commiteando una clave.
- **Las licencias viajan con la skill.** Las skills de `anthropics/skills` son Apache 2.0, cuya
  sección 4(a) exige entregar copia de la licencia junto al trabajo. La copia recursiva arrastra
  el `LICENSE.txt` sola. Si alguna vez se copia selectivamente, hay que seguir llevándolo. Ver
  `docs/licensing.md`.
- **`doctor` no escribe nunca.** Eso no se negocia: es lo que permite correrlo en un repo ajeno
  sin pedir confianza. Por defecto tampoco lanza procesos; la única excepción es `--deep`, que
  ejecuta los comandos del `.mcp.json` auditado para medirlos. Por eso es opt-in, avisa antes, y
  la parte que ejecuta vive aislada en `src/doctor/probe.js`.
- **Los números del reporte se declaran con su incertidumbre.** El conteo de tokens va con `≈` y
  lo que no se midió se dice explícitamente. Un titular inflado destruye la credibilidad de todo
  el reporte, que es el activo del producto.

## Dónde está cada cosa

```
src/cli.js              dispatch de comandos
src/doctor/             checks, orquestación y reporte
src/targets/            contract.js + un adapter por runtime
src/manifest/           forma del manifest (sin parser todavía)
src/registry/           mapa capability -> providers
src/fs/                 utilidades de disco seguras
src/legacy/             recomendador viejo, degradado a opcional
docs/backlog.md         pendientes, deuda y riesgos conocidos
docs/direction.md       por qué se hizo este cambio de rumbo
docs/licensing.md       análisis de licencias de skills
syntax.yaml             el entorno de este propio repo
```

## Cómo sumar un runtime

Es la extensión más frecuente y tiene que ser barata. Crear `src/targets/<id>.js` que exporte el
contrato de `src/targets/contract.js`: `id`, `label`, `detect(root)`, `supports` (declarado como
datos: qué objetos sabe expresar y en qué archivo o directorio), y `read(root)`. Registrarlo en
`src/targets/index.js`. El reporte de pérdida sale solo de `supports` — no se escribe código
específico por par de runtimes.
