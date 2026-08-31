// Vocabulario del recomendador, enfocado en diseño frontend.
//
// La idea: el usuario escribe en su idioma real ("quiero una landing linda que
// se vea bien en el celular") y hay que traducir eso a conceptos que el catálogo
// entienda. No hace falta un LLM para esto — hace falta un diccionario bueno.
//
// Cada concepto lista las formas en que la gente lo nombra, en español y en
// inglés. Los términos de 4+ letras matchean por prefijo, así que "diseno"
// también cubre "diseñar" y "diseñador"; los cortos matchean exactos.
// Los términos con espacio se buscan como frase.

export const VOCABULARY = {
  diseno: [
    'diseno', 'design', 'estetica', 'linda', 'lindo', 'bonita', 'bonito',
    'visual', 'look', 'apariencia', 'ui', 'ux', 'pulida', 'pulido',
    'profesional', 'moderna', 'moderno', 'elegante', 'atractiva', 'atractivo',
    'fea', 'feo', 'generica', 'generico'
  ],
  landing: [
    'landing', 'pagina', 'page', 'sitio', 'site', 'web', 'home', 'portada',
    'onepage', 'portfolio', 'catalogo', 'tienda', 'blog'
  ],
  tema: [
    'tema', 'theme', 'color', 'colores', 'paleta', 'palette', 'marca',
    'branding', 'brand', 'identidad', 'tipografia', 'fuente', 'fuentes',
    'font', 'letra', 'coherente', 'consistente'
  ],
  componentes: [
    'componente', 'component', 'shadcn', 'boton', 'botones', 'formulario',
    'formularios', 'tabla', 'card', 'cards', 'modal', 'navbar'
  ],
  verificar: [
    'probar', 'testear', 'test', 'verificar', 'revisar', 'screenshot',
    'captura', 'debug', 'depurar', 'consola', 'error', 'errores', 'roto',
    'anda', 'funciona', 'bug', 'bugs', 'performance', 'lento'
  ],
  responsive: [
    'responsive', 'mobile', 'movil', 'celular', 'telefono', 'adaptable',
    'pantalla', 'pantallas', 'tablet', 'breakpoint'
  ],
  accesibilidad: [
    'accesible', 'accesibilidad', 'a11y', 'contraste', 'lector', 'wcag',
    'inclusiva', 'inclusivo'
  ],
  animacion: [
    'animacion', 'animaciones', 'animada', 'animado', 'transicion',
    'transiciones', 'motion', 'hover', 'scroll'
  ],
  tres_d: [
    '3d', 'three', 'threejs', 'three.js', 'webgl', 'shader', 'shaders',
    'escena', 'scene', 'modelo 3d', 'modelos 3d', 'inmersiva', 'inmersivo',
    'react three fiber', 'r3f'
  ],
  gif_video: [
    'gif', 'gifs', 'video', 'videos', 'loop', 'cinemagraph', 'preview animada',
    'exportar gif'
  ],
  rendimiento: [
    'rendimiento', 'performance', 'optimizar', 'optimizacion', 'fps',
    'pesado', 'pesada', 'carga', 'memoria', 'bundle'
  ],
  figma: ['figma', 'mockup', 'maqueta', 'prototipo', 'wireframe'],
  grafico: [
    'poster', 'banner', 'imagen', 'imagenes', 'ilustracion', 'arte',
    'grafico', 'flyer', 'og image', 'miniatura', 'logo'
  ],
  docs: [
    'documentacion', 'docs', 'libreria', 'biblioteca', 'version', 'versiones',
    'actualizado', 'desactualizado', 'api de', 'framework'
  ],
  stack: [
    'react', 'jsx', 'vite', 'next', 'nextjs', 'tailwind', 'css', 'html',
    'javascript', 'typescript', 'astro', 'svelte', 'vue'
  ],
  artifact: ['artifact', 'artifacts'],
  crear_skill: ['skill', 'skills', 'plugin', 'plugins', 'mcp', 'propia', 'propio']
}

// Cómo se ve cada concepto en la UI cuando explicamos por qué recomendamos algo.
export const CONCEPT_LABELS = {
  diseno: 'diseño visual',
  landing: 'página web',
  tema: 'colores y tipografía',
  componentes: 'componentes de UI',
  verificar: 'ver si funciona',
  responsive: 'mobile / responsive',
  accesibilidad: 'accesibilidad',
  animacion: 'animaciones',
  tres_d: '3D / WebGL',
  gif_video: 'GIF y video',
  rendimiento: 'rendimiento',
  figma: 'Figma',
  grafico: 'piezas gráficas',
  docs: 'documentación al día',
  stack: 'tu stack',
  artifact: 'artifacts de claude.ai',
  crear_skill: 'crear skills propias'
}

// Qué tan fuerte sirve cada item a cada concepto (1 = tangencial, 3 = es su razón de ser).
// Los ids son los de src/data/kits.js.
export const ITEM_CONCEPTS = {
  'ui-ux-pro-max': { diseno: 3, tema: 3, accesibilidad: 3, componentes: 2, landing: 2, animacion: 2, responsive: 1, stack: 1, grafico: 1 },
  'react-three-stack': { tres_d: 3, animacion: 2, stack: 2, rendimiento: 1, landing: 1 },
  'motion-package': { animacion: 3, landing: 1, stack: 2, diseno: 1 },
  'gifenc-package': { gif_video: 3, animacion: 1, grafico: 1 },
  'ui-ux-pro-max-plugin': {}, // alternativa de instalación, no se recomienda por búsqueda
  'frontend-design': { diseno: 3, landing: 2, tema: 1, componentes: 1, stack: 1 },
  'theme-factory': { tema: 3, diseno: 2, landing: 1, accesibilidad: 1 },
  'webapp-testing': { verificar: 3, responsive: 2, stack: 1, accesibilidad: 1, tres_d: 1 },
  'chrome-devtools-mcp': { verificar: 3, responsive: 2, rendimiento: 3, diseno: 1, animacion: 1, tres_d: 2, stack: 1 },
  'context7-mcp': { docs: 3, stack: 2, componentes: 1 },
  // Estos dos se pisan con ui-ux-pro-max, que cubre el mismo terreno con más
  // datos. Todo en peso 1 a propósito: siguen apareciendo como alternativa,
  // pero nunca vienen pre-tildados. Si el "why" dice "solo si...", el item no
  // puede ser fuerte — si no, la app contradice a su propio catálogo.
  'design-audit': { diseno: 1, accesibilidad: 1, tema: 1, verificar: 1 },
  'a11y-audit': { accesibilidad: 1, tema: 1 },
  'canvas-design': { grafico: 3, diseno: 1 },
  'web-artifacts-builder': { artifact: 3, componentes: 2, stack: 1 },
  'playwright-mcp': { verificar: 2, responsive: 1 },
  'figma-mcp': { figma: 3, diseno: 1, componentes: 1 },
  'brand-guidelines': { tema: 1, diseno: 1 }, // aplica la marca de Anthropic: nunca por defecto
  'skill-creator': { crear_skill: 3 },
  'mcp-builder': { crear_skill: 2 },
  // El pack completo es una alternativa de instalación, no algo que recomendar
  // por búsqueda: se pisaría con las skills sueltas.
  'example-skills-plugin': {}
}

// Cuando no se entiende nada de lo que escribió el usuario, esto es lo que
// mostramos: el núcleo de diseño frontend.
export const FALLBACK_IDS = ['frontend-design', 'theme-factory', 'chrome-devtools-mcp']
