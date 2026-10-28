# Design

## Principio

El código no decide qué es imposible. Decide qué es riesgoso y lo eleva a una
aprobación que no se puede saltar. La persona decide.

## Aprobación obligatoria

Una herramienta declara el motivo con un método opcional:

```ts
motivoAprobacionObligatoria?: (args) => string | undefined
```

El portero evalúa las reglas como hoy y después aplica este orden:

1. Si la regla que gana es `denegar`, deniega. Una denegación configurada sigue
   siendo la última palabra.
2. Si la herramienta declara un motivo, fuerza `consultar` con
   `obligatoria: true` y el motivo, aunque una regla `permitir` o una aprobación
   guardada dijeran lo contrario.
3. Si no hay motivo, devuelve el efecto calculado por las reglas.

`EvaluacionPermiso` y `SolicitudAprobacion` suman `obligatoria` y `motivo`. El
evento `espera_aprobacion` los transporta sin cambios.

En una aprobación obligatoria la interfaz solo ofrece aprobar una vez o denegar.
El portero normaliza un `siempre` inesperado a `una_vez` para que un cliente
viejo no pueda guardar una regla que saltee el control.

Sin cliente interactivo no hay aprobación posible: la operación se deniega, como
ya ocurre con cualquier `consultar`.

## Riesgo de una ruta

`src/tools/path.ts` se parte en dos:

- `resolverRuta(ruta, base)`: resuelve la ruta absoluta sin restricciones.
- `evaluarRiesgoRuta(ruta, base)`: devuelve `{ fueraDelProyecto, sensible }`,
  siguiendo symlinks con la misma lógica que la versión anterior.
- `motivoAprobacionRuta(ruta, base)`: arma el texto del motivo a partir del
  riesgo.

Las herramientas resuelven con `resolverRuta` y declaran el motivo con
`motivoAprobacionRuta`. La validación ya no vive en la ejecución: vive en el
portero, antes de ejecutar. `apply_patch` revisa todas las rutas del parche y
devuelve el motivo de la primera riesgosa.

## Análisis de la línea de `shell`

Un único analizador recorre la línea y devuelve:

```ts
interface AnalisisLinea {
  segmentos: string[]
  redirecciones: Redireccion[]
  compuesta: boolean
  noAnalizable?: 'heredoc' | 'herestring' | 'proceso'
  error?: string
}
```

Respeta comillas y escapes. Reconoce:

- composición: `;`, `&&`, `||`, `|`, `&` y salto de línea;
- redirección de escritura: `>`, `>>`, `>|`, `&>`, `&>>`, `<>`, `n>`, `n>>`;
- redirección de lectura: `<`, `n<`;
- duplicación de descriptor: `n>&m`, `n>&-`, `>&m`, `>&-`;
- heredoc, herestring y sustitución de proceso: `<<`, `<<-`, `<<<`, `<(`, `>(`.

`dividirSegmentos`, `contieneComposicion` y `esComandoCompuesto` se apoyan en ese
analizador. `dividirSegmentos` sigue devolviendo los segmentos sin redirecciones,
que es lo que necesita la validación por nombre.

### Acción por llamada

- línea compuesta o intérprete con bandera de código → `shell_compuesto`;
- línea con una redirección real → `shell_redireccion`;
- resto → `shell`.

Una línea que además tiene un motivo riesgoso conserva su acción, pero el portero
la vuelve obligatoria. La precedencia es `shell_compuesto` > `shell_redireccion` >
`shell`.

### Motivos

El orden es determinista y el primero que aparece gana:

1. sustitución de comandos (`$()`, backticks);
2. heredoc, herestring o sustitución de proceso;
3. comando de la lista negra;
4. comando fuera del catálogo;
5. redirección a un archivo;
6. intérprete con bandera de código;
7. composición en Windows;
8. `directorio` fuera del proyecto o sensible.

Una redirección sin destino no se rechaza: se marca como no analizable y se pide
aprobación. El shell devuelve su propio error si la línea no es válida.

`2>&1`, `n>&m`, `n>&-`, `> /dev/null` y `2>/dev/null` no cuentan como
redirección a un archivo.

## Lo que no cambia

- La lista negra y el catálogo siguen existiendo como datos por plataforma.
- El límite de pasos, la cancelación y el historial no se tocan.
- `glob` y `grep` no aceptan una ruta: siguen buscando en el proyecto.
- La credencial configurada se sigue redactando al persistir la sesión.

## Riesgo asumido

Aprobar `rm -rf /` lo ejecuta. Aprobar `cat .env` manda la credencial al modelo.
El harness deja de ser un muro y pasa a ser un portero que informa y pregunta. El
aislamiento real del sistema operativo es Nivel 7 y no entra acá.
