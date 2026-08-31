# SyntaX

SyntaX convierte una idea en un plan de capacidades instalable: skills, MCP servers, plugins y dependencias del proyecto. La interfaz es una PWA en React 18 + Vite 5 y la aplicación local del plan se hace con una CLI auditable.

La portada funciona como un capability studio: muestra direcciones concretas para experiencias 3D, sistemas visuales y perfiles de GitHub, y convierte una descripción libre en un plan revisable. La escena inicial usa React Three Fiber, Drei y Three.js; Motion orquesta las transiciones y respeta `prefers-reduced-motion`.

## Desarrollo

```bash
npm install
npm run dev
npm test
npm run build
```

## Flujo de integración

1. Describí lo que querés construir o elegí un kit.
2. Revisá y ajustá las recomendaciones.
3. Elegí si las skills deben instalarse para Codex, Claude Code o ambos, y descargá `SyntaX plan` como `syntax-plan.json`.
4. Inspeccioná el efecto sobre un proyecto sin modificarlo:

```bash
npm run syntax -- preview ./syntax-plan.json /ruta/al/proyecto
```

5. Cuando el plan sea correcto, aplicalo:

```bash
npm run syntax -- apply ./syntax-plan.json /ruta/al/proyecto
```

La CLI detecta React y el package manager, detiene planes incompatibles, combina `.mcp.json`, instala dependencias y copia skills desde sus repositorios verificados. Los planes nuevos usan `.agents/skills` para Codex y `.claude/skills` para Claude Code; también pueden escribir en ambos destinos. Los planes v1 existentes conservan su comportamiento de Claude Code. Antes de reemplazar un `.mcp.json` o una skill existente crea una copia con el sufijo `.syntax-backup-<fecha>`; los instaladores PowerShell y Bash descargables aplican la misma regla. Los plugins específicos de Claude Code quedan como comandos pendientes.

## Primer dominio: visual / 3D

El recomendador reconoce diseño, animaciones, Three.js/WebGL, GIF/video y rendimiento. El kit inicial combina React Three Fiber, Drei, Motion, criterio de frontend y verificación real con navegador. El mismo modelo de capacidades está pensado para sumar después seguridad, diagnóstico, optimización de contexto/tokens y otros dominios.

## Estructura principal

- `src/data/kits.js`: catálogo curado y metadatos de instalación/compatibilidad.
- `src/data/concepts.js`: vocabulario y pesos del recomendador local.
- `src/lib/recommend.js`: detección de capacidades y ranking.
- `src/lib/install.js`: plan portable y scripts PowerShell/Bash.
- `scripts/syntax.mjs`: preview, inspección y aplicación local del plan.
- `scripts/discover.mjs`: descubrimiento asistido de nuevos candidatos.

SyntaX no manda tokens ni rutas de proyectos a un servidor. El token opcional de GitHub se guarda en el navegador y la integración del proyecto se ejecuta localmente.
