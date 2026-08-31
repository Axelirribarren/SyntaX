// Escritura atómica de varios archivos, todo o nada.
//
// `import` escribe syntax.yaml y syntax.lock juntos. Si el segundo falla y el
// primero ya está en disco, el proyecto queda con un contrato sin su línea base
// de integridad: `verify` no podría distinguir "nadie tocó nada" de "no sé qué
// había antes". Es peor que no haber escrito nada.

import { existsSync, renameSync, rmSync, writeFileSync } from 'node:fs'

// files: [{ path, content }]. Escribe cada uno en un temporal al lado del
// destino (mismo volumen, para que el rename sea atómico) y recién después
// mueve todos. Si algo falla, se limpia y se restaura lo que había.
export function writeAllAtomic(files) {
  const stamp = `${process.pid}-${Date.now()}`
  const staged = []
  const backups = []

  try {
    for (const file of files) {
      const temporary = `${file.path}.syntax-tmp-${stamp}`
      writeFileSync(temporary, file.content, 'utf8')
      staged.push({ ...file, temporary })
    }

    for (const file of staged) {
      if (existsSync(file.path)) {
        const backup = `${file.path}.syntax-prev-${stamp}`
        renameSync(file.path, backup)
        backups.push({ path: file.path, backup })
      }
      renameSync(file.temporary, file.path)
    }

    for (const entry of backups) rmSync(entry.backup, { force: true })
    return { ok: true, written: files.map((file) => file.path) }
  } catch (error) {
    // Revertir: volver a poner lo anterior y borrar lo que quedó a medias.
    for (const entry of backups) {
      try {
        rmSync(entry.path, { force: true })
        renameSync(entry.backup, entry.path)
      } catch {
        // Si tampoco se puede restaurar, el error original es el que importa;
        // el backup queda en disco con nombre reconocible.
      }
    }
    for (const file of staged) rmSync(file.temporary, { force: true })

    return { ok: false, reason: error.message }
  }
}
