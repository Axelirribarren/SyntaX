// Kits curados a mano. A diferencia de la búsqueda, acá nada sale de un ranking:
// cada item está elegido para un objetivo concreto y sus datos de instalación
// están verificados (el repo existe, el paquete npm resuelve, la ruta de la skill
// es real). Si un item no se puede instalar de forma determinista, no entra.
//
// Tipos de item:
//   skill  -> se copia una carpeta del repo a .claude/skills/<target>
//   mcp    -> se agrega una entrada a .mcp.json de la raíz del proyecto
//   plugin -> no es shell: son slash commands para pegar en Claude Code
//   package -> se instala una dependencia npm en el proyecto elegido

export const KITS = [
  {
    id: 'visual-3d',
    name: 'Visual / 3D / Motion',
    tagline: 'Experiencias inmersivas sin perder accesibilidad ni rendimiento',
    description:
      'Para landings con escenas 3D, scroll narrativo, microinteracciones y assets animados. ' +
      'El núcleo está pensado para React; SyntaX marca las dependencias del stack y deja las herramientas opcionales sin seleccionar.',
    items: [
      {
        id: 'react-three-stack',
        type: 'package',
        name: 'React Three Fiber + Drei',
        why: 'Integra Three.js con componentes React y suma helpers para cámaras, controles, loaders, entornos y texto 3D.',
        repo: 'pmndrs/react-three-fiber',
        packages: ['three', '@react-three/fiber', '@react-three/drei'],
        frameworks: ['react'],
        license: 'MIT',
        recommended: true
      },
      {
        id: 'motion-package',
        type: 'package',
        name: 'Motion',
        why: 'Microinteracciones, transiciones de layout y animaciones ligadas al scroll con una API natural para React.',
        repo: 'motiondivision/motion',
        packages: ['motion'],
        frameworks: ['react'],
        license: 'MIT',
        recommended: true
      },
      {
        id: 'frontend-design',
        type: 'skill',
        name: 'frontend-design',
        why: 'Da dirección visual y jerarquía. Evita que el 3D sea un efecto aislado sin una interfaz coherente alrededor.',
        repo: 'anthropics/skills',
        path: 'skills/frontend-design',
        target: 'frontend-design',
        license: 'Apache-2.0',
        recommended: true
      },
      {
        id: 'webapp-testing',
        type: 'skill',
        name: 'webapp-testing',
        why: 'Prueba la experiencia real, captura pantallas y detecta errores de interacción o layout.',
        repo: 'anthropics/skills',
        path: 'skills/webapp-testing',
        target: 'webapp-testing',
        license: 'Apache-2.0',
        recommended: true
      },
      {
        id: 'chrome-devtools-mcp',
        type: 'mcp',
        name: 'Chrome DevTools MCP',
        why: 'Permite inspeccionar WebGL, consola, red, memoria y rendimiento en un navegador real.',
        repo: 'ChromeDevTools/chrome-devtools-mcp',
        license: 'Apache-2.0',
        server: { key: 'chrome-devtools', command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] },
        recommended: true
      },
      {
        id: 'canvas-design',
        type: 'skill',
        name: 'canvas-design',
        why: 'Genera piezas gráficas y assets estáticos para acompañar la experiencia visual.',
        repo: 'anthropics/skills',
        path: 'skills/canvas-design',
        target: 'canvas-design',
        license: 'Apache-2.0',
        recommended: false
      },
      {
        id: 'gifenc-package',
        type: 'package',
        name: 'gifenc',
        why: 'Codificador GIF pequeño y rápido para generar previews animadas desde JavaScript. Solo hace falta si el producto realmente exporta GIF.',
        repo: 'mattdesl/gifenc',
        packages: ['gifenc'],
        license: 'MIT',
        recommended: false
      }
    ]
  },
  {
    id: 'web-design',
    name: 'Landing / UI linda',
    tagline: 'Que la página se vea bien y que Claude pueda mirarla mientras la hace',
    description:
      'El combo mínimo para diseño visual: criterio estético para no caer en el look "template de Bootstrap", ' +
      'temas coherentes, y un navegador de verdad para que Claude vea lo que rompió en vez de adivinar.',
    items: [
      {
        id: 'ui-ux-pro-max',
        type: 'skill',
        name: 'ui-ux-pro-max',
        why: 'Base de datos de diseño consultable desde el editor: 79 estilos, 192 paletas con su razonamiento, 74 pares tipográficos, 119 guías de UX, 25 tipos de gráfico y 22 stacks. Trae sus propios scripts de búsqueda, así que no inventa: consulta.',
        repo: 'nextlevelbuilder/ui-ux-pro-max-skill',
        path: '.claude/skills/ui-ux-pro-max',
        target: 'ui-ux-pro-max',
        license: 'MIT',
        recommended: true
      },
      {
        id: 'frontend-design',
        type: 'skill',
        name: 'frontend-design',
        why: 'Criterio de diseño: tipografía, jerarquía, dirección estética. Evita que todo salga con el mismo aire genérico. Se lleva bien con ui-ux-pro-max: este pone el criterio, aquel los datos.',
        repo: 'anthropics/skills',
        path: 'skills/frontend-design',
        target: 'frontend-design',
        license: 'Apache-2.0',
        recommended: true
      },
      {
        id: 'theme-factory',
        type: 'skill',
        name: 'theme-factory',
        why: '10 temas prearmados de colores y fuentes, o genera uno nuevo. Sirve para que toda la app tenga una identidad, no 8 azules distintos.',
        repo: 'anthropics/skills',
        path: 'skills/theme-factory',
        target: 'theme-factory',
        license: 'Apache-2.0',
        recommended: true
      },
      {
        id: 'webapp-testing',
        type: 'skill',
        name: 'webapp-testing',
        why: 'Maneja tu app local con Playwright: screenshots, clicks, logs del navegador. Es el "andá y fijate si funciona" automatizado.',
        repo: 'anthropics/skills',
        path: 'skills/webapp-testing',
        target: 'webapp-testing',
        license: 'Apache-2.0',
        recommended: true
      },
      {
        id: 'chrome-devtools-mcp',
        type: 'mcp',
        name: 'Chrome DevTools MCP',
        why: 'Claude abre tu página en un Chrome real: ve el DOM renderizado, la consola, la red y el performance. Sin esto, el diseño se hace a ciegas.',
        repo: 'ChromeDevTools/chrome-devtools-mcp',
        license: 'Apache-2.0',
        server: { key: 'chrome-devtools', command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] },
        recommended: true
      },
      {
        id: 'context7-mcp',
        type: 'mcp',
        name: 'Context7',
        why: 'Documentación al día de React, Tailwind, Vite y demás, inyectada en contexto. Corta las respuestas basadas en versiones viejas.',
        repo: 'upstash/context7',
        license: 'MIT',
        server: { key: 'context7', command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
        recommended: true
      },
      {
        id: 'design-audit',
        type: 'skill',
        name: 'design-audit',
        why: 'Audita tu UI contra 24 leyes de UX con citas a la fuente primaria y devuelve un puntaje por dimensión. Alternativa liviana (cero dependencias) si ui-ux-pro-max te resulta demasiado: se pisan bastante, no instales los dos.',
        repo: 'Aboudjem/ui-ux-suite',
        path: 'skills/design-audit',
        target: 'design-audit',
        license: 'MIT',
        recommended: false
      },
      {
        id: 'a11y-audit',
        type: 'skill',
        name: 'a11y-audit',
        why: 'Accesibilidad enfocada: criterios WCAG y contraste APCA. ui-ux-pro-max ya cubre accesibilidad como prioridad 1; sumá este solo si querés una auditoría dedicada.',
        repo: 'Aboudjem/ui-ux-suite',
        path: 'skills/a11y-audit',
        target: 'a11y-audit',
        license: 'MIT',
        recommended: false
      },
      {
        id: 'canvas-design',
        type: 'skill',
        name: 'canvas-design',
        why: 'Piezas gráficas estáticas en PNG/PDF (posters, portadas, OG images). Útil para los assets de la landing, no para la UI en sí.',
        repo: 'anthropics/skills',
        path: 'skills/canvas-design',
        target: 'canvas-design',
        license: 'Apache-2.0',
        recommended: false
      },
      {
        id: 'web-artifacts-builder',
        type: 'skill',
        name: 'web-artifacts-builder',
        why: 'Para artifacts complejos de claude.ai con React + Tailwind + shadcn/ui. Sumalo solo si trabajás con artifacts; para tu propia app no aporta.',
        repo: 'anthropics/skills',
        path: 'skills/web-artifacts-builder',
        target: 'web-artifacts-builder',
        license: 'Apache-2.0',
        recommended: false
      },
      {
        id: 'playwright-mcp',
        type: 'mcp',
        name: 'Playwright MCP',
        why: 'Automatización de navegador más completa que DevTools MCP. Se pisa bastante con webapp-testing: elegí uno de los dos.',
        repo: 'microsoft/playwright-mcp',
        license: 'Apache-2.0',
        server: { key: 'playwright', command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
        recommended: false
      },
      {
        id: 'figma-mcp',
        type: 'mcp',
        name: 'Figma Context MCP',
        why: 'Le pasa a Claude el layout de un archivo de Figma para que lo traduzca a código. Solo si diseñás en Figma.',
        repo: 'GLips/Figma-Context-MCP',
        license: 'MIT',
        server: {
          key: 'figma',
          command: 'npx',
          args: ['-y', 'figma-developer-mcp', '--stdio'],
          env: { FIGMA_API_KEY: '' }
        },
        needsSecret: 'FIGMA_API_KEY',
        recommended: false
      },
      {
        id: 'brand-guidelines',
        type: 'skill',
        name: 'brand-guidelines',
        why: 'Aplica los colores y tipografías de la marca Anthropic. Solo tiene sentido si querés ese look puntual; para tu marca propia, usá theme-factory.',
        repo: 'anthropics/skills',
        path: 'skills/brand-guidelines',
        target: 'brand-guidelines',
        license: 'Apache-2.0',
        recommended: false
      },
      {
        id: 'ui-ux-pro-max-plugin',
        type: 'plugin',
        name: 'ui-ux-pro-max (pack completo)',
        why: 'Instala ui-ux-pro-max como plugin, con sus otras 6 skills (banner-design, brand, design-system, design, slides, ui-styling) y actualizaciones automáticas. Alternativa a copiar la skill suelta: no uses las dos.',
        repo: 'nextlevelbuilder/ui-ux-pro-max-skill',
        marketplace: 'nextlevelbuilder/ui-ux-pro-max-skill',
        marketplaceName: 'ui-ux-pro-max-skill',
        plugin: 'ui-ux-pro-max',
        license: 'MIT',
        recommended: false
      },
      {
        id: 'example-skills-plugin',
        type: 'plugin',
        name: 'example-skills (pack completo)',
        why: 'Alternativa "todo junto": instala las 12 skills de ejemplo como plugin, sin copiarlas a tu repo. Si ya marcaste skills sueltas arriba, no lo uses: quedan duplicadas.',
        repo: 'anthropics/skills',
        marketplace: 'anthropics/skills',
        marketplaceName: 'anthropic-agent-skills',
        plugin: 'example-skills',
        license: 'Apache-2.0',
        recommended: false
      }
    ]
  },
  {
    id: 'syntax-app',
    name: 'Este proyecto (React + Vite + PWA)',
    tagline: 'Lo que le sirve a SyntaX tal como está hoy',
    description:
      'Mismo núcleo visual, más lo específico de una SPA que consume APIs y corre como PWA: ' +
      'verificación en navegador, docs actualizadas de las libs que ya usás, y herramientas para seguir construyendo el buscador.',
    items: [
      {
        id: 'chrome-devtools-mcp',
        type: 'mcp',
        name: 'Chrome DevTools MCP',
        why: 'Indispensable acá: te deja ver los 403 de rate limit de la API de GitHub y el estado del service worker de la PWA sin salir de Claude.',
        repo: 'ChromeDevTools/chrome-devtools-mcp',
        license: 'Apache-2.0',
        server: { key: 'chrome-devtools', command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] },
        recommended: true
      },
      {
        id: 'context7-mcp',
        type: 'mcp',
        name: 'Context7',
        why: 'Docs al día de React 18, Vite 5, vite-plugin-pwa e idb, que son exactamente tus dependencias.',
        repo: 'upstash/context7',
        license: 'MIT',
        server: { key: 'context7', command: 'npx', args: ['-y', '@upstash/context7-mcp@latest'] },
        recommended: true
      },
      {
        id: 'webapp-testing',
        type: 'skill',
        name: 'webapp-testing',
        why: 'Verifica que las búsquedas, los favoritos en IndexedDB y el modo offline funcionen de verdad en el navegador.',
        repo: 'anthropics/skills',
        path: 'skills/webapp-testing',
        target: 'webapp-testing',
        license: 'Apache-2.0',
        recommended: true
      },
      {
        id: 'frontend-design',
        type: 'skill',
        name: 'frontend-design',
        why: 'La UI actual es funcional pero genérica. Esta skill es la que empuja las decisiones visuales hacia algo con carácter.',
        repo: 'anthropics/skills',
        path: 'skills/frontend-design',
        target: 'frontend-design',
        license: 'Apache-2.0',
        recommended: true
      },
      {
        id: 'skill-creator',
        type: 'skill',
        name: 'skill-creator',
        why: 'Para escribir tus propias skills. Va de la mano con lo que hace SyntaX: si curás kits, en algún momento vas a querer publicar los tuyos.',
        repo: 'anthropics/skills',
        path: 'skills/skill-creator',
        target: 'skill-creator',
        license: 'Apache-2.0',
        recommended: false
      },
      {
        id: 'mcp-builder',
        type: 'skill',
        name: 'mcp-builder',
        why: 'Guía para construir servers MCP propios. Relevante si algún día querés que SyntaX exponga sus kits como MCP.',
        repo: 'anthropics/skills',
        path: 'skills/mcp-builder',
        target: 'mcp-builder',
        license: 'Apache-2.0',
        recommended: false
      }
    ]
  }
]

export function getKit(id) {
  return KITS.find((k) => k.id === id) || null
}
