# Proposal

## Why

El pipeline actual es de un solo salto: al 85% del presupuesto enmascara **todas**
las salidas viejas de herramientas y, si eso no alcanza, compacta **todo** el
historial. Es binario: o no pasa nada, o se pierde mucho de golpe. Y el aviso llega
tarde, cuando el contexto ya está por romperse.

El Nivel 6 propone lo contrario: reducir por etapas, de menor a mayor pérdida, y
empezar por lo barato y reversible.

## What Changes

- Cinco umbrales configurables sobre el presupuesto, con valores por defecto:
  70% avisar, 80% enmascarar, 85% podar, 90% resumir un bloque, 99% compactar todo.
- El enmascarado pasa a ser selectivo: solo resultados viejos y grandes, con una
  marca que dice cómo recuperarlos.
- Etapa nueva de poda: elimina pasos de solo lectura cuyos resultados ya están
  enmascarados y que no produjeron texto. Nunca toca mensajes del usuario ni el
  paso actual, y respeta la atomicidad entre llamada y respuesta.
- El resumen por bloques reemplaza solo el bloque más antiguo, antes de compactar
  todo el historial.
- El umbral de aviso informa sin modificar el historial y no se repite en cada paso.
- Una configuración de umbrales desordenada falla el arranque.
- El panel de contexto muestra la etapa aplicada y cuánto se recuperó.
- Fuera de alcance: resumen con una llamada al modelo (la compactación actual es
  determinista), recordatorios de sistema y enmascarado con restauración desde
  memoria.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `context`: el recorte y la compactación pasan a ser por etapas, con umbrales
  configurables, poda de pasos y visibilidad de la etapa aplicada.

## Impact

- Código: `src/context/budget.ts`, `trimming.ts`, `pipeline.ts`, `compaction.ts`,
  `src/provider/config.ts`, `src/interface/`.
- Pruebas: `tests/context/` (se amplía).
- Documentación: `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`,
  `PREGUNTAS.md`, `alcance/nivel-6-contexto-fino.md`.
- Sin dependencias nuevas.
