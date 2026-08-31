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

Sin dependencias de runtime. Es Node puro.

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

  Costo de arranque       ≈15.992 tokens
    schemas de herramientas MCP   ≈12.296   55 herramientas en 3 servers
      chrome-devtools           ≈6.451   29 herramientas
      playwright                ≈4.630   24 herramientas
      context7                  ≈1.215   2 herramientas
    reglas                      ≈2.925   CLAUDE.md, AGENTS.md
    descripciones de skills       ≈771   12 skills en total

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

**El 69% del arranque son dos servers haciendo lo mismo.** La redundancia deja de ser un consejo
de estilo y pasa a tener precio.

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
| `import` | Genera `syntax.yaml` desde lo que ya hay en disco | ⬜ |
| `build --target <rt>` | Compila el manifest a un runtime, con reporte de pérdida | ⬜ |
| `lock` | Fija SHAs y versiones en `syntax.lock` | ⬜ |
| `verify --strict` | Falla si el entorno derivó del manifest. Para CI. | ⬜ |
| `rollback` | Revierte la última aplicación | ⬜ |

Runtimes con adapter: **Claude Code** y **Codex**, ambos en modo lectura. Los demás se detectan y
se reportan como presentes sin soporte.

`syntax.yaml` está escrito a mano y todavía no lo consume nadie: es el artefacto norte y el caso
real contra el que se valida el schema. Sus `pin` están vacíos porque `lock` no existe, así que
**nuestro propio manifest no es reproducible** y `validateManifest` lo dice. Preferimos que se vea
antes que disimularlo.

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
- [`docs/direction.md`](docs/direction.md) — por qué SyntaX dejó de ser un buscador de skills
- [`docs/licensing.md`](docs/licensing.md) — licencias de skills y qué no romper al copiarlas

`src/legacy/` guarda el recomendador y el instalador del producto anterior. No se extiende: está
ahí porque `build` va a portar parte de esa lógica.

## Licencia

MIT.
