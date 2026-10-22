# Design

## Context

`SesionInteractiva` recibe un `RegistroHerramientas` y un prompt de sistema fijos.
`core/registry.ts` ya guarda las herramientas como datos, pero no hay forma de
pedir un subconjunto. El bucle no conoce perfiles: usa el registro que le entregan.

La configuración del proyecto vive en `.harness/config.json`, ignorado por git
porque contiene la credencial. Los agentes no son secretos: son configuración del
proyecto y conviene versionarlos.

## Goals / Non-Goals

**Goals:**

- Agregar un agente sin tocar el código del bucle.
- Que un agente de solo lectura no vea ni pueda ejecutar herramientas de efecto.
- Mantener el cambio de agente atómico y conservar historial y modelo.
- Fallar al arrancar ante una definición inválida.

**Non-Goals:**

- Subagentes y la herramienta de delegación (change `160`).
- Permisos `allow` / `ask` / `deny` (change `170`).
- Modelo por agente (llega con el subagente barato).
- Agentes de ámbito global; el ámbito de usuario llega con la memoria.
- Streaming anidado.

## Decisions

### Archivo versionado en `.harness/agents.json`

Los agentes van en `.harness/agents.json`, con una excepción en `.gitignore`.
`config.json` sigue ignorado porque lleva credenciales; los perfiles se comparten
con el repo. El archivo declara `agentes` y opcionalmente `agentePorDefecto`.

Alternativa descartada: meter los agentes en `config.json`. Obligaría a versionar
un archivo con secretos o a duplicar la configuración.

Alternativa descartada: Markdown con frontmatter. Agrega un parser y una
dependencia para un dato que es plano.

### Defaults mergeados con el archivo

Sin archivo, el sistema crea `build` con todas las herramientas disponibles y
`plan` con las de lectura. Si hay archivo, los defaults se conservan y las
definiciones del archivo pisan por nombre. Así se puede agregar un agente sin
copiar los dos de base.

El agente por defecto es el que declare el archivo; si no lo declara, el primero
primario del conjunto resultante.

### Filtrado del registro, no del despacho

`RegistroHerramientas.filtrar(nombres)` devuelve una instancia nueva con solo las
herramientas pedidas. El turno recibe ese registro. El despacho ya devuelve texto
cuando la herramienta no existe, así que una llamada inventada por el modelo queda
rechazada sin código nuevo y sin confiar en el prompt.

Alternativa descartada: filtrar solo la lista que se envía al provider. El modelo
podría alucinar `write` y el despacho la ejecutaría contra el catálogo completo.

### Prompt efectivo por concatenación

El prompt de sistema efectivo es el prompt base seguido del prompt del agente. Se
guardan por separado para que cambiar de agente no pierda las instrucciones
generales. `SesionInteractiva` ya envía el prompt del estado, así que el cambio se
refleja en la petición siguiente.

### Cambio atómico y fuera del turno

`cambiarAgente` valida el nombre, el modo y el estado del turno antes de tocar
nada. Si falla, la sesión queda como estaba. Se rechaza durante un turno en curso
por la misma razón que el cambio de modelo: cambiar las herramientas a mitad de un
turno deja llamadas pendientes contra un régimen distinto.

### Interfaz: `Tab` y `/agente`

`Tab` cicla entre primarios; `/agente` abre la lista y `/agente <nombre>` cambia
directo. La lista solo muestra primarios. El ciclo es una función pura para poder
probarlo sin simular teclas.

## Risks / Trade-offs

- [`plan` no puede ejecutar pruebas] → es el propósito del modo; la persona cambia
  a `build` con `Tab`.
- [El filtrado mutable afecta al catálogo compartido] → `filtrar` devuelve una
  instancia nueva; hay un test que verifica que el original conserva todo.
- [Un agente con prompt propio cambia el comportamiento entre turnos] → el cambio
  solo ocurre fuera de un turno; hay un test que lo rechaza en curso.
- [En Windows no existe la herramienta de ejecución] → los defaults se arman con
  las herramientas disponibles, no con una lista fija.
- [Un archivo con un error de tipeo rompe el arranque] → es deliberado: falla con
  un mensaje explícito en vez de arrancar con un perfil distinto al declarado.

## Migration Plan

Sin migración de datos. Al archivar, el delta de `interface` reemplaza el requisito
de estado de la sesión y agrega el de cambio de agente. `agents` se copia desde
`openspec/specs/agents/spec.md`. Los llamadores que no pasan agentes conservan el
comportamiento anterior: la sesión usa el registro completo.
