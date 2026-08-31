import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { defineTarget, emptySnapshot } from './contract.js'
import {
  fileBytes,
  listFiles,
  readJsonSafe,
  readMarkdownMeta,
  readSkillsDirectory,
  normalizeMcpServer
} from './shared.js'

export default defineTarget({
  id: 'claude-code',
  label: 'Claude Code',

  detect(root) {
    return existsSync(join(root, '.claude')) || existsSync(join(root, 'CLAUDE.md'))
  },

  // Claude Code es el runtime más expresivo de los dos que soportamos hoy: sabe
  // decir las ocho cosas salvo secretos, que delega al `.env` del proyecto o al
  // bloque `env` de cada server.
  supports: {
    skill: { dir: '.claude/skills' },
    mcp: { file: '.mcp.json', key: 'mcpServers' },
    rule: { file: 'CLAUDE.md', mode: 'merge-markdown' },
    agent: { dir: '.claude/agents' },
    command: { dir: '.claude/commands' },
    hook: { file: '.claude/settings.json', key: 'hooks' },
    permission: { file: '.claude/settings.json', key: 'permissions' }
  },

  read(root) {
    const snapshot = emptySnapshot(this)
    snapshot.present = this.detect(root)
    if (!snapshot.present) return snapshot

    const { skills, backups } = readSkillsDirectory(root, '.claude/skills')
    snapshot.objects.skill = skills
    snapshot.backups = backups

    const mcp = readJsonSafe(join(root, '.mcp.json'))
    if (mcp?.__parseError) {
      snapshot.notes.push(`.mcp.json no se pudo leer: ${mcp.__parseError}`)
    } else if (mcp?.mcpServers) {
      snapshot.objects.mcp = Object.entries(mcp.mcpServers).map(([id, config]) =>
        normalizeMcpServer(id, config)
      )
    }

    const rulesPath = join(root, 'CLAUDE.md')
    if (existsSync(rulesPath)) {
      snapshot.objects.rule = [
        { id: 'CLAUDE.md', kind: 'rule', relativePath: 'CLAUDE.md', bytes: fileBytes(rulesPath) }
      ]
    }

    snapshot.objects.agent = listFiles(join(root, '.claude/agents'), '.md').map((name) => ({
      id: name.replace(/\.md$/, ''),
      kind: 'agent',
      relativePath: `.claude/agents/${name}`,
      bytes: fileBytes(join(root, '.claude/agents', name)),
      ...readMarkdownMeta(join(root, '.claude/agents', name))
    }))

    snapshot.objects.command = listFiles(join(root, '.claude/commands'), '.md').map((name) => ({
      id: name.replace(/\.md$/, ''),
      kind: 'command',
      relativePath: `.claude/commands/${name}`,
      bytes: fileBytes(join(root, '.claude/commands', name))
    }))

    const settings = readJsonSafe(join(root, '.claude/settings.json'))
    if (settings?.__parseError) {
      snapshot.notes.push(`.claude/settings.json no se pudo leer: ${settings.__parseError}`)
    } else if (settings) {
      snapshot.objects.hook = Object.keys(settings.hooks || {}).map((event) => ({
        id: event,
        kind: 'hook',
        relativePath: '.claude/settings.json'
      }))

      const permissions = settings.permissions || {}
      snapshot.objects.permission = ['allow', 'deny', 'ask'].flatMap((mode) =>
        (permissions[mode] || []).map((rule) => ({
          id: `${mode}:${rule}`,
          kind: 'permission',
          mode,
          rule,
          relativePath: '.claude/settings.json'
        }))
      )
    }

    return snapshot
  }
})
