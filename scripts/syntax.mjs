#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { runCommand } from './run-command.mjs'
import { replaceSkillDirectory } from './skill-files.mjs'

const SKILL_TARGET_DIRECTORIES = {
  codex: ['.agents', 'skills'],
  claude: ['.claude', 'skills']
}

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
  if (![1, 2].includes(value?.schemaVersion) || !isPlainObject(value.operations)) {
    throw new Error('El archivo no es un plan SyntaX compatible (schemaVersion 1 o 2).')
  }
  const { operations } = value
  if (operations.packages != null && !Array.isArray(operations.packages)) {
    throw new Error('Las dependencias del plan deben ser una lista.')
  }
  if (operations.skills != null && !Array.isArray(operations.skills)) {
    throw new Error('Las skills del plan deben ser una lista.')
  }
  if (operations.plugins != null && !Array.isArray(operations.plugins)) {
    throw new Error('Los plugins del plan deben ser una lista.')
  }
  if (operations.mcpServers != null && !isPlainObject(operations.mcpServers)) {
    throw new Error('Los MCP servers del plan deben ser un objeto.')
  }
  if (value.requirements?.frameworks != null && !Array.isArray(value.requirements.frameworks)) {
    throw new Error('Los requisitos de framework deben ser una lista.')
  }
  const targets = getSkillTargets(value)
  if (!targets.length || targets.some((target) => !SKILL_TARGET_DIRECTORIES[target])) {
    throw new Error('El plan tiene un destino de skills inválido.')
  }
  for (const framework of value.requirements?.frameworks || []) {
    if (!['react', 'vue', 'svelte'].includes(framework)) {
      throw new Error(`Framework no compatible: ${framework}`)
    }
  }
  for (const packageName of operations.packages || []) {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(packageName)) {
      throw new Error(`Paquete inválido: ${packageName}`)
    }
  }
  for (const repo of operations.skills || []) {
    if (!isPlainObject(repo)) throw new Error('Skill inválida en el plan.')
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo.repo || '')) throw new Error(`Repo inválido: ${repo.repo}`)
    if (!safeSegment(repo.target)) throw new Error(`Destino de skill inválido: ${repo.target}`)
    if (!repo.path || typeof repo.path !== 'string' || isAbsolute(repo.path) || !repo.path.split(/[\\/]/).every(safeSegment)) {
      throw new Error(`Ruta de skill inválida: ${repo.path}`)
    }
  }
  for (const [key, server] of Object.entries(operations.mcpServers || {})) {
    if (!safeSegment(key) || !isPlainObject(server)) throw new Error(`MCP inválido: ${key}`)
    if (typeof server.command !== 'string' && typeof server.url !== 'string') {
      throw new Error(`MCP sin command o url: ${key}`)
    }
    if (server.command != null && (!Array.isArray(server.args || []) || !server.args.every((arg) => typeof arg === 'string'))) {
      throw new Error(`Argumentos inválidos para MCP: ${key}`)
    }
    if (server.url != null && !/^https:\/\//.test(server.url)) throw new Error(`URL MCP inválida: ${key}`)
  }
}

function getSkillTargets(value) {
  // Los planes v1 se generaban exclusivamente para Claude Code.
  if (value.schemaVersion === 1 && value.installation?.skillTargets == null) return ['claude']
  return Array.isArray(value.installation?.skillTargets) ? [...new Set(value.installation.skillTargets)] : []
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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
  printList(
    'Destinos de skills',
    getSkillTargets(value).map((target) => `${target} (${SKILL_TARGET_DIRECTORIES[target].join('/')})`)
  )
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
    runCommand(inspection.packageManager, args, root)
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
    const skillsRoots = getSkillTargets(value).map((target) => ({
      target,
      path: join(root, ...SKILL_TARGET_DIRECTORIES[target])
    }))
    for (const entry of skillsRoots) mkdirSync(entry.path, { recursive: true })
    const temporary = mkdtempSync(join(tmpdir(), 'syntax-'))
    try {
      const repos = new Map()
      for (const skill of operations.skills) {
        if (!repos.has(skill.repo)) {
          const clone = join(temporary, skill.repo.replace('/', '-'))
          runCommand('git', ['clone', '--depth', '1', '--quiet', `https://github.com/${skill.repo}.git`, clone], root)
          repos.set(skill.repo, clone)
        }
        const source = resolve(repos.get(skill.repo), skill.path)
        assertInside(source, repos.get(skill.repo))
        if (!existsSync(source)) throw new Error(`No existe la skill verificada: ${skill.repo}/${skill.path}`)
        for (const skillsRoot of skillsRoots) {
          const destination = join(skillsRoot.path, skill.target)
          assertInside(destination, skillsRoot.path)
          const replacement = replaceSkillDirectory(source, destination, stamp)
          if (replacement.backup) console.log(`  backup: ${basename(replacement.backup)}`)
          if (replacement.updatedInPlace) {
            console.warn(`  Windows bloqueó el borrado de ${skill.target}; se actualizó archivo por archivo.`)
          }
          console.log(`  + skill ${skill.target} -> ${skillsRoot.target}`)
        }
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
