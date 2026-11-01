# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- La herramienta de ejecución se resuelve contra un catálogo por plataforma y una
  lista negra. Ambos son etiquetas de riesgo, no un muro.
- Los permisos y las aprobaciones ya deciden si una operación se ejecuta, pero no
  limitan lo que el proceso puede hacer una vez que corre.
- Linux, macOS y Windows son plataformas soportadas. Linux y macOS ofrecen
  mecanismos de aislamiento del sistema operativo; Windows no tiene un equivalente
  portable en la v1.
- El resultado de la herramienta viaja al modelo como texto y la interfaz lo
  muestra; no hay un campo estructurado de aislamiento.

## Goals / Non-Goals

**Goals:**

- Poner un límite que no dependa de adivinar el comando.
- Limitar las escrituras al proyecto y a un temporal seguro por ejecución.
- Hacer visible cuándo el aislamiento no está disponible.
- Mantener el turno vivo cuando un comando choca con el límite.

**Non-Goals:**

- Worktrees o ramas por agente.
- Aislamiento de red, de lectura o de variables de entorno en esta capacidad.
- Clasificar comandos para decidir el aislamiento.
- Implementar el comportamiento en `src/` o agregar tests en este change.
- Igualar el aislamiento en Windows: se degrada con aviso.

## Decisions

**El aislamiento es del sistema operativo, no del comando.** La lista negra es
evadible y el catálogo no cubre todo. El límite tiene que ser una propiedad del
proceso: aunque el comando sea desconocido, el proceso no puede escribir fuera
del proyecto.

**Se aplica a la herramienta completa.** Clasificar comandos para decidir si
aislar deja huecos entre categorías. La herramienta de ejecución corre siempre
aislada cuando hay mecanismo disponible; las herramientas de lectura y edición
conservan sus reglas de rutas.

**Escritura limitada al proyecto y a un temporal por ejecución.** Los comandos
reales necesitan `/tmp` o equivalentes para compilar y testear. Se crea un
temporal propio, se permite escribir ahí y se limpia al terminar. Alternativa
descartada: bloquear todo temporal, que rompe builds legítimos.

**Degradación visible, no silenciosa.** En una plataforma sin aislamiento el
sistema avisa y sigue con las reglas de permisos y aprobación. No se presenta la
ejecución como aislada. Alternativa descartada: fingir aislamiento, que es peor
que no tenerlo porque la persona cree estar protegida.

**La configuración puede deshabilitarlo, pero se ve.** El valor por defecto es
habilitado. Deshabilitarlo es una decisión consciente y produce el mismo aviso que
una plataforma sin soporte. Sin esta válvula, un comando que legítimamente
necesita salir del proyecto quedaría sin salida.

**El resultado declara el aislamiento.** El modelo y la interfaz necesitan saber
si la ejecución corrió aislada. Un campo en el resultado evita que el aviso viva
solo en la interfaz y permite que el modelo adapte su estrategia.

## Risks / Trade-offs

- [Windows no queda aislado] → Se acepta y se avisa de forma visible; el criterio
  de aislamiento estricto aplica a Linux y macOS.
- [Un build que necesita leer fuera del proyecto falla] → La configuración puede
  habilitar lecturas o deshabilitar el aislamiento con aviso.
- [El temporal se llena o queda sucio] → Se crea por ejecución y se limpia al
  terminar o cancelar.
- [El aislamiento agrega latencia] → Se aplica por ejecución, no por comando, y
  no agrega una capa de análisis.
- [El spec queda adelante del código] → El change de implementación y sus tests
  se derivan después; este change solo fija el contrato.

## Migration Plan

No hay migración. El aislamiento queda habilitado por defecto cuando se
implemente. Para volver al comportamiento actual alcanza con deshabilitarlo en la
configuración, con aviso visible.
