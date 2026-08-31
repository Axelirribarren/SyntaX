<p align="center"><img src="docs/assets/syntax.png" alt="SyntaX" width="640"></p>

# SyntaX

**El compilador de entornos de agente: un manifest, todos los runtimes, con costo y pérdida
medidos antes de aplicar.**

Un entorno de agente —skills, MCP servers, reglas, agentes, hooks, permisos— se declara una vez y
se compila a cada runtime. Antes de escribir nada, SyntaX responde tres preguntas que hoy no
responde ninguna herramienta:

- **¿Cuánto me cuesta este entorno?** Cada MCP inyecta los schemas de sus tools en cada arranque.
  Nadie muestra ese número, y es la causa directa de que sumar herramientas empeore al agente.
- **¿Qué se pierde si lo llevo a otro runtime?** Los runtimes no son equivalentes. Lo que un
  target no sabe expresar se reporta, no se disimula.
- **¿El entorno que corro es el que acordamos?** Sin pins ni verificación, dos personas del mismo
  equipo con el mismo repo corren cosas distintas y nadie se entera.

Una sola dependencia (`yaml`), y `doctor` ni la carga.

## Empezar

No hace falta adoptar nada. `doctor` es solo lectura y corre sobre cualquier proyecto que ya tenga
su `.claude/`, su `.mcp.json` o su `AGENTS.md` armados a mano:

```bash
node src/cli.js doctor /ruta/a/tu/proyecto
node src/cli.js doctor --deep          # además, mide los MCP de verdad
```

Salida real de este mismo repo:

```
  Claude Code    9 skills · 3 MCP servers · 1 archivo de reglas
  Codex          3 skills · 1 archivo de reglas
                 · MCP de Codex no auditado: vive en la config de usuario, fuera del repo.

  Costo de arranque, por runtime
    Claude Code              ≈14.887 tokens
      schemas de herramientas MCP   ≈12.296   55 herramientas en 3 servers
        chrome-devtools         ≈6.451   29 herramientas
        playwright              ≈4.630   24 herramientas
        context7                ≈1.215   2 herramientas
      reglas                      ≈2.006   CLAUDE.md
      descripciones de skills       ≈585   9 skills
    Codex                     ≈2.145 tokens
      reglas                      ≈1.959   AGENTS.md
      descripciones de skills       ≈186   3 skills

  Drift entre runtimes
    x 6 skills de Claude Code que no están en Codex
    x 3 MCP servers de Claude Code que no están en Codex

  Providers duplicados
    x Control e inspección de navegador: 2 providers instalados
      Quedarte con uno ahorra entre ≈4.630 y ≈6.451 tokens por arranque.
      - chrome-devtools (Claude Code) — ≈6.451 tokens
      - playwright (Claude Code) — ≈4.630 tokens

  Pérdida al compilar
    Codex: La config de MCP de Codex es de usuario, no de proyecto: no viaja con el repo.
```

Dos cosas que ese reporte deja ver y que no se ven de ninguna otra forma:

**El 74% del arranque de Claude Code son dos servers haciendo lo mismo.** La redundancia deja de
ser un consejo de estilo y pasa a tener precio.

**Un equipo que comparte `AGENTS.md` cree que comparte entorno, y no comparte los MCP.** La
configuración de MCP de Codex es de usuario: no viaja con el repo.

`--deep` levanta cada MCP server por stdio y le pide su lista de herramientas. Sin él, el costo
sale marcado como parcial y los schemas —la porción más grande— como NO MEDIDO. Ejecuta los
comandos declarados en el `.mcp.json` del proyecto auditado, así que es opt-in y avisa antes.
`--json` devuelve el reporte completo para consumo programático.

## Estado

| Comando | Qué hace | |
|---|---|---|
| `doctor` | Audita el entorno. Solo lectura. | ✅ |
| `doctor --deep` | Levanta cada MCP y mide sus schemas de verdad | ✅ |
| `import` | Genera `syntax.yaml` y `syntax.lock` desde lo que hay en disco | ✅ |
| `build --target <rt>` | Compila el manifest a un runtime, con reporte de pérdida | ⬜ |
| `accept` | Actualiza la línea base a propósito | ⬜ |
| `lock` | Suma resolución de origen para reinstalar igual | ⬜ |
| `verify` | Falla si el entorno derivó del contrato. Solo lectura, para CI. | ✅ |
| `rollback` | Revierte la última aplicación | ⬜ |

Runtimes con adapter: **Claude Code** y **Codex**, ambos en modo lectura. Los demás se detectan y
se reportan como presentes sin soporte.

Por ahora `import` y `verify` cubren **skills**. MCP, reglas y el resto de los objetos se suman
después, sobre una franja que ya demostró el modelo completo.

## Adoptar un entorno y verificarlo

```bash
node src/cli.js import     # observa el disco y escribe el contrato
node src/cli.js verify     # ¿sigue siendo cierto?
```

`import` **observa; no infiere intención.** Adopta cada skill en los targets donde realmente está,
así que el primer `verify` sale limpio. Que la unión deba existir en todos los targets es una
*política de convergencia* que no se deduce del disco: se pide con `--mirror` y queda escrita en el
manifest como `targetPolicy`. La herramienta distingue *"encontré esto"* de *"el equipo quiere
esto"*, y nunca dice *"supuse que el equipo quiere esto"*.

En este repo, esa distinción se ve de una:

```
$ syntax import && syntax verify
  Entorno verificado: coincide con el contrato (política faithful).      exit 0

$ syntax import --mirror --force && syntax verify
  missing — declaradas y no instaladas
    x a11y-audit en codex
    x brand-guidelines en codex
    … 6 en total                                                          exit 1
```

`verify` compara cuatro cosas y **nunca corrige**:

| | | Por defecto |
|---|---|---|
| `missing` | declarada, no instalada | falla |
| `modified` | el contenido no coincide con el lock | falla |
| `diverged` | mismo id, contenido distinto entre targets | falla |
| `unexpected` | instalada, no declarada | avisa; falla con `--strict` |

Exit codes: `0` limpio · `1` diferencias · `2` error. Eso es lo que lo vuelve una línea de CI y no
un reporte más.

### Las tres capas

| Capa | Archivo | Quién lo escribe |
|---|---|---|
| Observación | *(en memoria)* | los adapters |
| Contrato | `syntax.yaml` | personas |
| Integridad | `syntax.lock` | la herramienta |

Un digest responde *"¿esto cambió?"* — no *"¿qué versión es?"*. Y no es integridad byte a byte:
normaliza finales de línea, BOM y unicode de rutas, porque sin eso la misma skill en Windows y en
macOS daría digests distintos y `verify` marcaría todo como modificado el primer día. La spec, con
vectores de prueba, está en [`docs/digest.md`](docs/digest.md).

## Cómo funciona

El manifest es **capability-first**. `capabilities` declara qué se necesita (control de
navegador); `components` declara cómo se cumple (`chrome-devtools-mcp`, con fallback a
`playwright-mcp`). Un target elige el provider que soporta en vez de fallar: la no-equivalencia
entre runtimes es el mecanismo del diseño, no un caso de error.

Cada adapter declara como **datos** qué objetos sabe expresar:

```js
supports: {
  skill:      { dir: '.claude/skills' },
  mcp:        { file: '.mcp.json', key: 'mcpServers' },
  rule:       { file: 'CLAUDE.md', mode: 'merge-markdown' },
  hook:       { file: '.claude/settings.json', key: 'hooks' },
  permission: { file: '.claude/settings.json', key: 'permissions' }
}
```

De ahí sale el reporte de pérdida solo, sin una línea de código por par de runtimes — que es lo
que hace que migrar entre N runtimes no cueste N².

Los ocho objetos universales: `Skill` · `MCP` · `Agent` · `Rule` · `Command` · `Hook` ·
`Permission` · `Env/Secret`. Los cuatro últimos son los que rompen la portabilidad, y por eso
están.

## Sumar un runtime

Es la extensión más frecuente y es barata a propósito. Un archivo en `src/targets/` que exporte
`id`, `label`, `detect(root)`, `supports` y `read(root)`, más una línea en `src/targets/index.js`.
Nada más: el reporte de pérdida y el check de drift se derivan del `supports` declarado.

Detalle completo en [`docs/agent-brief.md`](docs/agent-brief.md).

## Desarrollo

```bash
npm test          # node --test, sin dependencias
npm run doctor    # auditar este mismo repo (el dogfood)
npm run docs      # regenerar CLAUDE.md y AGENTS.md desde el brief
```

La documentación de agentes tiene **una sola fuente**: [`docs/agent-brief.md`](docs/agent-brief.md).
`CLAUDE.md` y `AGENTS.md` se generan desde ahí, cada uno con su sección propia, y un test falla si
divergen. Es el primer target adapter en miniatura, y por qué cualquier IDE que abra este repo
entiende lo mismo.

- [`docs/backlog.md`](docs/backlog.md) — pendientes, deuda y riesgos conocidos
- [`docs/digest.md`](docs/digest.md) — spec del digest, con vectores de prueba
- [`docs/direction.md`](docs/direction.md) — por qué SyntaX dejó de ser un buscador de skills
- [`docs/licensing.md`](docs/licensing.md) — licencias de skills y qué no romper al copiarlas

`src/legacy/` guarda el recomendador y el instalador del producto anterior. No se extiende: está
ahí porque `build` va a portar parte de esa lógica.

## Licencia

MIT.
