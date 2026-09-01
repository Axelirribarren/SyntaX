// La capa de observación: qué skills hay realmente en disco, y en qué estado.
//
// La comparten `import` y `verify` a propósito. Si cada uno mirara el disco a
// su manera, `import` podría escribir un contrato que `verify` no sabe leer —
// y el primer `verify` fallaría sin que nadie haya tocado nada.
//
// Observa. No decide nada: no deduplica, no elige entre variantes, no infiere
// qué quiso el equipo. Eso lo hacen los comandos, y solo cuando alguien se lo
// pidió.

import { active } from './targets/contract.js'
import { detectTargets, readAll } from './targets/index.js'
import { computeSkillDigest } from './manifest/digest.js'

export function observeSkills(root) {
  const targets = detectTargets(root)
  const snapshots = readAll(root, targets)
  const problems = []
  const skills = []

  for (const snapshot of snapshots) {
    if (!snapshot.present) continue

    for (const skill of snapshot.objects.skill || []) {
      if (skill.symlink) {
        problems.push({
          kind: 'skill-es-symlink',
          id: skill.id,
          target: snapshot.target,
          detail: `${skill.relativePath} es un symlink: apunta fuera del proyecto y no se puede versionar.`
        })
        continue
      }

      if (skill.valid === false) {
        problems.push({
          kind: 'sin-skill-md',
          id: skill.id,
          target: snapshot.target,
          detail: `${skill.relativePath} no tiene SKILL.md: el runtime la ignora.`
        })
        continue
      }

      // La identidad es el nombre del directorio: es lo que el runtime carga.
      // El `name` del frontmatter es metadata que puede no coincidir, y ese
      // desacuerdo es un hallazgo — no algo que se resuelva eligiendo uno.
      if (skill.name && skill.name !== skill.id) {
        problems.push({
          kind: 'nombre-discordante',
          id: skill.id,
          target: snapshot.target,
          detail: `la carpeta se llama '${skill.id}' y el frontmatter dice '${skill.name}'.`
        })
      }

      const digest = computeSkillDigest(skill.path)
      if (!digest.ok) {
        problems.push({
          kind: 'digest-no-calculable',
          id: skill.id,
          target: snapshot.target,
          detail: digest.reason
        })
        continue
      }

      skills.push({
        id: skill.id,
        target: snapshot.target,
        label: snapshot.label,
        path: skill.relativePath,
        files: digest.files,
        digest: digest.digest,
        inventory: digest.inventory
      })
    }
  }

  return {
    targets: targets.map((target) => ({ id: target.id, label: target.label })),
    skills,
    problems
  }
}

// Mismo id, contenido distinto entre targets. Sin esto, dos copias divergentes
// coinciden cada una con su propia entrada del lock y pasan por válidas, aunque
// los dos runtimes se comporten distinto.
export function findDiverged(skills) {
  const porId = new Map()
  for (const skill of skills) {
    if (!porId.has(skill.id)) porId.set(skill.id, [])
    porId.get(skill.id).push(skill)
  }

  const diverged = []
  for (const [id, copias] of porId) {
    if (copias.length < 2) continue
    const digests = new Set(copias.map((copia) => copia.digest))
    if (digests.size === 1) continue

    diverged.push({
      id,
      copias: copias.map((copia) => ({ target: copia.target, digest: copia.digest }))
    })
  }

  return diverged
}

export function groupById(skills) {
  const porId = new Map()
  for (const skill of skills) {
    if (!porId.has(skill.id)) porId.set(skill.id, new Set())
    porId.get(skill.id).add(skill.target)
  }
  return porId
}
