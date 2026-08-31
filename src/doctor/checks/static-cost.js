import { active } from '../../targets/contract.js'
import { countTokens, countTokensFromBytes } from '../tokenize.js'

// Lo que el entorno inyecta en cada arranque, antes de que la persona escriba
// una palabra. Es el titular del reporte y la razón por la que agregar
// herramientas puede empeorar al agente en vez de mejorarlo.
//
// Este check mide solo lo que se lee del disco. Los schemas de tools de los MCP
// servers —que suelen ser la porción más grande— requieren levantar cada server
// y pedirle su lista, y eso implica lanzar procesos y salir a la red. `doctor`
// es solo lectura por diseño, así que ese tramo queda declarado como NO MEDIDO
// y espera a `doctor --deep`.
//
// Declarar lo que falta no es una disculpa: un total que dice ser completo y no
// lo es se descubre a la primera y arrastra la credibilidad de todo el reporte.
export default {
  id: 'static-cost',
  title: 'Costo de arranque',

  run({ snapshots, probes }) {
    const parts = []
    const unmeasured = []

    const rules = snapshots.flatMap((snapshot) => snapshot.objects.rule || [])
    if (rules.length) {
      parts.push({
        label: 'reglas',
        tokens: rules.reduce((total, rule) => total + countTokensFromBytes(rule.bytes), 0),
        detail: rules.map((rule) => rule.id).join(', ')
      })
    }

    const skills = snapshots.flatMap((snapshot) => active(snapshot.objects.skill))
    if (skills.length) {
      const tokens = skills.reduce(
        (total, skill) => total + countTokens(`${skill.name || skill.id} ${skill.description}`),
        0
      )
      parts.push({
        label: 'descripciones de skills',
        tokens,
        detail: `${skills.length} skills en total`
      })
    }

    const agents = snapshots.flatMap((snapshot) => snapshot.objects.agent || [])
    if (agents.length) {
      parts.push({
        label: 'descripciones de agentes',
        tokens: agents.reduce(
          (total, agent) => total + countTokens(`${agent.name || agent.id} ${agent.description}`),
          0
        ),
        detail: `${agents.length} agentes`
      })
    }

    const commands = snapshots.flatMap((snapshot) => snapshot.objects.command || [])
    if (commands.length) {
      parts.push({
        label: 'comandos',
        tokens: commands.reduce((total, command) => total + countTokens(command.id), 0),
        detail: `${commands.length} comandos`
      })
    }

    const servers = snapshots.flatMap((snapshot) => snapshot.objects.mcp || [])

    if (servers.length && !probes) {
      unmeasured.push({
        label: `schemas de ${servers.length} MCP servers`,
        reason: 'requiere levantar cada server: doctor --deep',
        items: servers.map((server) => server.id)
      })
    }

    if (probes) {
      // Los schemas de tools suelen ser la porción más grande del arranque, y
      // es la que nadie mide. El desglose por server importa tanto como el
      // total: sin él, el número es un reproche sin acción posible.
      const medidos = probes.filter((probe) => probe.ok)
      if (medidos.length) {
        parts.push({
          label: 'schemas de herramientas MCP',
          tokens: medidos.reduce((total, probe) => total + probe.tokens, 0),
          detail: `${medidos.reduce((total, probe) => total + probe.count, 0)} herramientas en ${medidos.length} servers`,
          breakdown: medidos
            .map((probe) => ({ label: probe.id, tokens: probe.tokens, count: probe.count }))
            .sort((a, b) => b.tokens - a.tokens)
        })
      }

      for (const probe of probes.filter((probe) => !probe.ok)) {
        unmeasured.push({ label: `schemas de ${probe.id}`, reason: probe.reason })
      }
    }

    const total = parts.reduce((sum, part) => sum + part.tokens, 0)

    return {
      cost: { total, parts: parts.sort((a, b) => b.tokens - a.tokens), unmeasured },
      findings: []
    }
  }
}
