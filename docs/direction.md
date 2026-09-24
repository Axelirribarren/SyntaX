# Dirección de pactlock (ex SyntaX): foco vigente y cambios de rumbo

Documento para el equipo, no para los agentes. El brief operativo está en
[`agent-brief.md`](agent-brief.md).

## Foco vigente (revisado el 2026-09-23)

Este documento registra dos cambios de rumbo. El primero, más abajo, dejó el buscador de skills
por el compilador de entornos. El segundo, esta sección, **deja el compilador como destino** y
pone al contrato verificable en el centro. La historia se conserva porque las razones siguen
valiendo; lo que cambia es el orden.

### Qué cambió: el mercado se llenó en dos de los tres pilares

Relevamiento del 2026-09-23 (detalle y fuentes en [`landscape.md`](landscape.md)):

- **Sincronizar entre runtimes** ya tiene al menos cinco herramientas open source (`agentsync`,
  `vsync`, `agents`, `agent-sync`, Plexus). Traducir configuración es commodity.
- **Costo en tokens de MCP** tiene varias herramientas, algunas con gate para CI
  (`mcp-context-cost`) y detección de duplicados (`mcp-checkup`).
- **Integridad de herramientas** tiene un jugador grande: Snyk Agent Scan (ex mcp-scan, Invariant
  Labs), que hace tool pinning por hash y escanea skills. Su foco es **detectar contenido
  malicioso** en la máquina de una persona.

Lo que **nadie** está haciendo bien es la pregunta 3 de más abajo, tratada como política de
equipo: *¿el entorno que corre cada persona es el que acordamos, con los permisos que
aceptamos?* Un contrato versionado en el repo, verificado en CI, con aceptación deliberada y
auditable de cada capacidad nueva, y con la pregunta de permisos (mínimo privilegio) arriba de la
mesa.

### El foco

**Lockfile y política para entornos de agente.**

1. `import` / `verify --strict` / `accept` son el corazón: el contrato de equipo y la frontera de
   confianza.
2. El check de permisos (`allow` amplio + MCP con escritura, hooks que ejecutan código) es la
   próxima capacidad: es seguridad que nadie más muestra, y es donde la tesis contra la
   convergencia (más abajo) apuesta.
3. `doctor` es el gancho de adopción: gratis, solo lectura, `npx` en una línea. No es la tesis.
4. `build` queda como **opción condicionada** al punto de decisión A del plan: se construye solo
   si hay evidencia de que alguien necesita compilar, y no solo verificar.

Frente a Snyk: **complementarios, no competidores.** Snyk responde "¿esta herramienta es
maliciosa?"; pactlock responde "¿el equipo corre lo que acordó, y con qué permisos?". Conviene
decirlo en el README.

### El activo que compone, sin telemetría

La sección "El activo que compone" sigue vigente, con un cambio de mecanismo: el corpus se arma
primero **corriendo `doctor` sobre repos públicos** que declaran `.mcp.json`, `.claude/` o
`AGENTS.md`. No requiere telemetría, no toca datos privados y lo puede hacer una sola persona. Su
primer producto es un informe público; el segundo, derivar colisiones del uso real en lugar de
curar `capabilities.js` a mano. La telemetría opt-in queda como decisión posterior, no como
condición.

### Nombre

**El producto pasa a llamarse `pactlock`** ([ADR 0001](adr/0001-nombre-pactlock.md)). El cambio
es de esencia, no solo de etiqueta: "pact" es el contrato del equipo y "lock" la línea base que
`verify` hace cumplir. SyntaX queda como nombre histórico; las secciones de abajo lo conservan
porque describen lo que fue.

## Lo que no funcionaba

SyntaX nació como buscador + instalador de skills, MCPs y plugins. Esa posición es indefendible
por dos razones independientes, y cualquiera de las dos alcanza:

**Volumen.** Los catálogos que ya existen tienen órdenes de magnitud más items, y curar a mano no
escala contra eso. Un catálogo curado es además copiable en una tarde: no acumula nada.

**Los vendors la absorben.** Claude Code trae `/plugin marketplace`. VS Code y Cursor instalan MCP
en un click. Existe un registry oficial de MCP. Todo lo que sea "explorar e instalar" queda a una
feature de distancia de ser gratis dentro de la herramienta que ya usás.

Y sobre todo: **descubrir no era el problema real de nadie.** La gente no sufre por no encontrar
skills. Sufre porque instaló doce y el agente empeoró, o porque su compañero tiene otro entorno y
los resultados no se parecen.

## Lo que sí está sin resolver

Tres preguntas que hoy no responde ninguna herramienta:

1. **¿Cuánto me cuesta este entorno?** Cada MCP inyecta los schemas de sus tools en cada arranque.
   Cada skill aporta su descripción. Las reglas ocupan lugar. Nadie muestra ese número, y es la
   causa directa de que agregar herramientas degrade al agente.
2. **¿Qué se pierde si lo llevo a otro runtime?** Los runtimes no son equivalentes. Las
   herramientas oficiales de migración hacia Codex ya tienen que convertir configuraciones MCP y
   admitir funciones sin equivalente directo. El problema de compatibilidad es real y está
   documentado por los propios vendors.
3. **¿El entorno que corro es el que acordamos?** Sin pins ni verificación, dos personas del mismo
   equipo con el mismo repo tienen entornos distintos y nadie se entera.

Ninguna de las tres la va a resolver un vendor, porque las tres son cross-runtime y eso va en
contra de su lock-in. Ahí hay lugar.

## La prueba está en este repo

No hizo falta buscar un caso: el repo de SyntaX tenía los cuatro síntomas a la vez.

- `.claude/skills/` con 10 skills y `.agents/skills/` con 3. Claude Code y Codex divergieron y
  nada lo detectó.
- `.mcp.json` levantando `chrome-devtools` y `playwright` simultáneamente: dos providers de la
  misma capability, los dos inyectando schemas en cada arranque.
- 13 carpetas `.syntax-backup-*` huérfanas, sin comando que las liste ni las revierta, y sin
  entrada en `.gitignore`.
- Skills copiadas con `git clone --depth 1` del branch por defecto: aplicar el mismo plan dos
  veces da entornos distintos, sin registro de qué cambió.

Que la herramienta que instalaba entornos generara exactamente los problemas que nadie mide es el
mejor argumento disponible para el cambio de rumbo.

## La escalera, en el orden correcto

La progresión natural que uno dibuja —
directorio → composer → entornos compartibles → manager de equipo → plataforma de infraestructura —
es un roadmap de distribución disfrazado de roadmap de producto, y tiene un modo de falla clásico:
la cuña que nunca se ensancha.

Los usuarios que adquirís con un directorio (individuos que instalan una vez y se van) no son los
compradores de un manager de equipo (plataforma/DX). No hay conversión entre esas poblaciones. Y
el activo que construís curando catálogo no sirve para ninguno de los escalones siguientes.

El orden que sí funciona:

> **Revisado el 2026-09-23.** Esta escalera ponía `compile` dentro de la primitiva. Ya no: la
> primitiva es manifest + lock + verify + doctor, y `compile` es una opción. Ver "Foco vigente".

**Empezar por los entornos reproducibles.** Es el único escalón que es producto completo para una
persona sola *y* sustrato técnico de todo lo demás. Manifest + lock + compile + doctor son la
primitiva; lo demás son capas encima, no reconstrucciones.

**El directorio y el composer caen solos.** Un entorno necesita componentes con metadata: eso ya
es el directorio, pero generado por uso real en vez de curado a mano. La UI de autoría es el
composer.

**`verify --strict` es lo que convierte usuario en comprador.** No un dashboard: un check que
falla en CI cuando el entorno de alguien derivó del acordado. Config que se puede ignorar no es
política, y sin política no hay presupuesto.

**El run-time es una opción, no un plan.** SyntaX es config-time: escribe archivos y se va.
Observar y cortar en ejecución es otro producto, otro set de competidores y un rewrite. Queda como
hipótesis que se abre si dominamos lo anterior — no como destino escrito, porque escribirlo obliga
a decisiones de arquitectura caras hoy por algo que quizás no se construya nunca.

## El activo que compone

Vale tenerlo claro porque decide dónde van las horas.

Compilando entornos reales a varios runtimes se acumula una **matriz de compatibilidad y un corpus
de fallas**: qué capability funciona en qué runtime y con qué degradación, qué combinaciones
empeoran al agente, cuánto contexto cuesta cada cosa de verdad. Eso no se scrapea y no lo tiene
nadie.

Un directorio no acumula nada de eso. Ese es el argumento completo del reordenamiento: no es que
el directorio sea un mal escalón, es que atrasa el único reloj que corre a favor.

## El riesgo, dicho de frente

**Convergencia.** `AGENTS.md` ya se estandarizó entre vendors. Si el ecosistema converge también
en skills y MCP, la capa de traducción pierde razón de ser. La apuesta es que hooks, permisos y
workflows —donde vive la diferenciación de cada vendor— no van a converger. Por eso el modelo
tiene ocho objetos y no cinco: los cuatro que agregamos son justamente los que nadie quiere
estandarizar.

**Mercado.** El individuo no paga por esto. Quien paga es un equipo que necesita que varias
personas con editores distintos tengan el mismo entorno auditable. Si ese comprador no aparece,
esto es un buen open source con estrellas y sin negocio — un resultado legítimo, pero conviene
elegirlo a propósito y no descubrirlo.
