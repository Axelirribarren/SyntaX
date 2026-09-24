import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { BACKUP_SUFFIXES, isBackupName } from '../../targets/shared.js'

// Restos que quedaron en el repo y que nadie va a limpiar solo.
//
// Los backups son el caso central y es una autocrítica: la CLI vieja hacía
// backup antes de pisar una skill, lo cual está bien, pero nunca ofreció
// listarlos ni revertirlos. Un backup que no se puede revertir no es seguridad,
// es basura acumulándose en el repo de otra persona — y encima se commitea si
// nadie se acordó de agregarlo al .gitignore.
export default {
  id: 'orphans',
  title: 'Restos y referencias rotas',

  run({ root, snapshots, gitignore }) {
    const findings = []

    const backups = snapshots.flatMap((snapshot) => snapshot.backups || [])
    const rootBackups = listRootBackups(root)
    const total = backups.length + rootBackups.length

    if (total) {
      const ignored = backupKinds(backups, rootBackups).every((kind) => gitignore.includes(kind))
      findings.push({
        severity: total > 5 ? 'alta' : 'media',
        message: `${total} backups huérfanos de pactlock o de SyntaX, su nombre anterior`,
        detail: ignored
          ? 'No hay comando que los liste ni los revierta.'
          : 'No hay comando que los revierta y .gitignore no los excluye: se commitean.',
        items: [...backups.map((entry) => entry.relativePath), ...rootBackups].sort()
      })
    }

    const broken = snapshots.flatMap((snapshot) =>
      (snapshot.objects.skill || [])
        .filter((skill) => !skill.hasSkillFile)
        .map((skill) => skill.relativePath)
    )

    if (broken.length) {
      findings.push({
        severity: 'alta',
        message: `${broken.length} carpetas de skill sin SKILL.md`,
        detail: 'El runtime las ignora en silencio: ocupan lugar en el repo y no aportan nada.',
        items: broken.sort()
      })
    }

    const missingEnv = snapshots.flatMap((snapshot) =>
      (snapshot.objects.mcp || [])
        .filter((server) => (server.emptyEnv || []).length)
        .map((server) => `${server.id}: ${server.emptyEnv.join(', ')}`)
    )

    if (missingEnv.length) {
      findings.push({
        severity: 'alta',
        message: `${missingEnv.length} MCP servers sin credenciales`,
        detail: 'Con la variable vacía el server no arranca. Es la causa más común de instalación fallida.',
        items: missingEnv.sort()
      })
    }

    return { findings }
  }
}

// Qué familias de backup aparecieron, como patrón de .gitignore sin los puntos.
// Un repo puede ignorar los de SyntaX y no los de pactlock: cada familia se
// comprueba por separado.
function backupKinds(backups, rootBackups) {
  const names = [...backups.map((entry) => entry.id), ...rootBackups]
  return BACKUP_SUFFIXES
    .filter((suffix) => names.some((name) => name.includes(suffix)))
    .map((suffix) => suffix.replace(/^\.|-$/g, ''))
}

function listRootBackups(root) {
  if (!existsSync(root)) return []
  try {
    return readdirSync(root)
      .filter(isBackupName)
  } catch {
    return []
  }
}
