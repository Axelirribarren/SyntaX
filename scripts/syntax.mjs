#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'

const [, , command, planArg, projectArg = '.'] = process.argv

if (!['preview', 'apply'].includes(command) || !planArg) {
  console.error('Uso: npm run syntax -- <preview|apply> <syntax-plan.json> [ruta-del-proyecto]')
  process.exit(1)
}

const projectRoot = resolve(projectArg)
const planPath = resolve(planArg)
const plan = readJson(planPath, 'plan de SyntaX')
validatePlan(plan)

const inspection = inspectProject(projectRoot)
printPreview(plan, inspection, projectRoot)

if (command === 'preview') {
  console.log('\nVista previa solamente. Usá "apply" cuando estés conforme.')
  process.exit(0)
}

if (inspection.missingFrameworks.length) {
  console.error(`\nNo se aplicó: faltan requisitos del stack (${inspection.missingFrameworks.join(', ')}).`)
  process.exit(2)
}

applyPlan(plan, projectRoot, inspection)

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
  } catch (error) {
    throw new Error(`No pude leer ${label} en ${path}: ${error.message}`)
  }
}

function validatePlan(value) {
  if (value?.schemaVersion !== 1 || !value.operations) {
    throw new Error('El archivo no es un plan SyntaX compatible (schemaVersion 1).')
  }
  for (const packageName of value.operations.packages || []) {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName)) {
      throw new Error(`Paquete inválido: ${packageName}`)
    }
  }
  for (const repo of value.operations.skills || []) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo.repo || '')) throw new Error(`Repo inválido: ${repo.repo}`)
    if (!safeSegment(repo.target)) throw new Error(`Destino de skill inválido: ${repo.target}`)
    if (!repo.path || isAbsolute(repo.path) || repo.path.split(/[\\/]/).includes('..')) {
      throw new Error(`Ruta de skill inválida: ${repo.path}`)
    }
  }
}

function safeSegment(value) {
  return typeof value === 'string' && /^[\w.-]+$/.test(value) && value !== '.' && value !== '..'
}

function inspectProject(root) {
  if (!existsSync(root)) throw new Error(`No existe el proyecto: ${root}`)
  const packagePath = join(root, 'package.json')
  const pkg = existsSync(packagePath) ? readJson(packagePath, 'package.json') : null
  const dependencies = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
  const detectedFrameworks = []
  if (dependencies.react) detectedFrameworks.push('react')
  if (dependencies.vue) detectedFrameworks.push('vue')
  if (dependencies.svelte) detectedFrameworks.push('svelte')

  const required = plan.requirements?.frameworks || []
  return {
    pkg,
    detectedFrameworks,
    missingFrameworks: required.filter((name) => !detectedFrameworks.includes(name)),
    packageManager: detectPackageManager(root)
  }
}

function detectPackageManager(root) {
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn'
  if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) return 'bun'
  return 'npm'
}

function printPreview(value, inspection, root) {
  const operations = value.operations
  console.log(`\nSyntaX — ${value.name}`)
  console.log(`Proyecto: ${root}`)
  console.log(`Stack detectado: ${inspection.detectedFrameworks.join(', ') || 'sin framework reconocido'}`)
  console.log(`Package manager: ${inspection.packageManager}`)
  if (inspection.missingFrameworks.length) {
    console.log(`ADVERTENCIA: faltan ${inspection.missingFrameworks.join(', ')}`)
  }
  printList('Dependencias', operations.packages)
  printList('Skills', (operations.skills || []).map((item) => `${item.target} <- ${item.repo}/${item.path}`))
  printList('MCP servers', Object.keys(operations.mcpServers || {}))
  printList('Plugins', (operations.plugins || []).map((item) => item.name))
}

function printList(label, values = []) {
  console.log(`${label}: ${values.length ? values.join(', ') : 'ninguno'}`)
}

function applyPlan(value, root, inspection) {
  const operations = value.operations
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')

  if ((operations.packages || []).length) {
    if (!inspection.pkg) throw new Error('El plan tiene dependencias, pero el proyecto no tiene package.json.')
    const args = inspection.packageManager === 'npm'
      ? ['install', ...operations.packages]
      : ['add', ...operations.packages]
    run(inspection.packageManager, args, root)
  }

  const mcpEntries = operations.mcpServers || {}
  if (Object.keys(mcpEntries).length) {
    const mcpPath = join(root, '.mcp.json')
    let current = {}
    if (existsSync(mcpPath)) {
      current = readJson(mcpPath, '.mcp.json')
      copyFileSync(mcpPath, `${mcpPath}.syntax-backup-${stamp}`)
    }
    current.mcpServers = { ...(current.mcpServers || {}), ...mcpEntries }
    writeFileSync(mcpPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
  }

  if ((operations.skills || []).length) {
    const skillsRoot = join(root, '.claude', 'skills')
    mkdirSync(skillsRoot, { recursive: true })
    const temporary = mkdtempSync(join(tmpdir(), 'syntax-'))
    try {
      const repos = new Map()
      for (const skill of operations.skills) {
        if (!repos.has(skill.repo)) {
          const clone = join(temporary, skill.repo.replace('/', '-'))
          run('git', ['clone', '--depth', '1', '--quiet', `https://github.com/${skill.repo}.git`, clone], root)
          repos.set(skill.repo, clone)
        }
        const source = resolve(repos.get(skill.repo), skill.path)
        assertInside(source, repos.get(skill.repo))
        if (!existsSync(source)) throw new Error(`No existe la skill verificada: ${skill.repo}/${skill.path}`)
        const destination = join(skillsRoot, skill.target)
        assertInside(destination, skillsRoot)
        if (existsSync(destination)) renameSync(destination, `${destination}.syntax-backup-${stamp}`)
        cpSync(source, destination, { recursive: true })
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  }

  console.log('\nPlan aplicado.')
  for (const plugin of operations.plugins || []) {
    console.log(`Plugin pendiente en Claude Code: /plugin marketplace add ${plugin.marketplace}`)
    console.log(`Plugin pendiente en Claude Code: /plugin install ${plugin.plugin}@${plugin.marketplaceName}`)
  }
}

function assertInside(candidate, parent) {
  const rel = relative(resolve(parent), resolve(candidate))
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) return
  throw new Error(`Ruta fuera del destino permitido: ${basename(candidate)}`)
}

function run(executable, args, cwd) {
  const command = process.platform === 'win32' && ['npm', 'pnpm', 'yarn', 'bun'].includes(executable)
    ? `${executable}.cmd`
    : executable
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${executable} terminó con código ${result.status}`)
}
