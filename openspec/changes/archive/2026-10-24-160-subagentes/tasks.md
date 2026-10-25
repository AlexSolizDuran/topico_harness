# Tasks

## 1. Definiciones y modelo

- [x] 1.1 Agregar `modelo` opcional a la definición de agente y validarlo contra la
  configuración al arrancar; verificar «Un agente declara su modelo» y «Un modelo
  inexistente falla al arrancar».
- [x] 1.2 Rechazar al arrancar una definición de modo subagente que declare una
  herramienta de efecto; verificar «Una definición de subagente con escritura falla
  al arrancar».
- [x] 1.3 Impedir que un agente primario se lance como subagente; verificar «Un
  agente primario no se lanza como subagente».

## 2. Ejecución del hijo

- [x] 2.1 Crear el ejecutor del turno hijo con lista de mensajes propia, sin
  heredar el historial del padre; verificar «El hijo no hereda el historial del
  padre» y «El padre no ve los pasos intermedios».
- [x] 2.2 Consumir los eventos del hijo dentro del ejecutor y devolver solo el
  mensaje final, truncado como un resultado de herramienta; verificar «El padre
  recibe una respuesta, no un stream» y «Un resultado largo se trunca».
- [x] 2.3 Ejecutar el hijo sin la herramienta de delegación y rechazar una
  delegación anidada como texto; verificar los dos escenarios de profundidad.
- [x] 2.4 Entregar al hijo la intersección con las herramientas de lectura;
  verificar «Un agente lanzado no recibe escritura ni ejecución» y «Una llamada del
  hijo a escribir se rechaza como texto».
- [x] 2.5 Enlazar la cancelación del padre al hijo en un solo sentido; verificar
  «Cancelar el padre cancela al hijo» y «Cancelar al hijo no cancela al padre».
- [x] 2.6 Dar al hijo presupuesto, contador de pasos y provider por modelo propios;
  verificar los escenarios de límites y de modelo.

## 3. Herramienta de delegación

- [x] 3.1 Definir `task` con esquema `agent` y `prompt` obligatorios, limitado a
  los subagentes disponibles; verificar «La herramienta de delegación declara
  agente y pedido» y «Un argumento inválido vuelve como texto».
- [x] 3.2 Generar la descripción de la herramienta con el nombre y la descripción
  de cada subagente; verificar «El modelo elige el subagente por su descripción».
- [x] 3.3 Devolver como texto un subagente inexistente y excluir al agente activo
  de la lista; verificar sus dos escenarios.

## 4. Registro y composición

- [x] 4.1 Pasar la señal de cancelación al ejecutor de herramientas como segundo
  parámetro opcional, sin tocar las seis herramientas existentes.
- [x] 4.2 Registrar la delegación en el catálogo y dejar que el filtro del agente
  decida si viaja.
- [x] 4.3 Agregar el subagente de solo lectura por defecto; verificar «Sin archivo
  de agentes hay un subagente disponible» y «El subagente por defecto pide solo el
  resultado».

## 5. Interfaz

- [x] 5.1 Agregar un elemento visual de delegación con subagente, pedido y
  resultado; verificar «La delegación se distingue de una herramienta común» y «La
  delegación terminada muestra el resumen».
- [x] 5.2 No reenviar al padre el texto intermedio del hijo; verificar «El texto del
  hijo no aparece en el stream del padre».
- [x] 5.3 Mantener la marca en la salida línea a línea; verificar «La distinción se
  mantiene sin terminal».

## 6. Tests de los escenarios

- [x] 6.1 Tests de `subagents`: los 22 escenarios de la capacidad.
- [x] 6.2 Tests de los deltas de `agents`, `context`, `interface` y `tools`.
- [x] 6.3 Extender el test de dependencias para que `core/` no importe
  `subagents/`.

## 7. Cierre

- [x] 7.1 Correr `npm run check` y verificar lint, typecheck y tests en verde.
- [x] 7.2 Correr `openspec validate --all` y verificar el change.
- [x] 7.3 Actualizar `AGENTS.md` y `openspec/config.yaml` con la capacidad y los
  conteos nuevos.
