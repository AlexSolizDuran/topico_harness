# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- El pipeline de `context` tiene cinco umbrales y compacta al final del turno,
  pero no inyecta recordatorios. El objetivo original vive solo en el historial,
  así que una compactación puede borrarlo.
- `provider` arma cada petición con el prompt de sistema y el historial completo.
  Las herramientas se envían en el orden del registro; hoy no hay una garantía
  explícita de estabilidad.
- `tools` trunca el contenido de una herramienta a un máximo, pero no distingue
  una salida larga de una cola útil. La interfaz muestra el resultado truncado.
- La interfaz ya conserva el resultado de la herramienta que recibe del núcleo;
  este change separa explícitamente la vista del modelo de la vista humana.

## Goals / Non-Goals

**Goals:**

- Atacar la degradación por atención con recordatorios baratos y deterministas.
- Permitir que el provider reutilice el prefijo de la petición entre viajes.
- Entregar al modelo la señal de un log grande sin perder la salida completa para
  la persona.

**Non-Goals:**

- Generar recordatorios con una llamada al modelo.
- Cambiar los cinco umbrales ni el algoritmo de compactación.
- Implementar el comportamiento en `src/` o agregar tests en este change.
- Definir una política de caché concreta por provider: el contrato es la
  estabilidad del prefijo, no el nombre de la función de caché.

## Decisions

**Los recordatorios son mensajes de sistema, no del usuario.** Si se inyectan
como mensajes del usuario, el modelo los puede tomar como un pedido nuevo y el
historial deja de reflejar la conversación real. Como mensaje de sistema quedan
fuera de la atomicidad llamada-respuesta.

**El objetivo original se guarda fuera del historial compactable.** La
compactación reemplaza turnos; si el objetivo vive en el primer mensaje del
usuario, se pierde. Se conserva como un dato de la sesión y se reinyecta cuando
hace falta. Alternativa descartada: confiar en que el resumen conserve el
objetivo, que es justamente lo que falla en sesiones largas.

**Cada recordatorio tiene un disparador y un límite.** Se dispara después de una
edición, después de N pasos sin escritura y después de compactar. No se repite en
pasos consecutivos ni más de una vez por turno. Sin límite, el recordatorio se
convierte en ruido y el modelo lo ignora.

**La estabilidad del prefijo es un requisito, no una optimización opcional.** El
prompt de sistema va al inicio y no cambia dentro del turno; las herramientas van
en orden estable; el historial solo crece por agregado. La compactación ya ocurre
al final del turno, así que invalida el prefijo una vez y no en cada paso.

**La cola de shell es por comando.** Se guardan los últimos N caracteres de cada
ejecución por separado. Mezclar la cola de `npm test` con la de `git status`
convierte el error viejo en ruido y hace que el modelo depure el comando
equivocado. La marca dice cuánto se omitió y cómo obtener la salida completa.

**La interfaz conserva la salida completa.** El modelo necesita la señal; la
persona necesita el volumen. Son dos vistas del mismo resultado y no deben
confundirse. Si la interfaz solo mostrara la cola, se perdería información que el
humano sí puede procesar.

## Risks / Trade-offs

- [Un recordatorio frecuente distrae] → Se limita a una vez por turno y a pasos
  no consecutivos.
- [La cola puede ocultar el primer error de un log] → La marca indica que hay
  contenido omitido y la interfaz conserva la salida completa; el modelo puede
  pedir un tramo concreto.
- [La estabilidad del prefijo restringe cambios de agente] → El cambio de agente
  ya ocurre entre turnos; el prefijo se invalida una vez y vuelve a ser estable.
- [El spec queda adelante del código] → El change de implementación y sus tests
  se derivan después; este change solo fija el contrato.

## Migration Plan

No hay migración. Los specs cambian y el comportamiento actual sigue igual hasta
que se implemente. Para volver atrás alcanza con descartar el change.
