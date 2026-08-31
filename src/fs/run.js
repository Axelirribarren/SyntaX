import { spawnSync } from 'node:child_process'

const WINDOWS_BATCH_MANAGERS = new Set(['npm', 'pnpm', 'yarn'])
const SAFE_BATCH_ARG = /^[a-zA-Z0-9@._/+:-]+$/

export function commandInvocation(executable, args, platform = process.platform) {
  if (platform !== 'win32' || !WINDOWS_BATCH_MANAGERS.has(executable)) {
    return { command: executable, args }
  }

  // Node 24 ya no ejecuta archivos .cmd de forma directa de manera fiable.
  // Usamos cmd.exe explícitamente, sin shell:true, y aceptamos solo tokens que
  // no puedan introducir operadores del shell. Los nombres npm ya fueron
  // validados por el plan; esta segunda barrera protege futuras llamadas.
  if (!args.every((arg) => typeof arg === 'string' && SAFE_BATCH_ARG.test(arg))) {
    throw new Error(`Argumento inseguro para ${executable} en Windows.`)
  }

  const command = process.env.ComSpec || process.env.COMSPEC || 'cmd.exe'
  return {
    command,
    args: ['/d', '/s', '/c', `${executable}.cmd ${args.join(' ')}`]
  }
}

export function runCommand(executable, args, cwd) {
  const invocation = commandInvocation(executable, args)
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    stdio: 'inherit',
    shell: false
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${executable} terminó con código ${result.status}`)
}
