// Levanta cada MCP server y le pregunta qué herramientas expone.
//
// Es la única parte de SyntaX que ejecuta código del proyecto auditado, y por
// eso vive detrás de `--deep` y nunca corre en el `doctor` normal. Quien la
// invoca está ejecutando los comandos declarados en el .mcp.json de ese repo:
// la CLI lo advierte antes de hacerlo.
//
// El protocolo MCP sobre stdio es JSON-RPC 2.0 en líneas separadas por \n. Son
// tres mensajes y no justifica una dependencia:
//
//   -> initialize                 (handshake, dice qué versión hablamos)
//   -> notifications/initialized  (aviso, sin respuesta)
//   -> tools/list                 (lo que vinimos a buscar)

import { spawn } from 'node:child_process'

import { commandInvocation } from '../fs/run.js'
import { countTokens } from './tokenize.js'

const PROTOCOL_VERSION = '2025-06-18'
export const DEFAULT_TIMEOUT_MS = 30_000

export async function probeEnvironment(snapshots, options = {}) {
  const servers = new Map()
  for (const snapshot of snapshots) {
    for (const server of snapshot.objects.mcp || []) {
      if (!servers.has(server.id)) servers.set(server.id, server)
    }
  }

  const results = []
  for (const server of servers.values()) {
    results.push(await probeServer(server, options))
  }
  return results
}

export async function probeServer(server, options = {}) {
  const base = { id: server.id, transport: server.transport }

  // Los servers remotos necesitan red y, casi siempre, credenciales que en el
  // .mcp.json son placeholders. Medirlos sería salir a internet con las claves
  // de otra persona: se declaran no medidos y se dice por qué.
  if (server.transport !== 'stdio') {
    return { ...base, ok: false, skipped: true, reason: 'server remoto: requiere red y credenciales' }
  }

  if ((server.emptyEnv || []).length) {
    return {
      ...base,
      ok: false,
      skipped: true,
      reason: `sin credenciales (${server.emptyEnv.join(', ')})`
    }
  }

  if (!server.command) {
    return { ...base, ok: false, skipped: true, reason: 'sin comando declarado' }
  }

  try {
    const tools = await requestTools(server, options)
    const detail = tools.map((tool) => ({
      name: tool.name,
      tokens: countTokens(JSON.stringify(tool))
    }))

    return {
      ...base,
      ok: true,
      tools: detail,
      count: detail.length,
      tokens: detail.reduce((total, tool) => total + tool.tokens, 0)
    }
  } catch (error) {
    return { ...base, ok: false, reason: error.message }
  }
}

function requestTools(server, options) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  const invocation = commandInvocation(server.command, server.args || [])

  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      // El entorno del proceso padre más lo declarado. Los valores vacíos ya
      // fueron descartados antes de llegar acá.
      env: { ...process.env, ...(server.envValues || {}) },
      stdio: ['pipe', 'pipe', 'ignore'],
      shell: false
    })

    let buffer = ''
    let settled = false

    const finish = (error, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      if (error) reject(error)
      else resolve(value)
    }

    const timer = setTimeout(() => {
      finish(new Error(`no respondió en ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)

    child.on('error', (error) => finish(new Error(`no arrancó: ${error.message}`)))
    child.on('exit', (code) => {
      if (!settled) finish(new Error(`terminó con código ${code} antes de responder`))
    })

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8')

      let index = buffer.indexOf('\n')
      while (index !== -1) {
        const line = buffer.slice(0, index).trim()
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf('\n')
        if (!line) continue

        let message
        try {
          message = JSON.parse(line)
        } catch {
          // Hay servers que escriben logs por stdout antes del handshake.
          // Ignorar lo que no sea JSON-RPC es más robusto que fallar.
          continue
        }

        if (message.id === 1) {
          send(child, { jsonrpc: '2.0', method: 'notifications/initialized' })
          send(child, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
          continue
        }

        if (message.id === 2) {
          if (message.error) finish(new Error(message.error.message || 'tools/list falló'))
          else finish(null, message.result?.tools || [])
        }
      }
    })

    send(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'syntax-doctor', version: '0.2.0' }
      }
    })
  })
}

function send(child, message) {
  try {
    child.stdin.write(`${JSON.stringify(message)}\n`)
  } catch {
    // Si el server ya cerró stdin, el timeout o el exit resuelven la promesa.
  }
}
