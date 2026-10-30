# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- `PresupuestoContexto` expone `limitePresupuesto` y un único
  `estaCercaDelLimite(tokens, 0.85)`.
- `aplicarPipelineContexto` recorta **todo** lo recortable y, si no alcanza, llama a
  `compactarHistorial` hasta ocho veces.
- `recortarSalidasHerramientasViejas` conserva el último resultado de herramienta y
  reemplaza el resto por una constante sin ruta.
- La compactación es **determinista**: `generarTextoResumen` extrae hechos con
  expresiones regulares, sin llamar al modelo.
- `validarHistorialAtomico` ya impide cortar entre una llamada y su respuesta.

## Goals / Non-Goals

**Goals:**

- Escalar de menor a mayor pérdida y detenerse en la primera etapa que alcance.
- Que lo barato y reversible ocurra primero, y lo caro solo si hace falta.
- Que la persona vea en qué etapa está el contexto antes de que se rompa.

**Non-Goals:**

- Resumen con una llamada al modelo: la compactación actual es determinista y este
  change no la cambia.
- Restaurar contenido enmascarado desde memoria: se recupera releyendo la fuente.
- Recordatorios de sistema ("tras editar, corré las pruebas"), que son otro tema del
  Nivel 6.

## Decisions

**Los umbrales son fracciones del límite del presupuesto, no de la ventana.** El
límite ya es el 80% de la ventana; medir sobre él mantiene la relación que el
usuario ya conoce. Alternativa descartada: medir sobre la ventana, que haría que
70% signifique cosas distintas según el margen configurado.

**Se evalúa en orden y se corta en la primera etapa que alcance.** El pipeline sube
de etapa solo si la anterior no bajó del umbral. Alternativa descartada: aplicar
todas las etapas que correspondan, que perdería contexto de más.

**El enmascarado es selectivo: solo resultados viejos y grandes.** Un resultado de
menos de 1 KiB no libera espacio suficiente para justificar perderlo, y uno del paso
anterior todavía puede estar en uso. Alternativa descartada: enmascarar todo como
hoy, que es lo que produce el salto brusco.

**La marca dice cómo recuperar.** Se construye desde la llamada del asistente, que
está en el mensaje anterior: nombra la herramienta y el argumento. Sin eso,
enmascarar es una pérdida definitiva disfrazada de optimización.

**La poda elimina pasos, no turnos.** Un turno contiene mensajes del usuario, y el
spec prohíbe recortarlos. Un paso es el ciclo llamada-respuesta dentro del turno.
Solo se poda cuando todas sus llamadas son de solo lectura, sus resultados ya están
enmascarados o vacíos y el modelo no escribió texto: en ese punto el paso no aporta
nada que no se haya perdido ya. Alternativa descartada: podar turnos enteros, que
borraría el pedido original del usuario.

**El resumen por bloques reusa el extractor determinista.** El bloque más antiguo se
reemplaza por sus hechos, y el resto del historial queda intacto. La compactación
completa sigue siendo la última etapa. Alternativa descartada: agregar una llamada
al modelo en el 90%, que cambia el costo del pipeline y merece su propio change.

**El aviso se emite una vez por umbral y por turno.** Un aviso repetido en cada paso
es ruido y el modelo lo ignora. Se lleva un registro de umbrales avisados por turno.

**Una configuración desordenada falla el arranque.** Umbrales fuera de orden
producirían etapas que nunca se alcanzan o que se pisan. Es más barato fallar al
arrancar que depurar un pipeline que no escala.

## Risks / Trade-offs

- [La poda puede borrar el puntero a un archivo] → Solo poda pasos cuyos resultados ya están enmascarados; el puntero ya se había perdido en esa etapa.
- [Los umbrales agresivos cambian el comportamiento por defecto] → El pipeline sigue sin superar el límite duro y cada etapa queda visible en el panel.
- [El resumen determinista puede quedarse corto] → Es el mismo extractor que ya usa la compactación; si no alcanza, la etapa siguiente compacta más.
- [Más etapas significan más casos que probar] → Un test por escenario y un test de integración que recorre los cinco umbrales.

## Migration Plan

No hay migración. Sin configuración de umbrales, los valores por defecto aplican y
el pipeline se comporta de forma más gradual que hoy. Para volver al comportamiento
anterior alcanza con configurar los cinco umbrales en 85%.
