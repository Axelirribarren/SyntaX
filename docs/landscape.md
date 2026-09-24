# Panorama: qué existe afuera

Relevamiento del 2026-09-23. Sirve para una sola cosa: **no reconstruir lo que otro ya resuelve
bien**, y saber en qué se diferencia pactlock. Antes de agregar una capacidad nueva, se busca acá
(y afuera) si ya existe. Si el panorama cambió, se actualiza este archivo con fecha y fuente.

## Mapa

| Pilar | Herramientas | Qué hacen | Qué no hacen |
|---|---|---|---|
| Sincronizar configuración entre runtimes | [agentsync](https://github.com/x0c/agentsync), [vsync](https://github.com/nicepkg/vsync), [agents](https://github.com/amtiYo/agents), [agent-sync](https://github.com/Alpha-30-creator/agent-sync), [Plexus](https://minilv.github.io/Plexus/how-to-sync-claude-code-cursor-codex-configs.html) | Una fuente de verdad (reglas, skills, MCP) traducida a Claude Code, Codex, Cursor, Gemini CLI, etc. | Contrato de equipo con aceptación deliberada; reporte de pérdida por runtime; verificación en CI como política. |
| Costo de contexto de MCP | [mcp-context-cost](https://github.com/athakur3/mcp-context-cost), [mcp-context-budget](https://github.com/KaryawanSurga/mcp-context-budget), [mcp-checkup](https://mcpservers.org/servers/yifanyifan897645/mcp-checkup) | Tokens por server y por tool, porcentajes de la ventana, duplicados, gate en CI. | Costo de skills y reglas junto con MCP, por runtime; drift entre runtimes; integridad. |
| Seguridad de herramientas de agente | [Snyk Agent Scan (ex mcp-scan)](https://github.com/snyk/agent-scan) | Detecta prompt injection, tool poisoning, rug pulls (tool pinning por hash), escanea skills; descubre configuraciones de Claude Code, Cursor, Gemini CLI, Windsurf. | Contrato versionado en el repo, compartido por el equipo; aceptación nombrada y auditable; política de permisos entre runtimes. |

## Dónde se para pactlock

**Contrato de equipo + mínimo privilegio, verificados en CI.**

- Frente a los sincronizadores: pactlock no parte de "escribí esto en todos lados" sino de "esto es
  lo que acordamos, y así se verifica". Observar no es decidir (`import` no infiere intención) y
  aceptar es una frontera de confianza (`accept`).
- Frente a las herramientas de costo: `doctor` mide lo mismo y más (skills, reglas, por runtime),
  pero es la puerta de entrada, no la tesis. No se compite en features de costo.
- Frente a Snyk: complementario. Snyk: "¿esta herramienta es maliciosa?". pactlock: "¿el equipo
  corre lo que acordó, y con qué permisos?". Integración posible a futuro (por ejemplo, correr
  ambos en el mismo workflow de CI); competencia en detección de contenido malicioso, no.

## Señales a vigilar

- Que un sincronizador agregue lockfile + verify en CI: la diferenciación se achica al permiso y
  a la aceptación deliberada.
- Que Snyk Agent Scan agregue contrato de equipo versionado en el repo.
- Que los vendors converjan en formato de permisos y hooks (ver "El riesgo" en `direction.md`).

## Nombres vecinos

- **AgentPact** ([marketplace de agentes](https://github.com/adamkrawczyk/agentpact), SDK
  `agentpact` en npm, servidor MCP): mismo ecosistema. Es la razón por la que se descartó
  `agent-pact` (ADR 0001).
- **Pact** (pact.io, *contract testing* de APIs, usa el término "pactfile"): otro dominio. El
  nombre compuesto `pactlock` no choca, pero no conviene hablar de "pactfile" en la documentación.

Cualquiera de las tres señales, cuando aparezca, se anota acá con fecha y se revisa el plan.
