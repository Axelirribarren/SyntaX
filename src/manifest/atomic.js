// Escritura de varios archivos con interrupción detectable.
//
// QUÉ GARANTIZA, exactamente: cada rename individual es atómico a nivel del
// sistema de archivos, y antes de renombrar nada los contenidos ya están
// escritos y sincronizados a disco.
//
// QUÉ NO GARANTIZA: que los dos renames sean una sola transacción. El proceso
// puede morir entre uno y otro. Prometer "los dos archivos o ninguno" sería
// falso, y una promesa falsa acá es peor que no dar ninguna: alguien confiaría
// en que el par siempre es coherente.
//
// Lo que sí se hace es dejar rastro. Antes de tocar los destinos se escribe un
// journal con la operación y los backups; se borra recién cuando terminó todo.
// Si sobrevive un journal, la escritura se cortó, y los comandos lo informan al
// arrancar en vez de dejar que la inconsistencia se lea como "cambió todo".
//
// Además el lock guarda `manifestDigest`, así que un par que no va junto se
// detecta aunque el journal se haya perdido.

import { closeSync, existsSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from 'node:fs'

import { clearJournal, writeJournal } from './journal.js'

// files: [{ path, content }]. root y command son para el journal.
export function writeAllAtomic(files, { root, command } = {}) {
  const stamp = `${process.pid}-${Date.now()}`
  const staged = []
  const backups = []

  try {
    for (const file of files) {
      const temporary = `${file.path}.pactlock-tmp-${stamp}`
      writeAndSync(temporary, file.content)
      staged.push({ ...file, temporary })
    }

    if (root) {
      writeJournal(root, {
        command,
        files: files.map((file) => file.path),
        temporales: staged.map((file) => file.temporary)
      })
    }

    for (const file of staged) {
      if (existsSync(file.path)) {
        const backup = `${file.path}.pactlock-prev-${stamp}`
        renameSync(file.path, backup)
        backups.push({ path: file.path, backup })
        if (root) {
          writeJournal(root, {
            command,
            files: files.map((entry) => entry.path),
            backups
          })
        }
      }
      renameSync(file.temporary, file.path)
    }

    for (const entry of backups) rmSync(entry.backup, { force: true })
    if (root) clearJournal(root)

    return { ok: true, written: files.map((file) => file.path) }
  } catch (error) {
    // Revertir lo que se pueda: volver a poner lo anterior y limpiar temporales.
    for (const entry of backups) {
      try {
        rmSync(entry.path, { force: true })
        renameSync(entry.backup, entry.path)
      } catch {
        // Si tampoco se puede restaurar, el backup queda en disco con nombre
        // reconocible y el journal dice dónde está. El error original es el que
        // le importa a quien llamó.
      }
    }
    for (const file of staged) rmSync(file.temporary, { force: true })
    if (root) clearJournal(root)

    return { ok: false, reason: error.message }
  }
}

// Escribir y sincronizar antes de renombrar: sin fsync, un corte de energía
// puede dejar el destino renombrado apuntando a contenido que nunca llegó al
// disco. El rename sería atómico y el contenido, basura.
function writeAndSync(path, content) {
  writeFileSync(path, content, 'utf8')

  const fd = openSync(path, 'r+')
  try {
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}
