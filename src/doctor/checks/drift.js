import { active, comparableKinds, kindLabel } from '../../targets/contract.js'

// El drift es la falla más silenciosa del ecosistema: dos runtimes en el mismo
// repo, el equipo cree que comparte entorno, y en realidad cada uno corre con
// otra cosa. Nadie lo detecta porque cada runtime solo mira su propia carpeta.
//
// Se compara únicamente la intersección de lo que ambos targets soportan: que
// Codex no tenga hooks no es drift, es una limitación declarada del runtime y le
// corresponde al reporte de pérdida, no a este check.
export default {
  id: 'drift',
  title: 'Drift entre runtimes',

  run({ snapshots, targetsById }) {
    const findings = []
    const present = snapshots.filter((snapshot) => snapshot.present)

    for (let i = 0; i < present.length; i += 1) {
      for (let j = 0; j < present.length; j += 1) {
        if (i === j) continue

        const a = present[i]
        const b = present[j]
        const kinds = comparableKinds(targetsById[a.target], targetsById[b.target])

        for (const kind of kinds) {
          const mine = active(a.objects[kind])

          // Las reglas se identifican por nombre de archivo, y ese nombre es
          // propio de cada runtime: CLAUDE.md y AGENTS.md son la misma regla
          // vestida distinto. Compararlas por id reporta un drift que no
          // existe. Lo que sí importa es la ausencia: un runtime sin archivo de
          // reglas arranca sin ningún contexto del proyecto.
          if (kind === 'rule') {
            if (mine.length && !active(b.objects[kind]).length) {
              findings.push({
                severity: 'alta',
                message: `${b.label} no tiene archivo de reglas`,
                detail: `${a.label} sí lo tiene: quien use ${b.label} arranca sin el contexto del proyecto.`
              })
            }
            continue
          }

          const theirs = new Set(active(b.objects[kind]).map((object) => object.id))
          const missing = mine.filter((object) => !theirs.has(object.id))
          if (!missing.length) continue

          const verb = missing.length === 1 ? 'que no está' : 'que no están'
          findings.push({
            severity: missing.length > 2 ? 'alta' : 'media',
            message: `${missing.length} ${kindLabel(kind, missing.length)} de ${a.label} ${verb} en ${b.label}`,
            items: missing.map((object) => object.id).sort()
          })
        }
      }
    }

    return { findings }
  }
}
