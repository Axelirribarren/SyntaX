// Conteo de tokens detrás de una interfaz.
//
// Hoy es una aproximación por caracteres. Está aislado acá para que cambiarla
// por un tokenizador real (y por el del modelo que corresponda) no toque ningún
// check. Todo lo que sale de este módulo viaja marcado como aproximado y el
// reporte lo imprime con `≈`: el número de costo de contexto es el titular del
// producto, y un titular inflado se lleva puesta la credibilidad del resto.

// ~4 caracteres por token es la regla habitual para prosa en inglés y español.
// Subestima en texto con mucha puntuación, código o JSON — es decir, subestima
// justo en los schemas de MCP. Preferimos quedarnos cortos antes que exagerar.
const CHARS_PER_TOKEN = 4

export const APPROXIMATE = true

export function countTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

export function countTokensFromBytes(bytes) {
  if (!bytes) return 0
  return Math.ceil(bytes / CHARS_PER_TOKEN)
}

export function formatTokens(value) {
  return `≈${value.toLocaleString('es-AR')}`
}
