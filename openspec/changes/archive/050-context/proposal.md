# Propuesta 050-context: Gestión del Presupuesto de Contexto y Compactación

## Motivación y Contexto
En sesiones prolongadas o tareas complejas, el historial de mensajes acumula miles de tokens que encarecen la latencia y degradan la atención del modelo. Siguiendo `openspec/specs/context/spec.md`, este módulo implementa un presupuesto conservador de tokens (80% de la ventana por defecto), recorte previo de salidas de herramientas viejas (enmascarado a costo cero) y compactación estructurada al final del turno cuando el recorte no alcanza. Todo esto respetando las tres reglas inviolables: el prompt del sistema es intocable, nunca se rompe la correspondencia atómica de herramientas, y los resúmenes se marcan explícitamente como automáticos.

## Requisitos de `openspec/specs/context/spec.md` implementados
1. **El sistema mantiene un presupuesto de contexto con margen conservador**
2. **El presupuesto se alimenta del conteo del provider con respaldo estimado**
3. **Al acercarse al límite el sistema recorta salidas viejas de herramientas**
4. **Cuando el recorte no alcanza el sistema resume el historial**
5. **El resumen conserva decisiones concretas y no narrativa**
6. **El prompt del sistema nunca se descarta**
7. **El historial nunca se corta entre una herramienta y su respuesta**
8. **El resumen se marca como generado automáticamente**
9. **La compactación ocurre al final de un turno**

## Alcance
- Contador y estimador de tokens en `src/context/tokens.ts`.
- Gestor de presupuesto de ventana en `src/context/budget.ts`.
- Lógica de enmascaramiento y recorte de herramientas viejas en `src/context/trimming.ts`.
- Módulo de compactación y generación de resúmenes estructurados en `src/context/compaction.ts`.
- Integración del pipeline de contexto en `src/context/index.ts`.
- Suite de pruebas completa en `tests/context/context.test.ts` cubriendo los 21 escenarios normativos.
