// Convierte un kit + la selección del usuario en artefactos de instalación.
//
// La app corre en el navegador, así que no puede escribir en el proyecto: lo que
// genera es un script que el usuario lee y ejecuta él mismo desde la raíz de su
// proyecto. Todo lo generado es idempotente y aditivo — un .mcp.json existente
// se enriquece, nunca se pisa.
//
// LICENCIAS — leer antes de tocar la copia de skills.
// SyntaX no redistribuye nada: el script clona desde el repo original y la copia
// ocurre en la máquina del usuario. Pero ese usuario después suele commitear
// .agents/skills/ o .claude/skills/ en su propio repo, y ahí sí redistribuye. Las skills de
// anthropics/skills son Apache 2.0, cuya sección 4(a) exige entregar una copia
// de la licencia junto con el trabajo. Cada carpeta trae su LICENSE.txt, así que
// la copia recursiva lo arrastra sola y el usuario queda cubierto.
// Si alguna vez se cambia la copia por algo más selectivo (copiar solo SKILL.md,
// filtrar archivos "innecesarios"), hay que seguir llevando LICENSE.txt sí o sí.

export const SKILL_TARGETS = {
  codex: { label: 'Codex', directory: '.agents/skills' },
  claude: { label: 'Claude Code', directory: '.claude/skills' }
}

export function skillTargetIds(plan) {
  const values = plan.skillTargets || ['codex']
  return [...new Set(values)].filter((target) => SKILL_TARGETS[target])
}

function skillDirectories(plan) {
  return skillTargetIds(plan).map((target) => SKILL_TARGETS[target].directory)
}

export function buildPlan(kit, selectedIds) {
  const chosen = kit.items.filter((item) => selectedIds.has(item.id))

  const skills = chosen.filter((i) => i.type === 'skill')
  const servers = chosen.filter((i) => i.type === 'mcp')
  const plugins = chosen.filter((i) => i.type === 'plugin')
  const packages = chosen.filter((i) => i.type === 'package')

  // Un clone por repo, no uno por skill.
  const repos = [...new Set(skills.map((s) => s.repo))].map((repo) => ({
    repo,
    dirName: repo.replace('/', '-'),
    skills: skills.filter((s) => s.repo === repo)
  }))

  return {
    kitName: kit.name,
    skills,
    repos,
    servers,
    plugins,
    packages,
    npmPackages: [...new Set(packages.flatMap((item) => item.packages || []))],
    frameworks: [...new Set(packages.flatMap((item) => item.frameworks || []))],
    secrets: servers.filter((s) => s.needsSecret).map((s) => s.needsSecret),
    isEmpty: chosen.length === 0
  }
}

// Contrato portable entre la PWA y la CLI. Mantenerlo con datos simples:
// el plan se puede revisar, versionar y aplicar desde cualquier carpeta.
export function portablePlan(plan) {
  return {
    schemaVersion: 2,
    generatedBy: 'SyntaX',
    generatedAt: new Date().toISOString(),
    name: plan.kitName,
    requirements: { frameworks: plan.frameworks },
    installation: { skillTargets: skillTargetIds(plan) },
    operations: {
      packages: plan.npmPackages,
      skills: plan.skills.map(({ name, repo, path, target, license }) => ({
        name, repo, path, target, license
      })),
      mcpServers: Object.fromEntries(
        plan.servers.map((item) => [item.server.key, serverConfig(item.server)])
      ),
      plugins: plan.plugins.map(({ name, marketplace, marketplaceName, plugin }) => ({
        name, marketplace, marketplaceName, plugin
      }))
    }
  }
}

// Los MCP servers vienen en dos formas y hay que soportar las dos:
//   - stdio: se lanza un proceso local ({ command, args })
//   - http:  se apunta a una URL remota ({ url, headers })
// Un catálogo que solo emite la primera deja afuera toda una familia de
// servers alojados (21st, por ejemplo) y produce un .mcp.json inútil.
// Los secretos nunca se escriben: van como placeholder para que el usuario
// los complete a mano y no termine commiteando una clave.
function serverConfig(server) {
  const marcador = (obj) => Object.fromEntries(Object.keys(obj).map((k) => [k, `TU_${k}`]))

  if (server.url) {
    const cfg = { url: server.url }
    if (server.headers) cfg.headers = marcador(server.headers)
    return cfg
  }

  const cfg = { command: server.command, args: server.args }
  if (server.env) cfg.env = marcador(server.env)
  return cfg
}

// .mcp.json resultante, para que el usuario vea qué le va a quedar.
export function mcpPreview(plan) {
  const mcpServers = {}
  for (const item of plan.servers) {
    mcpServers[item.server.key] = serverConfig(item.server)
  }
  return JSON.stringify({ mcpServers }, null, 2)
}

export function pluginCommands(plan) {
  const lines = []
  for (const p of plan.plugins) {
    lines.push(`/plugin marketplace add ${p.marketplace}`)
    lines.push(`/plugin install ${p.plugin}@${p.marketplaceName}`)
  }
  return lines
}

function header(plan, comment) {
  const directories = skillDirectories(plan).join(', ')
  return [
    `${comment} Instalador de kit generado por SyntaX — "${plan.kitName}"`,
    `${comment} Generado: ${new Date().toISOString()}`,
    `${comment}`,
    `${comment} Corré esto desde la RAÍZ de tu proyecto. Es aditivo e idempotente:`,
    `${comment} agrega servers a .mcp.json sin borrar los que ya tengas, y reemplaza`,
    `${comment} solo las carpetas de skills que estén en este kit. Antes crea un`,
    `${comment} backup con el sufijo .syntax-backup-<fecha>.`,
    `${comment} Leelo antes de ejecutarlo.`,
    `${comment}`,
    `${comment} Cada skill se copia con su LICENSE.txt: conservalo si después`,
    `${comment} versionás ${directories || 'las skills'} en un repo público.`
  ]
}

// ---------------------------------------------------------------- PowerShell

function psCadena(v) {
  return `'${String(v).replace(/'/g, "''")}'`
}

// Serializa un objeto JS a literal de PowerShell. Las claves van SIEMPRE
// entrecomilladas: un header como x-api-key sin comillas es un error de
// sintaxis en PowerShell (interpreta los guiones como restas).
function psLiteral(valor) {
  if (Array.isArray(valor)) return `@(${valor.map(psLiteral).join(', ')})`
  if (valor && typeof valor === 'object') {
    const pares = Object.entries(valor).map(([k, v]) => `${psCadena(k)} = ${psLiteral(v)}`)
    return `[pscustomobject]@{ ${pares.join('; ')} }`
  }
  return psCadena(valor)
}

export function generatePowerShell(plan) {
  const L = header(plan, '#')
  L.push(
    '',
    "$ErrorActionPreference = 'Stop'",
    '$root = (Get-Location).Path',
    "$backupStamp = Get-Date -Format 'yyyyMMddTHHmmss'",
    'Write-Host ""',
    'Write-Host "Instalando kit en: $root" -ForegroundColor Cyan',
    'Write-Host ""'
  )

  if (plan.servers.length) {
    L.push(
      '',
      '# ---------- MCP servers -> .mcp.json ----------',
      "$mcpPath = Join-Path $root '.mcp.json'",
      'if (Test-Path $mcpPath) {',
      '  Copy-Item -Force $mcpPath "$mcpPath.syntax-backup-$backupStamp"',
      '  $mcp = Get-Content $mcpPath -Raw | ConvertFrom-Json',
      '  Write-Host "  backup de .mcp.json creado; se agregan servers" -ForegroundColor DarkGray',
      '} else {',
      '  $mcp = [pscustomobject]@{}',
      '}',
      "if (-not $mcp.PSObject.Properties['mcpServers']) {",
      "  $mcp | Add-Member -NotePropertyName 'mcpServers' -NotePropertyValue ([pscustomobject]@{}) -Force",
      '}'
    )
    for (const item of plan.servers) {
      const { key } = item.server
      L.push(
        `$mcp.mcpServers | Add-Member -NotePropertyName ${psCadena(key)} -NotePropertyValue (${psLiteral(serverConfig(item.server))}) -Force`,
        `Write-Host "  + MCP ${key}" -ForegroundColor Green`
      )
    }
    L.push(
      '$mcp | ConvertTo-Json -Depth 10 | Set-Content -Path $mcpPath -Encoding utf8',
      'Write-Host "  .mcp.json escrito" -ForegroundColor DarkGray'
    )
  }

  if (plan.npmPackages.length) {
    const paquetes = plan.npmPackages.map(psCadena).join(', ')
    L.push(
      '',
      '# ---------- Dependencias del proyecto ----------',
      `$packages = @(${paquetes})`,
      "if (Test-Path (Join-Path $root 'pnpm-lock.yaml')) { pnpm add @packages }",
      "elseif (Test-Path (Join-Path $root 'yarn.lock')) { yarn add @packages }",
      "elseif (Test-Path (Join-Path $root 'bun.lockb')) { bun add @packages }",
      'else { npm install @packages }',
      'Write-Host "  + dependencias del proyecto" -ForegroundColor Green'
    )
  }

  if (plan.repos.length) {
    const directories = skillDirectories(plan)
    L.push(
      '',
      `# ---------- Skills -> ${directories.join(', ')} ----------`,
      'if (-not (Get-Command git -ErrorAction SilentlyContinue)) {',
      '  throw "Hace falta git para copiar las skills. Instalalo o copiá las carpetas a mano."',
      '}',
      "$tmp = Join-Path $env:TEMP ('syntax-kit-' + [guid]::NewGuid().ToString('N').Substring(0,8))",
      'New-Item -ItemType Directory -Force -Path $tmp | Out-Null',
      'try {'
    )
    for (const { repo, dirName, skills } of plan.repos) {
      L.push(
        `  Write-Host "  clonando ${repo}..." -ForegroundColor DarkGray`,
        `  $clone = Join-Path $tmp '${dirName}'`,
        `  git clone --depth 1 --quiet https://github.com/${repo}.git $clone`
      )
      for (const s of skills) {
        const srcPath = s.path.replace(/\//g, '\\')
        // -Recurse copia la carpeta entera, LICENSE.txt incluido. No lo cambies
        // por una copia selectiva sin llevar la licencia: ver nota de arriba.
        for (const directory of directories) {
          L.push(
            `  $skillsRoot = Join-Path $root '${directory.replace('/', '\\')}'`,
            '  New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null',
            `  $dest = Join-Path $skillsRoot '${s.target}'`,
            '  if (Test-Path $dest) {',
            '    $backup = "$dest.syntax-backup-$backupStamp"',
            '    Copy-Item -Recurse -Force $dest $backup',
            '    try { Remove-Item -Recurse -Force $dest -ErrorAction Stop }',
            '    catch { Write-Host "  Windows mantiene la skill abierta; se actualiza archivo por archivo" -ForegroundColor Yellow }',
            '  }',
            `  Copy-Item -Recurse -Force (Join-Path $clone '${srcPath}') $dest`,
            `  Write-Host "  + skill ${s.target} -> ${directory}" -ForegroundColor Green`
          )
        }
      }
    }
    L.push(
      '} finally {',
      '  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue',
      '}'
    )
  }

  L.push('', 'Write-Host ""', 'Write-Host "Listo." -ForegroundColor Cyan')

  if (plan.secrets.length) {
    L.push(
      'Write-Host ""',
      'Write-Host "FALTA: completá estas variables en .mcp.json antes de usarlo:" -ForegroundColor Yellow'
    )
    for (const s of plan.secrets) {
      L.push(`Write-Host "  - ${s} (ahora dice TU_${s})" -ForegroundColor Yellow`)
    }
    L.push('Write-Host "  Ojo: .mcp.json suele estar versionado, no commitees la clave." -ForegroundColor Yellow')
  }

  if (plan.plugins.length) {
    L.push('Write-Host ""', 'Write-Host "Pegá esto en Claude Code (son slash commands, no shell):" -ForegroundColor Yellow')
    for (const cmd of pluginCommands(plan)) {
      L.push(`Write-Host "  ${cmd}" -ForegroundColor Yellow`)
    }
  }

  L.push(`Write-Host "Reiniciá ${skillTargetIds(plan).map((id) => SKILL_TARGETS[id].label).join(' o ')} para que tome los cambios." -ForegroundColor DarkGray`)
  return L.join('\n') + '\n'
}

// ---------------------------------------------------------------------- Bash

function shQuote(v) {
  return `'${String(v).replace(/'/g, `'\\''`)}'`
}

export function generateBash(plan) {
  const L = ['#!/usr/bin/env bash', ...header(plan, '#')]
  L.push(
    '',
    'set -euo pipefail',
    'ROOT="$(pwd)"',
    'BACKUP_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"',
    'echo',
    'echo "Instalando kit en: $ROOT"',
    'echo'
  )

  if (plan.servers.length) {
    const additions = {}
    for (const item of plan.servers) {
      additions[item.server.key] = serverConfig(item.server)
    }
    L.push(
      '',
      '# ---------- MCP servers -> .mcp.json ----------',
      '# Se mergea con node (ya lo tenés si usás npm) para no depender de jq.',
      'MERGE_JS="$(mktemp)"',
      "cat > \"$MERGE_JS\" <<'ENDOFMERGE'",
      "const fs = require('fs');",
      'const target = process.argv[2];',
      `const additions = ${JSON.stringify(additions, null, 2)};`,
      'let current = {};',
      "if (fs.existsSync(target)) fs.copyFileSync(target, target + '.syntax-backup-' + process.env.SYNTAX_BACKUP_STAMP);",
      "try { current = JSON.parse(fs.readFileSync(target, 'utf8')); } catch (e) {}",
      'current.mcpServers = Object.assign({}, current.mcpServers, additions);',
      "fs.writeFileSync(target, JSON.stringify(current, null, 2) + '\\n');",
      "for (const k of Object.keys(additions)) console.log('  + MCP ' + k);",
      'ENDOFMERGE',
      'SYNTAX_BACKUP_STAMP="$BACKUP_STAMP" node "$MERGE_JS" "$ROOT/.mcp.json"',
      'rm -f "$MERGE_JS"',
      'echo "  .mcp.json escrito"'
    )
  }

  if (plan.npmPackages.length) {
    const paquetes = plan.npmPackages.map(shQuote).join(' ')
    L.push(
      '',
      '# ---------- Dependencias del proyecto ----------',
      `PACKAGES=(${paquetes})`,
      'if [ -f "$ROOT/pnpm-lock.yaml" ]; then pnpm add "${PACKAGES[@]}"',
      'elif [ -f "$ROOT/yarn.lock" ]; then yarn add "${PACKAGES[@]}"',
      'elif [ -f "$ROOT/bun.lockb" ]; then bun add "${PACKAGES[@]}"',
      'else npm install "${PACKAGES[@]}"',
      'fi',
      'echo "  + dependencias del proyecto"'
    )
  }

  if (plan.repos.length) {
    const directories = skillDirectories(plan)
    L.push(
      '',
      `# ---------- Skills -> ${directories.join(', ')} ----------`,
      'command -v git >/dev/null || { echo "Hace falta git para copiar las skills."; exit 1; }',
      'TMP="$(mktemp -d)"',
      'trap \'rm -rf "$TMP"\' EXIT'
    )
    for (const { repo, dirName, skills } of plan.repos) {
      L.push(
        `echo "  clonando ${repo}..."`,
        `git clone --depth 1 --quiet https://github.com/${repo}.git "$TMP/${dirName}"`
      )
      for (const s of skills) {
        // cp -R arrastra el LICENSE.txt de cada skill. Ver la nota de licencias
        // arriba antes de reemplazarlo por una copia selectiva.
        for (const directory of directories) {
          L.push(
            `SKILLS_ROOT="$ROOT/${directory}"`,
            'mkdir -p "$SKILLS_ROOT"',
            `if [ -e "$SKILLS_ROOT/${s.target}" ]; then mv "$SKILLS_ROOT/${s.target}" "$SKILLS_ROOT/${s.target}.syntax-backup-$BACKUP_STAMP"; fi`,
            `cp -R "$TMP/${dirName}/${s.path}" "$SKILLS_ROOT/${s.target}"`,
            `echo "  + skill ${s.target} -> ${directory}"`
          )
        }
      }
    }
  }

  L.push('', 'echo', 'echo "Listo."')

  if (plan.secrets.length) {
    L.push('echo', 'echo "FALTA: completá estas variables en .mcp.json antes de usarlo:"')
    for (const s of plan.secrets) L.push(`echo "  - ${s} (ahora dice TU_${s})"`)
    L.push('echo "  Ojo: .mcp.json suele estar versionado, no commitees la clave."')
  }

  if (plan.plugins.length) {
    L.push('echo', 'echo "Pegá esto en Claude Code (son slash commands, no shell):"')
    for (const cmd of pluginCommands(plan)) L.push(`echo ${shQuote('  ' + cmd)}`)
  }

  L.push(`echo "Reiniciá ${skillTargetIds(plan).map((id) => SKILL_TARGETS[id].label).join(' o ')} para que tome los cambios."`)
  return L.join('\n') + '\n'
}
