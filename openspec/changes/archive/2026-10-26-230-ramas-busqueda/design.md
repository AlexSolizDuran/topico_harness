# Design

## Ramas

`AlmacenSesiones.ramificar(id, desdeTurno)` reproduce los registros de la sesión
original y se detiene después del turno `desdeTurno`:

```ts
let turnos = 0
for (const registro of registros) {
  if (turnos >= desdeTurno) break
  if (registro.tipo === 'turno') turnos++
  hasta.push(registro)
}
```

Así una compactación anterior al corte se aplica y una posterior no. El historial
resultante se guarda como una única `compactacion` en la sesión nueva, que además
lleva `padre` y `desdeTurno` en sus metadatos. La original no se toca.

`SesionInteractiva.ramificar(n)` crea la rama y la adopta reutilizando el mismo
camino que `cambiarSesion` (modelo, agente, métricas e historial visual).

## Búsqueda

`AlmacenSesiones.buscar(texto)` recorre las sesiones, arma un texto plano con
contenido, resultados y llamadas de cada mensaje, y cuenta ocurrencias sin regex.
Devuelve `{ sesion, coincidencias, fragmento }` ordenado por actualización. Un
registro corrupto se saltea; no rompe la búsqueda entera.

## Interfaz y CLI

- `/rama <n>` en la TUI.
- `/sesiones buscar <texto>` reutiliza el panel de sesiones con otro título.
- `--rama-de <id> --desde <n>` crea la rama al arrancar y la usa como sesión
  inicial. Ambos son obligatorios juntos.
- La barra sigue mostrando el id de la rama activa.

## Pruebas

Un test por escenario, con almacén determinista (`ahora` y `generarId`) y TUI con
streams falsos como en `210`.
