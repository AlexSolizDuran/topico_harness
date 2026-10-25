# Proposal

## Why

Investigar en el agente principal tiene un costo que no se paga con más contexto:
leer veinte archivos llena el historial de contenido que ya no sirve y degrada al
modelo. La compactación lo mitiga después; delegar lo evita antes.

Un subagente es la alternativa barata a la compactación: el trabajo grande ocurre
en otro contexto, y el padre recibe una línea. Sin este change, cada investigación
compite por el mismo presupuesto que la tarea real.

`150-agentes` ya dejó los perfiles como dato y definió el modo subagente, pero nada
lo lanza todavía. Ese modo queda inerte hasta que exista la delegación.

## What Changes

- Una herramienta de delegación que recibe un subagente y un pedido, ejecuta un
  turno hijo y devuelve su respuesta final como texto.
- Contexto aislado: el hijo arranca con el pedido, no con el historial del padre.
- Resultado único: el padre ve una llamada y un resultado, no el stream del hijo.
- Profundidad uno: el hijo corre sin la herramienta de delegación.
- Solo lectura: el hijo no escribe ni ejecuta, aunque su definición lo declare.
- Cancelación del padre propagada al hijo, y no al revés.
- Presupuesto, límite de pasos y modelo propios del hijo.
- La interfaz distingue la delegación de una herramienta común y muestra el nombre
  del subagente.
- Sin configuración, un subagente de solo lectura disponible desde el primer
  arranque.

## Capabilities

### New Capabilities

- `subagents`: delegación, contexto aislado, resultado único, profundidad,
  solo lectura, cancelación, presupuesto y modelo del hijo.

### Modified Capabilities

- `agents`: el modelo por agente; solo los modos subagente y ambos se lanzan; un
  modelo inexistente invalida la definición.
- `context`: el presupuesto del hijo es independiente del padre.
- `interface`: la delegación se distingue y no vuelca el stream del hijo.
- `tools`: la herramienta de delegación declara su esquema.

## Impact

- `openspec/specs/subagents/spec.md` (nuevo).
- `src/subagents/` (nuevo): ejecución del turno hijo y definición de la herramienta.
- `src/agents/`: modelo opcional y validación de herramientas de efecto.
- `src/core/registry.ts`: el ejecutor de una herramienta recibe la señal de
  cancelación (segundo parámetro opcional).
- `src/app.ts`: registrar la delegación en el catálogo.
- `src/interface/`: elemento visual de delegación y su render en terminal y en
  línea a línea.
- `tests/subagents/` y los tests de los deltas.

`core/` no cambia: el turno hijo usa el mismo bucle.

## Dependencia

`160` se apoya en `150-agentes`, que todavía no está implementado. Este change
puede especificarse antes; implementarlo requiere que `150` exista en `src/`.
