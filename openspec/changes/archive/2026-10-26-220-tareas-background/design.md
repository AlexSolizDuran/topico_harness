# Design

## Gestor

`src/subagents/background.ts` mantiene un mapa de tareas:

```ts
interface TareaBackground {
  id: string
  agente: string
  pedido: string
  estado: 'en_curso' | 'completada' | 'cancelada' | 'fallida'
  resultado?: string
  iniciadaEn: number
  terminadaEn?: number
}
```

Cada tarea tiene su `AbortController` y una promesa. El gestor expone
`iniciar`, `listar`, `obtener`, `cancelar`, `hayPendientes`, `esperarTodas`,
`consumirResultados` y `cancelarTodas`. El tope por defecto es 4.

La promesa captura cualquier excepción y la convierte en texto (`fallida`), porque
un background no puede tirar el proceso. Una tarea cancelada se marca `cancelada`,
no `fallida`.

## Herramientas

- `task` suma `background?: boolean`. La validación y el armado del pedido se
  extraen a una función para que el camino foreground y el background compartan
  exactamente las mismas reglas. Con background, el ejecutor del gestor llama a
  `ejecutarTurnoSubagente`; sin background, se espera como hoy.
- `task_status({ id? })`: `accionPermiso: 'read'`, `admiteParalelo: true`.
- `task_cancel({ id })`: `accionPermiso: 'subagent'`, `admiteParalelo: false`.

Ambas devuelven texto; un error de validación vuelve como `ERROR: ...`.

## Continuación del padre

Vive en `SesionInteractiva`, no en el núcleo. `src/core/` no sabe que hay tareas.

Al terminar una iteración de turno:

1. Si no hay tareas en curso, termina como siempre.
2. Si hay, agrega el aviso `Esperando N tarea(s) en background…`.
3. `await gestor.esperarTodas()`.
4. `gestor.consumirResultados()` devuelve un bloque con las tareas terminadas que
   todavía no se inyectaron, y las marca.
5. Ese bloque se agrega como mensaje de usuario y se ejecuta otra iteración.
6. Se repite hasta un máximo de 8 continuaciones; al llegar, se deja un aviso.

Cada iteración persiste su propia diferencia de mensajes antes de compactar, así
que la reproducción conserva el orden turno → compactación → continuación.

## Cancelación

`cancelar()` aborta el turno del padre y llama a `gestor.cancelarTodas()`. Las
tareas canceladas no se inyectan como éxito: su resultado es
`Tarea <id>: cancelada`. El gestor sobrevive al turno, así que una tarea lanzada en
un turno y todavía en curso se puede consultar o cancelar en el siguiente.

## Interfaz

`EstadoSesionVisual.tareasBackground` guarda el conteo. El gestor notifica al
cambiarlo y `BarraEstado` muestra `· N bg` cuando es mayor que cero. El aviso de
espera se agrega al historial visual.

## Pruebas

Un test por escenario. El gestor se prueba con ejecutores controlados por promesas
para observar el estado en curso, el tope y la cancelación. La continuación se
prueba con `ProveedorSimulado` y un gestor real.
