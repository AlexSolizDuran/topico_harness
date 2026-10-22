# Proposal

## Why

Las cuatro piezas de `context/` (tokens, presupuesto, recorte y compactación)
están implementadas y desconectadas: ni `turn.ts` ni `runner.ts` las invocan. El
requisito «La compactación ocurre al final de un turno» está especificado y hoy
no se cumple, así que una sesión larga crece sin límite hasta romper la ventana
del modelo.

## What Changes

- Medir tokens al terminar cada turno, usando el conteo del provider con
  respaldo estimado.
- Recortar salidas viejas de herramientas cuando el historial se acerca al
  límite.
- Compactar una sola vez, al final del turno y nunca entre pasos.
- Bloquear el envío si el historial supera el presupuesto.
- Recalcular el presupuesto con la ventana del modelo activo.
- Propagar el conteo de tokens que hoy se descarta en `turn.ts`.
- Pasar las credenciales a sanitizar al turno, para que un error de herramienta
  no filtre la clave.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Este change es `skip_specs`: materializa los nueve requisitos de
`context` y el de conteo de tokens de `provider`.

## Impact

- `src/interface/runner.ts`: pipeline de contexto antes y después del turno.
- `src/core/turn.ts`: capturar `tokens` del evento `fin` y devolverlos en
  `EstadoTurno`.
- `src/types.ts`: `tokens` opcional en `EstadoTurno`.
- `src/context/index.ts`: sin cambios de API; se empieza a consumir.
- `tests/context/` y `tests/core/turn`: tests de integración del cableado.
