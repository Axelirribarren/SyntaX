import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { runImport } from '../src/import.js'
import { runVerify, EXIT } from '../src/verify.js'
import { runAccept, planAccept } from '../src/accept.js'
import { proyecto, skill } from '../fixtures/proyecto.mjs'

function importado(skills) {
  const root = proyecto(skills)
  runImport(root)
  return root
}

function manifiesto(root) {
  return readFileSync(join(root, 'syntax.yaml'), 'utf8')
}

function tocar(root, ruta, contenido) {
  writeFileSync(join(root, ruta, 'SKILL.md'), contenido)
}

function agregarSkill(root, ruta, nombre) {
  mkdirSync(join(root, ruta), { recursive: true })
  writeFileSync(join(root, ruta, 'SKILL.md'), skill(nombre))
}

// --- La razón de ser del comando -------------------------------------------

test('el why y los comentarios sobreviven a accept', async () => {
  // Es lo que justifica que accept exista en vez de un `import --force`: ese
  // regenera el archivo entero y se lleva puesto todo lo que escribió una
  // persona. Si esto fallara, el comando no tendría sentido.
  const root = importado({ '.claude/skills/una': skill('una') })

  writeFileSync(
    join(root, 'syntax.yaml'),
    manifiesto(root)
      .replace('    id: una', '    id: una\n    why: la usamos en todas las revisiones de UI')
      .concat('\n# comentario al final que tiene que seguir acá\n')
  )

  tocar(root, '.claude/skills/una', `${skill('una')}\ncontenido nuevo\n`)
  await runAccept(root, { id: 'una', interactive: false })

  const despues = manifiesto(root)
  assert.match(despues, /why: la usamos en todas las revisiones de UI/)
  assert.match(despues, /# comentario al final que tiene que seguir acá/)
  assert.match(despues, /# syntax\.yaml — el contrato/, 'el encabezado también')
  assert.equal(runVerify(root).exit, EXIT.LIMPIO)
})

// --- Nada se acepta solo ----------------------------------------------------

test('sin TTY y sin flags no modifica nada', async () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  tocar(root, '.claude/skills/una', `${skill('una')}\ncambio\n`)
  const antes = manifiesto(root)

  const resultado = await runAccept(root, { interactive: false })

  assert.equal(resultado.ok, false)
  assert.match(resultado.reason, /autorización es de una persona/)
  assert.equal(manifiesto(root), antes)
  assert.equal(runVerify(root).exit, EXIT.DIFERENCIAS, 'sigue reportando el drift')
})

test('no hay un --all genérico: modified y unexpected van por separado', async () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  tocar(root, '.claude/skills/una', `${skill('una')}\ncambio\n`)
  agregarSkill(root, '.claude/skills/nueva', 'nueva')

  await runAccept(root, { allModified: true, interactive: false })

  // La modificada se aceptó; la nueva capacidad ejecutable no.
  const resultado = runVerify(root)
  assert.deepEqual(resultado.modified, [])
  assert.deepEqual(resultado.unexpected, [{ id: 'nueva', target: 'claude-code' }])
})

// --- La acción se nombra, no se infiere -------------------------------------

test('accept <id> sobre una skill borrada NO la saca del manifest', async () => {
  // Si la acción dependiera del estado, el mismo comando borraría una
  // declaración en una máquina y actualizaría un digest en otra.
  const root = importado({
    '.claude/skills/una': skill('una'),
    '.claude/skills/otra': skill('otra')
  })
  rmSync(join(root, '.claude/skills/otra'), { recursive: true, force: true })

  const resultado = await runAccept(root, { id: 'otra', interactive: false })

  assert.equal(resultado.ok, false)
  assert.match(resultado.reason, /--remove --target/)
  assert.match(manifiesto(root), /id: otra/)
})

test('--remove exige --target', async () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  const resultado = await runAccept(root, { id: 'una', remove: true, interactive: false })

  assert.equal(resultado.ok, false)
  assert.match(resultado.reason, /--target/)
})

test('--remove saca la declaración y su entrada del lock', async () => {
  const root = importado({
    '.claude/skills/una': skill('una'),
    '.claude/skills/otra': skill('otra')
  })
  rmSync(join(root, '.claude/skills/otra'), { recursive: true, force: true })

  await runAccept(root, { id: 'otra', remove: true, target: 'claude-code', interactive: false })

  assert.doesNotMatch(manifiesto(root), /id: otra/)
  const lock = JSON.parse(readFileSync(join(root, 'syntax.lock'), 'utf8'))
  assert.equal(lock.skills.find((entry) => entry.id === 'otra'), undefined)
  assert.equal(runVerify(root).exit, EXIT.LIMPIO)
})

test('--adopt incorpora solo el target observado', async () => {
  const root = importado({
    '.claude/skills/una': skill('una'),
    '.agents/skills/una': skill('una')
  })
  agregarSkill(root, '.claude/skills/nueva', 'nueva')

  await runAccept(root, { id: 'nueva', adopt: true, interactive: false })

  const doc = manifiesto(root)
  const bloque = doc.slice(doc.indexOf('id: nueva'))
  assert.match(bloque, /claude-code/)
  assert.doesNotMatch(bloque.slice(0, bloque.indexOf('- kind') + 1 || 200), /codex/)
  assert.equal(runVerify(root).exit, EXIT.LIMPIO)
})

// --- Autorización informada -------------------------------------------------

test('accept dice qué archivos cambiaron, no solo un hash nuevo', () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  writeFileSync(join(root, '.claude/skills/una/nuevo.md'), '# agregado\n')
  tocar(root, '.claude/skills/una', `${skill('una')}\nmodificado\n`)

  const plan = planAccept(root, { id: 'una' })
  const accion = plan.acciones[0]

  assert.deepEqual(accion.cambios.agregados, ['nuevo.md'])
  assert.deepEqual(accion.cambios.modificados, ['SKILL.md'])
  assert.equal(accion.archivosPrevios, 1)
  assert.equal(accion.archivosNuevos, 2)
})

// --- Divergencia ------------------------------------------------------------

test('--allow-divergence exige un motivo', async () => {
  const root = importado({
    '.claude/skills/compartida': skill('compartida'),
    '.agents/skills/compartida': skill('compartida')
  })
  tocar(root, '.agents/skills/compartida', `${skill('compartida')}\nvariante\n`)

  const resultado = await runAccept(root, {
    id: 'compartida',
    allowDivergence: true,
    interactive: false
  })

  assert.equal(resultado.ok, false)
  assert.match(resultado.reason, /--why/)
})

test('autorizar divergencia no autoriza mutación posterior', async () => {
  const root = importado({
    '.claude/skills/compartida': skill('compartida'),
    '.agents/skills/compartida': skill('compartida')
  })
  tocar(root, '.agents/skills/compartida', `${skill('compartida')}\nvariante\n`)

  await runAccept(root, {
    id: 'compartida',
    allowDivergence: true,
    why: 'Codex necesita instrucciones distintas por su sandbox.',
    interactive: false
  })
  // La divergencia deja de reportarse, pero la copia de Codex sigue sin
  // coincidir con su digest: se acepta que sean distintas, no que muten.
  const conDivergenciaAceptada = runVerify(root)
  assert.deepEqual(conDivergenciaAceptada.diverged, [])
  assert.equal(conDivergenciaAceptada.modified.length, 1)

  await runAccept(root, { allModified: true, interactive: false })
  assert.equal(runVerify(root).exit, EXIT.LIMPIO)

  // Y a partir de acá, un cambio nuevo en cualquiera de las dos vuelve a salir.
  tocar(root, '.agents/skills/compartida', `${skill('compartida')}\notra cosa\n`)
  assert.equal(runVerify(root).exit, EXIT.DIFERENCIAS)
})

test('--dry-run no escribe', async () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  tocar(root, '.claude/skills/una', `${skill('una')}\ncambio\n`)
  const antes = manifiesto(root)

  const resultado = await runAccept(root, { id: 'una', dryRun: true, interactive: false })

  assert.equal(resultado.ok, true)
  assert.equal(resultado.dryRun, true)
  assert.equal(manifiesto(root), antes)
  assert.equal(runVerify(root).exit, EXIT.DIFERENCIAS)
})

test('accept deja el par manifest/lock coherente', async () => {
  const root = importado({ '.claude/skills/una': skill('una') })
  agregarSkill(root, '.claude/skills/nueva', 'nueva')

  await runAccept(root, { allUnexpected: true, interactive: false })

  // Si accept no recalculara manifestDigest sobre el documento ya editado, su
  // propia escritura dejaría el par marcado como inconsistente.
  assert.equal(runVerify(root).exit, EXIT.LIMPIO)
})
