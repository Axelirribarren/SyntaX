// Journal de escrituras interrumpidas.
//
// `pactlock.yaml` y `pactlock.lock` se escriben juntos, y cada rename es atómico —
// pero los dos juntos NO son una transacción. El proceso puede morir entre uno
// y otro y dejar un manifest nuevo con un lock viejo.
//
// No hace falta una base transaccional. Hace falta que una interrupción sea
// DETECTABLE y RECUPERABLE, en vez de quedar como una inconsistencia silenciosa
// que después se lee como "cambió todo".

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const JOURNAL_FILE = '.pactlock-journal.json'

export function journalPath(root) {
  return join(root, JOURNAL_FILE)
}

export function writeJournal(root, operation) {
  writeFileSync(
    journalPath(root),
    `${JSON.stringify({ startedAt: new Date().toISOString(), ...operation }, null, 2)}\n`,
    'utf8'
  )
}

export function clearJournal(root) {
  rmSync(journalPath(root), { force: true })
}

// Devuelve null si no hay nada pendiente. Si hay journal, la última escritura se
// cortó a la mitad: lo devuelve para que el comando lo informe antes de hacer
// cualquier otra cosa.
export function readJournal(root) {
  const path = journalPath(root)
  if (!existsSync(path)) return null

  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    // Un journal ilegible sigue siendo señal de que algo se cortó. Se reporta
    // igual: perder el detalle es mejor que perder el aviso.
    return { corrupto: true }
  }
}

export function describeJournal(journal) {
  if (!journal) return null
  if (journal.corrupto) {
    return `Hay un ${JOURNAL_FILE} ilegible: una escritura anterior se interrumpió. Revisá los archivos .pactlock-prev-* antes de seguir.`
  }

  const backups = (journal.backups || []).map((entry) => entry.backup)
  return [
    `Una escritura de ${journal.command || 'pactlock'} se interrumpió el ${journal.startedAt}.`,
    backups.length
      ? `El estado anterior quedó en: ${backups.join(', ')}`
      : 'No había estado anterior que preservar.',
    `Revisá que ${(journal.files || []).join(' y ')} sean coherentes y borrá ${JOURNAL_FILE}.`
  ].join('\n  ')
}
