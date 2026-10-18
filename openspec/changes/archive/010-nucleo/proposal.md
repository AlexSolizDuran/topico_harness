# Propuesta 010-nucleo: Bucle de Ejecución del Agente y Orquestación

## Motivación y Contexto
El núcleo (`core`) es el bucle central que orquesta la interacción entre el usuario, el modelo de lenguaje (`provider`) y las herramientas (`tools`). Transforma un LLM pasivo en un agente autónomo iterativo. Debe gestionar el historial de forma atómica, despachar herramientas basándose en datos y esquemas Zod/JSON, convertir cualquier error de ejecución en texto para permitir la auto-corrección, aplicar límites de pasos (por defecto 25), manejar cancelación mediante `AbortController` y garantizar el total desacoplamiento de la interfaz gráfica/terminal.

## Requisitos de `openspec/specs/core/spec.md` implementados
1. **El bucle itera hasta que el modelo termina sin pedir más herramientas**
2. **El historial es atómico y un resultado siempre sigue a su mensaje**
3. **Las herramientas se despachan contra un registro de datos**
4. **Los argumentos se validan contra el esquema antes de ejecutar**
5. **Un error de ejecución vuelve al modelo como texto**
6. **El límite de pasos interrumpe y devuelve el estado**
7. **La cancelación interrumpe la petición en vuelo**
8. **Todo turno termina en uno de tres estados consistentes**
9. **El núcleo no depende de la interfaz**

## Alcance
- Definición de tipos de estado de turno (`EstadoTurno`) en `src/types.ts`.
- Módulo `src/core/turn.ts` con el bucle asíncrono generator `ejecutarTurno`.
- Módulo `src/core/registry.ts` con el registro dinámico de herramientas basado en datos.
- Módulo `src/core/history.ts` para construcción y validación atómica del historial de mensajes.
- Módulo `src/core/dispatch.ts` para validación de argumentos y captura de errores como texto sanitizado.
- Tests completos en `tests/core/core.test.ts` que cubren los 23 escenarios normativos de `core/spec.md`, incluyendo el test estático que valida que `src/core/` no importa nada de `interface/`.
