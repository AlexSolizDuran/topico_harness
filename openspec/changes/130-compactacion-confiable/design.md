# Design

## Context

`SesionInteractiva` valida el presupuesto solo antes de empezar un turno. El
núcleo ejecuta todos los pasos con el historial que crece y no conoce
`PresupuestoContexto`. El pipeline de fin de turno recorta una vez y compacta una
vez; si el historial sigue fuera del límite, el siguiente envío queda bloqueado
sin un camino de recuperación.

## Goals / Non-Goals

**Goals:**

- No enviar nunca una petición por encima del presupuesto.
- Recortar resultados viejos antes de cada paso cuando haga falta.
- Compactar al final del turno hasta quedar bajo el límite o declarar que no se
  puede.
- Mantener un solo resumen automático.
- Exponer métricas para la interfaz.

**Non-Goals:**

- Resumir con una llamada adicional al modelo. El resumen sigue siendo
  determinista y verificable.
- Cambiar la política del 80% ni los valores por defecto.
- Persistir el historial entre procesos.

## Decisions

### Preparación inyectada antes de cada petición

`core/turn.ts` acepta una función opcional `prepararHistorial` que recibe el
historial actual y devuelve los mensajes que se enviarán, o un error. El núcleo no
importa `context/`; la sesión inyecta la función. Si la función recorta, el
historial se sincroniza en el lugar para que el estado final del turno use la
misma versión.

Alternativa descartada: hacer que `core` importe `PresupuestoContexto`. Rompe la
dirección de dependencias y mezcla el bucle con la política de contexto.

### Recorte entre pasos, compactación al final

Antes de cada petición se mide el historial sin usar el conteo viejo del provider.
Si está cerca del límite, se recortan resultados viejos de herramientas. Si aun
así supera el límite, el paso falla con un mensaje que explica el presupuesto. La
compactación por resumen sigue ocurriendo solo al final del turno, como exige el
spec.

### Compactación repetida y acotada

El pipeline repite `compactarHistorial` mientras el historial siga fuera del
límite, haya progreso y no se supere un máximo de iteraciones. Si no hay progreso,
devuelve el historial y marca que el presupuesto no se pudo satisfacer. El turno
ya terminó; el aviso queda visible y el siguiente envío se bloquea con el mismo
mensaje.

### Un solo resumen

`compactarHistorial` separa el prompt del sistema del resumen automático. Todos
los resúmenes anteriores se eliminan del historial y su contenido se incorpora al
nuevo resumen. El resultado tiene como máximo un mensaje con el encabezado
`[RESUMEN GENERADO AUTOMÁTICAMENTE - NO SON HECHOS VERIFICADOS]`.

### Métricas

`context/metrics.ts` calcula ventana, límite, uso actual, disponible, mensajes,
consumo acumulado y la última compactación. `SesionInteractiva` las expone en
`EstadoSesionVisual.contexto`; la interfaz solo las muestra.

## Risks / Trade-offs

- [El recorte entre pasos cambia el historial que ve el modelo] → solo reemplaza
  resultados viejos por la marca de recorte; conserva usuario, asistente y el
  último resultado.
- [Un turno puede fallar antes de terminar] → es preferible a enviar una petición
  que el provider va a rechazar o que degrada la respuesta.
- [El resumen determinista no reemplaza a un resumen generado por el modelo] → se
  documenta como limitación; conserva hechos observados y no inventa.
- [Más métricas pueden quedar obsoletas] → se recalculan después de cada turno,
  compactación y cambio de modelo.

## Migration Plan

No hay migración de datos. Al archivar, el delta de `context` reemplaza los dos
requisitos modificados y conserva los escenarios existentes. La interfaz consume
las métricas nuevas en el change `140-tui-interactiva`.
