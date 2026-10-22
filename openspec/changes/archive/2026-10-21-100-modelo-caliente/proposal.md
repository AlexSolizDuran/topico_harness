# Proposal

## Why

Una sesión queda atada al modelo con el que arrancó. Para comparar respuestas o
pasar a un modelo más barato hay que cerrar y perder el historial. El contrato no
dice nada sobre cambiar de modelo en caliente, así que hoy sería comportamiento
no escrito.

## What Changes

- Cambiar el provider o el modelo activo entre turnos, sin reiniciar el proceso.
- Conservar el historial al cambiar; el formato interno ya es agnóstico.
- Rechazar el cambio durante un turno en curso.
- No activar un provider o modelo desconocido, ni uno cuya credencial falte.
- Aplicar las capacidades del modelo nuevo: herramientas y ventana de contexto.
- Comando `/modelo` en la TUI para listar y cambiar; línea de estado con el modelo
  activo.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `provider`: se agrega el requisito «El modelo activo se puede cambiar entre
  turnos», con seis escenarios. No se modifica ningún requisito existente.

## Impact

- `src/provider/types.ts`: `readonly modelo: string` en `Proveedor`.
- `src/interface/runner.ts`: `cambiarModelo`, validación atómica y recálculo del
  presupuesto.
- `src/interface/input.ts` y `app-interactiva.tsx`: comando `/modelo` y estado.
- `src/provider/factory.ts`: resolución de provider/modelo por id.
- `tests/provider/` y `tests/interface/`: los seis escenarios nuevos.
- `openspec/config.yaml`: 44 requisitos y 122 escenarios.
