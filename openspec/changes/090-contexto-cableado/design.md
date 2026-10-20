# Design

## Context

Ver `proposal.md` — Why. `src/context/` expone `calcularTokensHistorial`,
`PresupuestoContexto`, `recortarSalidasHerramientasViejas` y
`compactarHistorial`. `turn.ts` consume `EventoProveedor` pero descarta el evento
`fin`, así que los `tokens` del provider nunca llegan a nadie.

## Goals / Non-Goals

**Goals:**

- Que el historial no supere el presupuesto en sesiones largas.
- Respetar las tres reglas: system intacto, atomicidad tool/resultado, última
  salida visible.
- Compactar una sola vez por turno.

**Non-Goals:**

- Compactación semántica con el modelo. El resumen heurístico actual alcanza.
- Persistencia del historial.
- Cambiar los valores por defecto (80%, 128k, 25 pasos).

## Decisions

### Momento del pipeline

```
turno termina
  ├─ medir tokens (provider o estimación)
  ├─ si se acerca al límite → recortar salidas viejas
  ├─ si sigue fuera del presupuesto → compactar una vez
  └─ guardar historial resultante
turno siguiente
  └─ validarEnvio; si excede, no se envía y se muestra un aviso
```

Compactar al final y no entre pasos es lo que exige el requisito. El recorte es
barato y sí puede correr antes de compactar.

### Tokens del provider

`consultarProveedor` captura el último evento `fin.tokens` del turno y lo
devuelve en `EstadoTurno.tokens`. No se suman pasos: el conteo representa el
tamaño del contexto en ese momento, no el costo acumulado. Si el provider no
reporta, `calcularTokensHistorial` estima con `length / 4` y marca `esEstimado`.

### Ventana por modelo

`SesionInteractiva` recibe `ventanaContexto` en sus opciones. En `100` ese valor
se recalcula al cambiar de modelo. `PresupuestoContexto` se construye una vez por
sesión y se reemplaza cuando cambia la ventana.

### Credenciales al turno

`runner.ts` pasa `credencialesSanitizar: [apiKey]` a `ejecutarTurno`. `dispatch.ts`
ya sanitiza el mensaje de error antes de devolverlo; hoy recibe un array vacío.

### Errores de presupuesto

`validarEnvio` tira `ErrorPresupuestoExcedido`. `runner.ts` lo atrapa y lo
convierte en un aviso visible; no se envía la petición y el turno no arranca.

## Risks / Trade-offs

- [La compactación pierde detalle] → el resumen se marca como automático y
  conserva rutas y decisiones; las salidas recientes no se tocan.
- [El conteo del provider llega solo al final del stream] → durante el turno se
  usa la estimación; el valor exacto se aplica al terminar.
- [Compactar de más encarece el turno siguiente] → solo se compacta si el recorte
  no alcanza y solo una vez.
- [Historial con `system` en el medio] → `compactarHistorial` ya preserva el
  `system` inicial; el resumen se inserta después de ese prompt.
- [Un error al compactar rompe el turno] → se captura y se deja el historial sin
  compactar; el turno ya terminó y el usuario puede seguir.
