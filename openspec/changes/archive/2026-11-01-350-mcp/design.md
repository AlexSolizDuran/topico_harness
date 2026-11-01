# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- El registro de herramientas es datos: nombre, esquema, acción de permiso,
  metadato de paralelo y ejecución.
- El provider recibe el esquema de las herramientas habilitadas en el turno.
- El portero evalúa acciones y recursos; una herramienta puede declarar un motivo
  de riesgo que la eleva a aprobación obligatoria.
- Un agente solo recibe las herramientas que declara su definición.
- La configuración del proyecto se versiona sin secretos y lee credenciales por
  nombre de variable de entorno.

## Goals / Non-Goals

**Goals:**

- Sumar herramientas externas sin escribir código nuevo por integración.
- No llenar el contexto con esquemas de servidores que no se usan.
- Aislar fallos y efectos de un servidor externo.
- Mantener el principio de menor privilegio por agente.

**Non-Goals:**

- Transporte remoto, OAuth o servidores alojados.
- Cargar todas las herramientas de todos los servidores al arrancar.
- MCP como fuente de prompts o recursos, además de herramientas.
- Implementar el comportamiento en `src/` o agregar tests en este change.

## Decisions

**Conexión bajo demanda.** Conectar todos los servidores al arrancar envía decenas
de esquemas que el modelo no usa y llena el contexto. El servidor se conecta la
primera vez que el modelo lo necesita; sus herramientas aparecen en ese momento.

**Nombre con prefijo del servidor.** Dos servidores pueden exponer `search`. El
nombre visible incluye el servidor para que la herramienta sea única y para que el
modelo sepa de dónde viene. Alternativa descartada: nombres planos, que producen
colisiones y confusión.

**Orden estable mientras el servidor está conectado.** Las herramientas de un
servidor mantienen su orden para no invalidar el prefijo de la petición. Conectar
un servidor nuevo agrega un bloque al final, no reordena lo anterior.

**Permiso por acción, no por herramienta externa.** Se usa una acción propia con
el servidor y la herramienta como recurso. Sin regla aplicable se consulta; una
`permitir` ejecuta y una `denegar` bloquea. Una herramienta puede declarar un
motivo de riesgo y elevarse a aprobación obligatoria.

**Visibilidad explícita por agente.** Sin una declaración en la definición del
agente, no recibe herramientas MCP. Es el mismo principio de menor privilegio que
ya usa el harness para el resto de las herramientas.

**El resultado es texto y el fallo no rompe el turno.** El esquema lo declara el
servidor; el harness valida y convierte el resultado a texto. Un servidor caído o
lento devuelve un error como texto y se puede reintentar en otro turno.

**Sin secretos en la configuración versionada.** Las variables de entorno se
declaran por nombre. Un secreto literal en la configuración del proyecto falla al
arrancar, igual que la credencial del provider.

## Risks / Trade-offs

- [Un servidor lento demora el primer uso] → Solo se conecta cuando hace falta y
  tiene timeout.
- [Un servidor externo puede devolver contenido malicioso] → El resultado se
  trunca y se sanitiza; la herramienta puede elevarse a aprobación obligatoria.
- [Las herramientas aparecen a mitad de turno] → Se agregan al final del orden
  estable; el prefijo anterior no se reordena.
- [Un servidor deja procesos vivos] → Cierre al terminar la sesión y limpieza de
  procesos huérfanos.
- [El spec queda adelante del código] → El change de implementación y sus tests
  se derivan después; este change solo fija el contrato.

## Migration Plan

No hay migración. Sin servidores configurados, la capacidad no se activa y el
comportamiento actual sigue igual.
