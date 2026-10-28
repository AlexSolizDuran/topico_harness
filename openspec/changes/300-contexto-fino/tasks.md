# Tasks

## 1. Umbrales

- [ ] 1.1 Reemplazar `estaCercaDelLimite` por una evaluación por etapas en `PresupuestoContexto`, con los valores por defecto 70/80/85/90/99 sobre el límite; verificar el escenario de valores por defecto y que el límite duro no cambia.
- [ ] 1.2 Leer los umbrales del config y fallar el arranque si no son estrictamente crecientes; verificar el escenario de configuración desordenada.

## 2. Enmascarado selectivo

- [ ] 2.1 Recortar solo resultados que superen el tamaño mínimo y no pertenezcan al último paso; verificar el escenario de salida pequeña conservada.
- [ ] 2.2 Construir la marca con la herramienta y el argumento de la llamada original; verificar los escenarios de marcador recuperable.

## 3. Poda

- [ ] 3.1 Implementar la poda de pasos de solo lectura con resultados enmascarados o vacíos y sin texto del modelo; verificar los escenarios de paso podado y de paso con edición.
- [ ] 3.2 Preservar la atomicidad llamada-respuesta y no tocar el paso en curso; verificar los dos escenarios correspondientes.

## 4. Resumen por bloques

- [ ] 4.1 Resumir solo el bloque más antiguo al alcanzar el umbral de resumen y conservar el resto; verificar el escenario de bloque resumido antes de compactar todo.
- [ ] 4.2 Compactar el historial completo solo en el umbral de compactación, manteniendo las garantías existentes; verificar los escenarios de turnos recientes y de resumen no duplicado.
- [ ] 4.3 Conservar el historial intacto e informar cuando el resumen de un bloque falla; verificar el escenario de resumen fallido.

## 5. Visibilidad y cierre

- [ ] 5.1 Emitir el aviso del umbral una sola vez por turno; verificar los dos escenarios de aviso.
- [ ] 5.2 Exponer la etapa aplicada y los tokens recuperados en las métricas y en el panel de contexto; verificar los dos escenarios de visibilidad.
- [ ] 5.3 Actualizar `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`, `PREGUNTAS.md` y `alcance/nivel-6-contexto-fino.md`; verificar que las cifras coinciden con los specs.
- [ ] 5.4 Ejecutar `npm run check` y `openspec validate --all`; verificar que ambos terminan en verde.
- [ ] 5.5 Archivar el change con `openspec archive`; verificar que `openspec list` no muestra changes activos.
