# Spec del digest de skills — `syntax-skill-tree-v1`

Especificación normativa. La implementación vive en `src/manifest/digest.js` y los vectores del
final están verificados por `test/digest.test.js`.

Esta spec se escribió **antes** que el código porque el modo de falla es silencioso: si el digest
no es determinista entre plataformas, `verify` marca todo como modificado y el equipo desactiva la
función el primer día. No es hipotético — al inspeccionar este repo, git avisó que convierte LF a
CRLF la próxima vez que toque los archivos.

## Qué promete, y qué no

**Es integridad de contenido canónico, no de bytes.** El algoritmo normaliza finales de línea, BOM
y unicode de rutas, así que **dos árboles con bytes distintos pueden producir el mismo digest**.
Eso es deliberado: es lo que hace que `verify` sirva en un equipo con Windows, macOS y Linux.

> La promesa exacta: *representación canónica del contenido observado, ignorando las diferencias
> portables que define este algoritmo.*

**No es una versión.** Responde *"¿esto cambió?"*. No responde *"¿qué versión es?"*, *"¿hay una
más nueva?"* ni *"¿cómo lo reinstalo?"*. La resolución de origen llega después y **se suma** al
lock; no reemplaza al digest ni cambia su significado.

Si alguna vez hace falta auditoría forense byte a byte, se agrega un `rawDigest` aparte. No hace
falta hoy.

## Algoritmo

1. **Prefijo de dominio.** El hash arranca con `syntax-skill-tree-v1` seguido de un byte `0x00`.
   Así un digest de este algoritmo no puede confundirse con el de otro, ni con el de otro tipo de
   objeto.

2. **Recorrido.** Recursivo desde el directorio de la skill. Solo archivos regulares; los
   directorios vacíos no aportan nada al hash.

3. **Rutas.** Relativas al directorio de la skill, con `/` como separador, normalizadas Unicode a
   **NFC** — macOS descompone los nombres de archivo, Windows y Linux no.

   Si dos rutas distintas colisionan al normalizar, el digest es **no calculable** y se reporta.
   Elegir una en silencio haría que el resultado dependa del orden del filesystem.

4. **Orden.** Por los bytes UTF-8 de la ruta normalizada. **Nunca `localeCompare`**: depende del
   locale de quien corre el comando.

5. **Clasificación texto / binario.** Por **allowlist explícita de extensiones**. Todo formato que
   no esté en la lista se hashea crudo.

   La asimetría es la decisión más importante del algoritmo, porque **los dos modos de falla no
   son equivalentes**:

   | Error | Consecuencia |
   |---|---|
   | Texto desconocido tratado como binario | `modified` falso por EOL — molesta, pero **falla a la vista** |
   | Binario tratado como texto | oculta una diferencia real — **falla en silencio** |

   Por eso **no** se usa un heurístico como buscar `0x00` en los primeros 8 KB: se equivoca justo
   en la dirección peligrosa, porque un binario puede no tener NUL al principio y sí contener
   secuencias CRLF que la normalización destruiría.

   Extensiones de texto reconocidas (`src/manifest/digest.js`): `bash` `c` `cfg` `cjs` `cpp` `css`
   `csv` `h` `htm` `html` `ini` `java` `js` `json` `jsonc` `jsx` `lua` `markdown` `md` `mjs` `mts`
   `php` `pl` `py` `rb` `rs` `scss` `sh` `sql` `svg` `toml` `ts` `tsv` `tsx` `txt` `xml` `yaml`
   `yml` `zsh`

   Un archivo sin extensión se trata como binario.

6. **Canonicalización.** Solo para archivos de texto: se quita el BOM UTF-8 inicial si está, y
   `\r\n` y `\r` sueltos se convierten a `\n`. Los binarios se hashean tal cual.

7. **Acumulación.** SHA-256 incremental. Por cada archivo, en orden:

   ```
   ruta_utf8  0x00  longitud_decimal_ascii  0x00  contenido
   ```

   La longitud es la del contenido **ya canonicalizado**, escrita como decimal ASCII (por ejemplo
   `17` son los bytes `0x31 0x37`). Está para que un corrimiento entre el límite de ruta y el de
   contenido no pueda producir el mismo hash.

8. **Resultado.** `sha256:` seguido del hash en hexadecimal minúscula.

## Ignorado explícitamente

Permisos, timestamps, y el orden en que el filesystem devuelve las entradas.

## Symlinks

**No se siguen.** Una entrada symlink en cualquier nivel deja el digest **no calculable**, y
`verify` lo reporta como hallazgo.

Seguirlos permitiría que una skill referencie archivos fuera del proyecto. Saltearlos en silencio
sería peor: haría que Windows y Unix vean inventarios distintos del mismo repo.

La detección usa **`lstatSync`**, no el `Dirent` de `readdirSync`. Está verificado que el `Dirent`
no es confiable acá: en Git Bash sobre Windows un enlace a directorio aparece como directorio común
(`isDirectory: true`, `isSymbolicLink: false`).

## Vectores de prueba

Verificados por `test/digest.test.js`. Una reimplementación tiene que dar exactamente esto.

| Caso | Contenido | Digest |
|---|---|---|
| Directorio vacío | — | `sha256:0b020c8f84485bc00b52623e77464bf45efcac012026a941532e608bdf01cdbf` |
| `SKILL.md` con LF | `---\nname: x\n---\n` | `sha256:ee0eb0e368c81a5d7e02d1eb6294c31c275560cbc76ab6d74d2a0c2915cb8918` |
| `SKILL.md` con CRLF | `---\r\nname: x\r\n---\r\n` | **idéntico al anterior** |
| `SKILL.md` con BOM + LF | `EF BB BF` + LF | **idéntico al anterior** |
| Dos archivos | `SKILL.md` = `a\n`, `ref/b.md` = `b\n` | `sha256:c6c89c5924c6557dbdc4addfc6d70540976f9c386aff6bd42771073dce3e9312` |
| Binario con CRLF | `a.bin` = `01 0D 0A 02` | `sha256:2b166d4e9fdb498c813e8b3ca73e0d119155ab0d278e3c0a39c4491c5458867f` |
| Binario con LF | `a.bin` = `01 0A 02` | `sha256:45c5f9ff84dd8cb59d1396c883f2e64d7c96a6b6186e6a1dea058b7465b71085` |

Los últimos dos son el par que justifica la allowlist: **como binarios, sus digests difieren**. Si
`.bin` se tratara como texto, los dos colapsarían al mismo valor y una diferencia real quedaría
invisible.

## Cambiar el algoritmo

El nombre `syntax-skill-tree-v1` está dentro del hash y también en `syntax.lock` como
`digestAlgorithm`. Cualquier cambio de comportamiento —una extensión nueva en la allowlist incluida,
porque cambia cómo se canonicaliza ese formato— exige **bump del nombre**, actualizar los vectores
de esta página, y que `verify` avise cuando el lock trae un algoritmo que no es el vigente en vez
de comparar digests incomparables.
