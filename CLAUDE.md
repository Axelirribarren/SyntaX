# SyntaX — Skills Finder

Buscador PWA de skills, MCP servers y plugins gratuitos/open-source. React 18 + Vite 5 + vite-plugin-pwa, datos desde la API de GitHub y listas "awesome".

## Reglas

- **Git es del usuario.** No hacer `git init`, `git add`, `git commit`, `git push` ni ninguna operación de git. El usuario maneja commits y push por su cuenta.
- El proyecto vive en `C:\Github\SyntaX`, **fuera de OneDrive** a propósito: dentro de OneDrive la sincronización rompía `npm install`. No moverlo ni sugerir moverlo ahí.

## Comandos

```bash
npm run dev
```

Dev server en http://localhost:5173. También hay un `.claude/launch.json` (config `syntax-dev`) para arrancarlo desde el preview.

## Estructura

- `src/api/github.js` — búsqueda de repos por topic/keyword; filtra por licencias OSS y lee el token de `localStorage` (`gh_token`).
- `src/api/awesomeList.js` — parseo de listas awesome desde raw.githubusercontent.
- `src/lib/merge.js`, `src/lib/filters.js` — unificación y filtrado de resultados de ambas fuentes.
- `src/data/kits.js` — kits curados a mano (la parte que da valor). Cada item es `skill`, `mcp` o `plugin`, con su repo, licencia y datos de instalación. **Regla: no agregar un item sin verificar que el repo existe, que el paquete npm resuelve y que la ruta de la skill es real.**
- `src/lib/install.js` — convierte kit + selección en `install.ps1` / `install.sh` / preview de `.mcp.json`. Los scripts son aditivos e idempotentes.
- `src/components/KitView.jsx` — UI de kits: selección de items y salida del instalador.
- `src/db/favorites.js` — favoritos persistidos con `idb`.
- `src/components/TokenSetup.jsx` — el usuario pega su propio PAT de GitHub; Claude no maneja tokens.

## Notas

- Sin token la API de búsqueda de GitHub limita a ~10 consultas/minuto (403 al pasarse); con PAT sube a 30/min.
