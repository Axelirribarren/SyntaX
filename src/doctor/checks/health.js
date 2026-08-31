// Qué pasó al levantar cada MCP server. Solo corre con `--deep`.
//
// Este check es un efecto secundario que resultó tan valioso como la medición
// que lo motivó: un server declarado en .mcp.json que no arranca es invisible
// hasta que alguien lo necesita en medio de una tarea. Acá aparece antes.
export default {
  id: 'health',
  title: 'Estado de los MCP servers',

  run({ probes }) {
    if (!probes) return { findings: [] }

    const findings = []

    const caidos = probes.filter((probe) => !probe.ok && !probe.skipped)
    if (caidos.length) {
      findings.push({
        severity: 'alta',
        message: `${caidos.length} MCP servers declarados que no respondieron`,
        detail: 'Están en la configuración pero no aportan herramientas: costo de mantenimiento sin beneficio.',
        items: caidos.map((probe) => `${probe.id}: ${probe.reason}`)
      })
    }

    const omitidos = probes.filter((probe) => probe.skipped)
    if (omitidos.length) {
      findings.push({
        severity: 'info',
        message: `${omitidos.length} servers no se pudieron medir`,
        items: omitidos.map((probe) => `${probe.id}: ${probe.reason}`)
      })
    }

    // Un server que expone decenas de herramientas se lleva una porción grande
    // de la ventana en cada arranque, aunque se use una sola vez por semana.
    const pesados = probes
      .filter((probe) => probe.ok && probe.count >= 20)
      .sort((a, b) => b.tokens - a.tokens)

    if (pesados.length) {
      findings.push({
        severity: 'media',
        message: `${pesados.length} servers exponen 20 o más herramientas`,
        detail: 'Todas sus definiciones entran en cada arranque, se usen o no.',
        items: pesados.map((probe) => `${probe.id}: ${probe.count} herramientas`)
      })
    }

    return { findings }
  }
}
