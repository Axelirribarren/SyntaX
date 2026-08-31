# Pendientes

Lo que quedó abierto, incluido lo sutil y lo que va a doler más adelante. Se escribe acá para que
no viva solo en la cabeza de quien lo notó.

Convención: **bloquea** = hay que resolverlo antes del próximo hito. **vigilar** = no urge, pero
empeora si se ignora.

---

## Identidad y publicación

| | Qué | Por qué importa |
|---|---|---|
| bloquea `npx` | **Verificar si `syntax` está libre en npm.** Sospecha fuerte de que no. Alternativas: scope (`@usuario/syntax`) o nombre propio. | Sin nombre publicable no hay `npx syntax doctor`, y ese comando de una línea es todo el mecanismo de adopción del producto. |
| bloquea `npx` | **`"private": true` en `package.json`.** Viene del producto anterior. | npm rechaza la publicación mientras esté. Se saca junto con la decisión de nombre. |
| vigilar | **Path anidado `SyntaX/SyntaX`.** | Cosmético, pero confunde a quien clona. Lo mueve el usuario: toca la carpeta de git. |
| vigilar | **`SyntaX` suelto en la raíz**: un PNG de 1672×941 sin extensión, ya commiteado. | O se le da nombre y lugar (`docs/assets/`), o se borra. Hoy es ruido en la raíz. |

## `doctor` — lo que le falta para ser el gancho

`--deep` ya está implementado: levanta cada server por stdio, pide `tools/list` y cuenta los
tokens de los schemas. En este repo el arranque pasó de ≈3.482 a ≈15.992 tokens — la parte que
faltaba era el 77% del total. Lo que queda:

| | Qué | Por qué importa |
|---|---|---|
| bloquea | **El tokenizador sigue siendo `chars/4`.** | Ahora pesa mucho más: los schemas son JSON, donde la aproximación subestima más. Los ≈15.992 son piso, no techo. Cambiarlo toca solo `src/doctor/tokenize.js`, pero hay que decidir tokenizador y modelo de referencia. |
| vigilar | **`--deep` no mide servers remotos (http).** Se declaran omitidos con su motivo. | Medirlos implica salir a la red con credenciales ajenas. Si se implementa, tiene que ser una decisión explícita de quien corre el comando, no el default. |
| vigilar | **La versión de protocolo MCP está fija en `2025-06-18`.** | Un server que solo hable una versión distinta puede rechazar el handshake y aparecer como caído sin serlo. Hay que probar contra servers viejos antes de confiar en ese diagnóstico. |
| vigilar | **`--deep` ejecuta comandos del repo auditado.** Avisa antes y está detrás del flag. | Si algún día `verify` corre en CI con `--deep`, eso significa ejecutar el `.mcp.json` de cada PR. Decisión de seguridad que hay que tomar a conciencia, no heredar por comodidad. |
| vigilar | **Runtime detectado pero vacío da un reporte inútil**: `sin objetos · ≈0 tokens · Sin hallazgos`. | Visto en un proyecto real. Debería decir por qué (`.claude/` existe pero no tiene skills ni MCP). |
| vigilar | **Sin check de permisos.** El objeto `permission` se lee pero nadie lo evalúa. | Un `allow` amplio junto a MCPs con capacidad de escritura es el hallazgo con consecuencias de seguridad, y es de los pocos que nadie más va a mostrar. |
| vigilar | **Exit code siempre 0.** | Deliberado hasta que exista `verify --strict`. Anotado para que nadie lo "arregle" antes de tiempo. |
| vigilar | **Los fixtures de test viven en `fixtures/`, fuera de `test/`.** | El runner de Node ejecuta *todo* lo que hay bajo `test/`, así que un fixture que espera stdin cuelga la suite entera. Ya pasó una vez. Si alguien agrega fixtures, van en `fixtures/`. |

## El registry de capabilities — el riesgo de repetir el error viejo

**`src/registry/capabilities.js` está curado a mano.** Es exactamente la mecánica que abandonamos:
alguien tiene que mantenerlo, y cubre solo lo que ya conoce. Hoy detecta tres colisiones porque
conoce esos providers; un equipo con otras herramientas no recibe ningún hallazgo.

Dos salidas, y hay que elegir antes de que el archivo crezca:

1. **Derivarlo del uso.** Cada `doctor` que corre aporta qué componentes conviven. La colisión se
   infiere en vez de declararse. Es el activo del que habla `direction.md`, pero requiere
   telemetría — decisión de producto, no técnica.
2. **Detectar solapamiento sin registry.** Comparar descripciones de skills entre sí y nombres de
   tools entre servers. Generaliza a componentes desconocidos, a costa de más falsos positivos.

Mientras tanto: **no engordar el archivo a mano más allá de lo que se verifica.** Si crece a
cincuenta entradas curadas, volvimos al catálogo.

## Correcciones a entradas anteriores de este backlog

**Digest ≠ pin.** Una versión previa de este documento describía el digest como sustituto del pin.
Está mal y ordenarlo cambió el diseño: un digest es **integridad** (*"¿esto cambió?"*), un pin es
**origen y versión** (*"¿cómo reinstalo lo mismo?"*). Confundirlos dejaría a un equipo convencido
de tener reproducibilidad cuando lo que tiene es detección de manipulación. Están en archivos
distintos a propósito: pin en `syntax.yaml`, digest en `syntax.lock`.

**El digest tampoco es integridad byte a byte.** Normaliza EOL, BOM y unicode de rutas, así que dos
árboles con bytes distintos pueden dar el mismo valor. Es deliberado —sin eso `verify` no serviría
en un equipo mixto— pero hay que decirlo así y no prometer los bytes exactos. Ver `digest.md`.

**El costo se sumaba entre runtimes.** `static-cost` hacía `flatMap` sobre todos los snapshots:
contaba 12 skills donde la unión real son 9, y sumaba `CLAUDE.md` junto con `AGENTS.md`. El titular
de ≈15.992 tokens estaba inflado por sumar dos entornos que nunca corren a la vez. Corregido: el
costo es por target. El número real de Claude Code es ≈14.887 y el de Codex ≈2.145.

## Contrato y manifest — deuda antes de `build`

| | Qué | Por qué importa |
|---|---|---|
| bloquea `build` | **`emit` no está implementado en ningún adapter.** Solo existe `read`. | El `supports` declarativo produce el reporte de pérdida, pero esa derivación nunca se ejerció contra una compilación real. La afirmación de que "migrar entre N runtimes no cuesta N²" está sin probar. |
| bloquea `build` | **El adapter de Codex lee TOML con una expresión regular.** | Alcanza para contar y comparar. Para *escribir* `config.toml` hace falta un parser de verdad. |
| bloquea `build` | **`mode: 'merge-markdown'` está declarado y no implementado.** | ¿Qué pasa cuando el proyecto ya tiene un `CLAUDE.md` escrito por una persona? Pisarlo es inaceptable. Los marcadores de `emit-docs.mjs` son una respuesta posible, pero hay que decidirlo. |
| bloquea `build` | **Los secretos no tienen mecanismo de resolución.** El schema exige `${secret}`, pero nadie define de dónde sale el valor: ¿`.env`? ¿keychain del sistema? ¿prompt interactivo? | Es la causa más común de instalación fallida y no está diseñado. |
| bloquea `accept` | **No existe el comando para actualizar la línea base.** Hoy la única forma de aceptar drift es `import --force`, que reescribe el manifest entero y pierde los `why`. | Aceptar drift tiene que ser deliberado *y* quirúrgico. Está nombrado (`accept`) para que no se invente otra cosa después. |
| vigilar | **`import` crea pero no fusiona.** Con `--force` se pierde todo lo escrito a mano, `why` incluido. | Es el mismo problema de `merge-markdown` en otra forma. Hasta que exista el merge, conviene no tocar el manifest a mano si se va a reimportar. |
| vigilar | **`scripts/emit-docs.mjs` es un segundo pipeline de compilación.** | Cuando `build` exista, tiene que absorberlo. Si no, quedan dos formas de generar documentación y van a divergir — el problema que el script existe para evitar. |

## La franja de skills — lo que quedó afuera

`import` y `verify` cubren skills. Antes de extenderlos:

| | Qué | Por qué importa |
|---|---|---|
| bloquea MCP | **Sanitización antes de serializar.** El manifest se commitea; serializar un `.mcp.json` tal cual escribiría credenciales en él. | Hoy la franja lo esquiva porque las skills no llevan `env`. Es lo primero a diseñar cuando entren los MCP. |
| vigilar | **"Las skills no tienen secretos" es un matiz, no un absoluto.** Una skill puede tener credenciales hardcodeadas en cualquier archivo. | La franja no serializa su contenido, así que el riesgo es bajo — pero hay que seguir sin imprimir contenido ni rutas sensibles en los reportes. |
| vigilar | **Los digests solo se probaron en Windows.** Los fixtures de EOL, unicode y symlinks corren donde se ejecuten los tests. | El symlink se saltea con `EPERM` en Windows sin modo desarrollador: ese caso hoy no se está verificando en ningún lado. Se cierra con CI en Linux. |
| vigilar | **Una extensión nueva en la allowlist del digest cambia los digests de ese formato.** | Exige bump del nombre del algoritmo y actualizar los vectores de `docs/digest.md`. Está escrito allá, pero es fácil de pasar por alto en un PR chico. |

## Legacy

**`src/legacy/` no tiene fecha de vencimiento, y eso es un problema conocido.** La condición de
borrado es concreta: cuando `build` porte el `applyPlan` de `apply-plan.mjs` (merge aditivo de
`.mcp.json`, clonado por repo, copia con backup), la carpeta entera se va.

Además **legacy quedó sin tests**: se recortaron al migrar. Es deliberado —no se extiende— pero
significa que si alguien lo toca, nada lo detecta.

## Proceso y equipo

| | Qué | Por qué importa |
|---|---|---|
| bloquea equipo | **No hay CI.** `npm test` y `npm run docs:check` corren solo en local. | El guard de drift de documentación no sirve de mucho si nadie lo corre antes de pushear. Es la primera cosa que un segundo integrante rompe sin querer. |
| vigilar | **La extensibilidad del contrato está sin probar.** Hay dos adapters y los escribió la misma persona el mismo día. | La afirmación "sumar un runtime es barato" recién se verifica cuando alguien más escriba el tercero sin tocar el núcleo. Hasta entonces es una hipótesis de diseño. |
| vigilar | **El `.mcp.json` de este repo mantiene la colisión de navegador a propósito**, igual que el drift entre `.claude/skills` y `.agents/skills`. | Es el fixture del dogfood. Está anotado en `AGENTS.md` para que nadie lo "arregle" en silencio y nos deje sin caso de demo. |

## Riesgos de producto

No son tareas, son cosas que hay que mirar de vez en cuando. El argumento completo está en
[`direction.md`](direction.md).

- **Convergencia.** `AGENTS.md` ya se estandarizó entre vendors. Si skills y MCP convergen
  también, la capa de traducción pierde razón de ser. La apuesta es que hooks, permisos y
  workflows no van a converger, porque ahí está la diferenciación de cada vendor. Si empiezan a
  converger, hay que replantear.
- **El comprador.** El individuo no paga por esto; paga un equipo que necesita entornos auditables
  entre editores distintos. Conviene validar ese comprador **antes** de construir `verify`, que es
  la pieza cara y la que solo tiene sentido para él.
- **Nada recolecta el activo todavía.** La matriz de compatibilidad y el corpus de fallas son lo
  que compone, y hoy cada `doctor` que corre se pierde. Sin resolver esto, cada ejecución vale
  una sola vez.
