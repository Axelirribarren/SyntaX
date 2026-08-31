// Server MCP mínimo para probar el probe sin salir a la red ni instalar nada.
// Habla el mismo JSON-RPC sobre stdio que un server real.
//
// Modos, por argumento:
//   (ninguno)   handshake normal y dos herramientas
//   --ruidoso   escribe un log por stdout antes del handshake
//   --muere     sale de inmediato, como un server mal instalado
//   --mudo      no responde nunca, para probar el timeout

const mode = process.argv[2] || ''

if (mode === '--muere') process.exit(1)

const TOOLS = [
  {
    name: 'navegar',
    description: 'Abre una URL en el navegador.',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
  },
  {
    name: 'captura',
    description: 'Toma una captura de pantalla de la página actual.',
    inputSchema: { type: 'object', properties: { selector: { type: 'string' } } }
  }
]

if (mode === '--ruidoso') process.stdout.write('listo, escuchando en stdio\n')

let buffer = ''
process.stdin.on('data', (chunk) => {
  if (mode === '--mudo') return

  buffer += chunk.toString('utf8')
  let index = buffer.indexOf('\n')

  while (index !== -1) {
    const line = buffer.slice(0, index).trim()
    buffer = buffer.slice(index + 1)
    index = buffer.indexOf('\n')
    if (!line) continue

    const message = JSON.parse(line)

    if (message.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: message.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: 'fake', version: '1.0.0' }
        }
      })
    }

    if (message.method === 'tools/list') {
      send({ jsonrpc: '2.0', id: message.id, result: { tools: TOOLS } })
    }
  }
})

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}
