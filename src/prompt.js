// Confirmación por terminal, sin dependencias.
//
// `accept` es el único punto del sistema donde una persona autoriza algo, así
// que la autorización tiene que venir de una persona de verdad. Sin TTY —en CI,
// en un pipe, en un hook— no hay a quién preguntarle: el comando no modifica
// nada y lo dice.

import { createInterface } from 'node:readline/promises'

export function isInteractive(stream = process.stdin) {
  return Boolean(stream.isTTY && process.stdout.isTTY)
}

export async function confirm(question, { input = process.stdin, output = process.stdout } = {}) {
  const rl = createInterface({ input, output })
  try {
    const answer = await rl.question(`${question} [s/N] `)
    return /^(s|si|sí|y|yes)$/i.test(answer.trim())
  } finally {
    rl.close()
  }
}
