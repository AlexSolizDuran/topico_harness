# Design

## La acción se resuelve por llamada, no por herramienta

Hasta ahora `accionPermiso` era estática: la herramienta `shell` siempre era
`shell`. Para que una misma herramienta tenga dos políticas hace falta que el
catálogo pueda resolver la acción con los argumentos en la mano.

`EntradaHerramienta` gana un `resolverAccion?(args)`. El portero lo consulta
antes de `accionPermiso`:

```
accion = herramienta.resolverAccion?.(args) ?? herramienta.accionPermiso ?? 'read'
```

Es opcional, así que ninguna herramienta existente cambia.

## Por qué una acción nueva y no un recurso con `&&`

El portero compara patrones. Si la acción siguiera siendo `shell`, la regla base
`permitir` con recurso `*` aprobaría cualquier línea compuesta sin preguntar. Con
una acción propia, la base puede decir `consultar` para todas las líneas
compuestas y `permitir` para las simples, sin tocar los patrones.

`normalizarAccionPermiso` mapea una acción desconocida a `read`. Por eso
`shell_compuesto` tiene que entrar en `MAPA_ACCIONES`: sin esa entrada, el
`solicitarAprobacion` registraría la aprobación con la acción equivocada.

## Segmentación

`dividirSegmentos` recorre la línea carácter por carácter, respeta comillas
simples y dobles, escapes con `\` y parte en `;`, `|`, `||`, `&` y `&&`. Antes de
partir neutraliza `2>&1` y `>&2`, que son redirecciones y no separadores.

Cada segmento se valida con la misma función que antes validaba la línea entera:
nombre del binario contra el catálogo y la lista negra. El primer segmento
prohibido corta la validación y devuelve el error; no se ejecuta nada.

## Intérpretes con código

`bash -c "…"` no tiene operadores visibles, así que la segmentación no lo
detecta. Se mira el binario y sus banderas: `-c` para `bash`, `sh`, `zsh`,
`dash`, `python` y `python3`; `-e`, `--eval`, `-p`, `--print` para `node`; `-e`
para `perl` y `ruby`; `-r` para `php`. No se incluye `bash -e`, que es errexit.

El contenido de `-c` no se analiza: se aprueba la línea entera como compuesta.
Es coherente con el modelo de permisos, que autoriza operaciones y no analiza
semántica de shell.

## Windows

La composición se rechaza con el mensaje de siempre. PowerShell 7 acepta `&&`,
pero Windows PowerShell 5 no, y `|` encadena objetos, no texto. Implementar las
dos sintaxis sin CI de Windows sería una promesa sin verificación.

## `directorio`

Se resuelve con `resolverRutaSegura`, la misma función que usan `read` y `edit`,
así que una ruta que escapa del proyecto se rechaza. Después se verifica que
exista y que sea un directorio. Sin `directorio`, el cwd es la raíz del proyecto.

## Lo que este change no resuelve

- Redirecciones: `echo x > /etc/y` sigue permitido. Ya lo estaba con un comando
  simple; el catálogo no es un sandbox.
- Aprobar «siempre» un compuesto guarda el patrón del primer binario, así que
  habilita ese binario para futuras líneas. Es el mismo criterio que ya usa el
  comando simple.
