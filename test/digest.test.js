import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { ALGORITHM, computeSkillDigest, isTextFile } from '../src/manifest/digest.js'

function skillDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'pactlock-digest-'))
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  return dir
}

const LF = Buffer.from('---\nname: x\n---\n')
const CRLF = Buffer.from('---\r\nname: x\r\n---\r\n')
const BOM = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), LF])

// Vectores publicados en docs/digest.md. Si estos valores cambian, la spec
// quedó mintiendo: hay que actualizarla y bumpear el nombre del algoritmo.
const VECTORES = {
  vacio: 'sha256:67c3e61ebf8d6002aeb6c3ec473adf5ea53f7925b5e72db084bbebb8d629d770',
  skillMd: 'sha256:450ee1f56f881093169ea6423b89e24927030abe11908d9402afad8d7421d27a',
  dosArchivos: 'sha256:09720484ed7f9c462274f384e547edc095823bbb3f77268fc360d8d407b2da0c',
  binarioCrlf: 'sha256:9ce8692d820b024f3d7bced8fd738c4b8b0386d332508c6e19a0c5777d8d2536',
  binarioLf: 'sha256:f40d1847c50417a67b01da7bae747e63730948666e9902cbcba0ec65399a4e82'
}

test('los vectores publicados en docs/digest.md dan lo que dice la spec', () => {
  assert.equal(computeSkillDigest(skillDir({})).digest, VECTORES.vacio)
  assert.equal(computeSkillDigest(skillDir({ 'SKILL.md': LF })).digest, VECTORES.skillMd)
  assert.equal(
    computeSkillDigest(skillDir({ 'SKILL.md': Buffer.from('a\n'), 'ref/b.md': Buffer.from('b\n') })).digest,
    VECTORES.dosArchivos
  )
})

test('CRLF y LF dan el mismo digest', () => {
  // La prueba que decide si `verify` sirve en un equipo mixto: git convierte
  // finales de línea al hacer checkout en Windows.
  assert.equal(
    computeSkillDigest(skillDir({ 'SKILL.md': CRLF })).digest,
    computeSkillDigest(skillDir({ 'SKILL.md': LF })).digest
  )
})

test('el BOM UTF-8 no cambia el digest', () => {
  assert.equal(computeSkillDigest(skillDir({ 'SKILL.md': BOM })).digest, VECTORES.skillMd)
})

test('un binario con CRLF no se normaliza', () => {
  // El caso que justifica la allowlist. Un heurístico de NUL en los primeros
  // KB trataría este archivo como texto —no tiene NUL— y colapsaría los dos
  // digests, ocultando una diferencia real.
  const conCrlf = computeSkillDigest(skillDir({ 'a.bin': Buffer.from([0x01, 0x0d, 0x0a, 0x02]) }))
  const conLf = computeSkillDigest(skillDir({ 'a.bin': Buffer.from([0x01, 0x0a, 0x02]) }))

  assert.equal(conCrlf.digest, VECTORES.binarioCrlf)
  assert.equal(conLf.digest, VECTORES.binarioLf)
  assert.notEqual(conCrlf.digest, conLf.digest)
})

test('la clasificación es por allowlist y lo desconocido es binario', () => {
  assert.equal(isTextFile('SKILL.md'), true)
  assert.equal(isTextFile('ref/datos.json'), true)
  assert.equal(isTextFile('fuentes/Arsenal.ttf'), false)
  assert.equal(isTextFile('LICENSE'), false)
  assert.equal(isTextFile('.gitignore'), false)
  assert.equal(isTextFile('raro.formatoinventado'), false)
})

test('el orden no depende del filesystem ni del locale', () => {
  const uno = computeSkillDigest(
    skillDir({ 'z.md': Buffer.from('z\n'), 'a.md': Buffer.from('a\n'), 'Ñ.md': Buffer.from('n\n') })
  )
  const dos = computeSkillDigest(
    skillDir({ 'Ñ.md': Buffer.from('n\n'), 'z.md': Buffer.from('z\n'), 'a.md': Buffer.from('a\n') })
  )

  assert.equal(uno.digest, dos.digest)
  assert.equal(uno.files, 3)
})

test('los directorios vacíos no aportan al digest', () => {
  const dir = skillDir({ 'SKILL.md': LF })
  mkdirSync(join(dir, 'vacio'), { recursive: true })

  assert.equal(computeSkillDigest(dir).digest, VECTORES.skillMd)
})

test('un symlink deja el digest no calculable, no lo saltea', (t) => {
  const dir = skillDir({ 'SKILL.md': LF })
  const afuera = skillDir({ 'secreto.md': Buffer.from('x\n') })

  try {
    symlinkSync(afuera, join(dir, 'fuga'), 'dir')
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EACCES') throw error
    // Windows sin modo desarrollador no deja crear symlinks. Se saltea de forma
    // VISIBLE: un `return` mudo haría que el reporte diga que el caso pasó
    // cuando en realidad no se ejecutó. En Linux y macOS corre siempre.
    return t.skip('el sistema no permite crear symlinks (Windows sin modo desarrollador)')
  }

  const resultado = computeSkillDigest(dir)
  assert.equal(resultado.ok, false)
  assert.match(resultado.reason, /symlink/)
})

test('en Windows, un junction tampoco se sigue', (t) => {
  // Los junctions son reparse points y se crean sin permisos especiales, así
  // que son la forma realista de que aparezca un enlace en un repo Windows. Sin
  // este caso, la política de symlinks quedaría demostrada solo en Unix.
  if (process.platform !== 'win32') return t.skip('solo aplica a Windows')

  const dir = skillDir({ 'SKILL.md': LF })
  const afuera = skillDir({ 'secreto.md': Buffer.from('x\n') })
  symlinkSync(afuera, join(dir, 'union'), 'junction')

  const resultado = computeSkillDigest(dir)
  assert.equal(resultado.ok, false)
  assert.match(resultado.reason, /symlink|no regular/)
})

test('el nombre del algoritmo viaja dentro del hash', () => {
  // Si el prefijo de dominio no estuviera, un digest de este algoritmo podría
  // confundirse con el de otro tipo de objeto.
  assert.equal(ALGORITHM, 'pactlock-skill-tree-v1')
  assert.match(computeSkillDigest(skillDir({})).digest, /^sha256:[0-9a-f]{64}$/)
})
