import { cpSync, existsSync, rmSync } from 'node:fs'

const WINDOWS_LOCK_ERRORS = new Set(['EPERM', 'EBUSY', 'ENOTEMPTY'])

export function replaceSkillDirectory(source, destination, stamp, platform = process.platform) {
  let backup = null
  let updatedInPlace = false

  if (existsSync(destination)) {
    backup = `${destination}.pactlock-backup-${stamp}`
    // Copiar primero conserva el estado anterior incluso si Windows mantiene
    // un handle abierto sobre la carpeta e impide renombrarla o borrarla.
    cpSync(destination, backup, { recursive: true, force: true, errorOnExist: true })

    try {
      rmSync(destination, {
        recursive: true,
        force: true,
        maxRetries: platform === 'win32' ? 4 : 0,
        retryDelay: 120
      })
    } catch (error) {
      if (platform !== 'win32' || !WINDOWS_LOCK_ERRORS.has(error.code)) throw error
      updatedInPlace = true
    }
  }

  // Si Windows no pudo quitar la carpeta raíz, la copia se hace encima. El
  // backup completo ya existe, por lo que un error posterior sigue siendo
  // recuperable y una nueva ejecución es segura.
  cpSync(source, destination, { recursive: true, force: true })
  return { backup, updatedInPlace }
}
