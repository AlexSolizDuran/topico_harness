# Design

## Context

Ver `proposal.md` — Why. `SesionInteractiva` guarda el provider en un campo
privado y lo usa en cada turno. La factory de `070` resuelve un provider por
config. `PresupuestoContexto` se construye en `090` con la ventana del modelo.

## Goals / Non-Goals

**Goals:**

- Cambio atómico: si algo falla, la sesión sigue con el modelo anterior.
- Historial intacto y reutilizable por el modelo nuevo.
- Que el comando viva en la interfaz y la decisión en la sesión.

**Non-Goals:**

- Fallback automático por error o por costo.
- Comparar dos modelos en paralelo.
- Cambiar de modelo en medio de un turno.
- Migrar el historial a otro formato.

## Decisions

### `Proveedor` expone `modelo`

Se agrega `readonly modelo: string` al contrato interno. No es un tipo de
proveedor: es un dato genérico que la interfaz muestra y que el presupuesto usa
para buscar la ventana. Alternativa descartada: guardar el modelo aparte en la
sesión, que duplica el estado y se desincroniza.

### Cambio atómico en la sesión

```
cambiarModelo(proveedorId, modeloId)
  ├─ si turnoEnCurso → error, nada cambia
  ├─ factory.resolver(proveedorId, modeloId)
  ├─ obtenerCredencial(config.variableApiKey)
  ├─ instanciar adaptador
  ├─ reemplazar provider y presupuesto
  └─ notificar a la interfaz
```

Si falla cualquier paso, el provider y el presupuesto anteriores quedan como
estaban. Alternativa descartada: cambiar el campo y validar después, que deja la
sesión en un estado a medio configurar.

### El comando lo parsea la interfaz, lo ejecuta la sesión

`input.ts` reconoce `/modelo` y produce la acción `cambiarModelo` con sus
argumentos. La TUI llama a `sesion.cambiarModelo(...)`. Así se respeta «la
interfaz no contiene lógica de negocio»: reconoce sintaxis, no decide.

- `/modelo` sin argumentos → lista los modelos configurados.
- `/modelo proveedor/modelo` → cambia.
- Cualquier otro texto → pedido normal.

### Capacidades del modelo nuevo

Si `soportaHerramientas` es `false`, el adaptador no manda `tools` y el registro
queda inaccesible para ese turno. Si más adelante el modelo vuelve a soportarlas,
se vuelven a exponer.

### Presupuesto

Al cambiar, se reconstruye `PresupuestoContexto` con la `ventanaContexto` del
modelo nuevo. El historial no se recorta en el momento del cambio: se aplica el
pipeline normal al terminar el turno siguiente.

### Estado visual

`EstadoSesionVisual` agrega `modeloActivo: string` con formato `proveedor/modelo`.
La línea de estado lo muestra siempre, junto al indicador de turno.

## Risks / Trade-offs

- [El historial tiene tool calls de un formato que el modelo nuevo no entiende] →
  el adaptador traduce; si el modelo no soporta herramientas, el historial se
  conserva pero no se le ofrecen tools.
- [Cambiar a un modelo con ventana más chica deja el historial fuera de
  presupuesto] → el pipeline de `090` recorta y compacta al terminar el turno
  siguiente; el envío se bloquea si aun así excede.
- [Credencial presente pero inválida] → el cambio se acepta y el primer turno
  falla con `ErrorProveedor`; validar contra la API en el cambio agregaría una
  llamada de red inesperada.
- [El usuario cambia de modelo esperando continuidad semántica] → el historial es
  el mismo, pero el estilo cambia; es esperable, no un bug.
- [Listar modelos requiere leer la config] → la sesión expone `modelosDisponibles`
  desde la factory; la TUI solo lo muestra.
