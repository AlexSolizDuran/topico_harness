# Diseño 050-context: Presupuesto y Compactación de Contexto

## Arquitectura

El módulo `src/context/` proporciona los mecanismos de preservación de atención y contención de tokens:

```
src/context/
  ├── tokens.ts       <-- Conteo real del provider y estimación length / 4 con marca
  ├── budget.ts       <-- Control del presupuesto (80% de la ventana por defecto)
  ├── trimming.ts     <-- Enmascarado determínico de resultados viejos de herramientas
  ├── compaction.ts   <-- Compactación al final del turno y generación de resúmenes
  └── index.ts        <-- Exportaciones públicas del módulo
```

## Reglas Inviolables de Contexto

1. **El prompt del sistema es intocable:** Jamás se elimina, trunca ni compacta, incluso si el presupuesto está colapsado.
2. **Atomicidad de herramientas:** Un recorte o compactación jamás puede separar una solicitud de herramienta (`assistant`) de su resultado (`tool`). El corte se ajusta al límite del turno completo.
3. **Resumen marcado como automático:** Todo resumen inyectado lleva la cabecera:
   `[RESUMEN GENERADO AUTOMÁTICAMENTE - NO SON HECHOS VERIFICADOS]`.
4. **Decisiones antes que narrativa:** El resumen prioriza rutas, números de línea y hechos establecidos (`src/utils.ts:44`), omitiendo relatos de acciones pasadas.
5. **Compactación solo entre turnos:** El proceso de compactación se ejecuta estrictamente al final del turno cuando el modelo ha terminado su producción, respetando Prompt Caching.
