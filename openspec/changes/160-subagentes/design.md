# Design

## Context

`150-agentes` deja los perfiles como dato y filtra el registro por agente. Un agente
de modo subagente existe pero nadie lo lanza. El bucle (`core/turn.ts`) ya ejecuta un
turno con un registro, un historial, un presupuesto y una señal de cancelación; no
sabe de agentes.

La herramienta de delegación necesita algo que hoy el contrato de herramientas no
tiene: la señal de cancelación del turno. Sin ella, el hijo no se entera de que el
padre se canceló.

## Goals / Non-Goals

**Goals:**

- Investigar sin ensuciar el historial del padre.
- Devolver al padre un solo texto, no un stream.
- Cortar la recursión en un nivel.
- Que el hijo no pueda modificar el proyecto.
- Cancelar al hijo cuando se cancela el padre.
- Dar al hijo presupuesto, pasos y modelo propios.
- Distinguir la delegación en la interfaz.

**Non-Goals:**

- Delegaciones en paralelo o en background.
- Streaming anidado.
- Worktrees o equipos de agentes.
- Profundidad mayor que uno.
- Permisos `allow` / `ask` / `deny` (change `170`).

## Decisions

### Capacidad propia: `subagents`

`agents` responde quiénes son los agentes; `subagents` responde qué pasa cuando uno
lanza a otro. Son dos responsabilidades, como `provider` y `core`. `src/agents/`
guarda datos y `src/subagents/` ejecución.

### La herramienta se llama `task`

Es el nombre que ve el modelo y el que usa OpenCode para lo mismo. Los argumentos
van en inglés (`agent`, `prompt`) por la misma razón: los escribe el modelo. La
descripción de la herramienta enumera los subagentes y sus descripciones; es
metadata de routing, no documentación.

El nombre del subagente es obligatorio. El esquema lo limita a los disponibles, así
que el modelo no puede inventar uno; si aun así llega un nombre desconocido, el
error vuelve como texto con la lista.

### Contexto aislado y resultado único

El hijo arranca con una lista nueva: su prompt de sistema y el pedido. No hereda el
historial. El padre registra la llamada y el resultado; los mensajes intermedios se
descartan.

Los eventos del hijo se consumen dentro del ejecutor y no se reenvían. Si se
reenviaran, el scrollback del padre mostraría el trabajo interno y se perdería la
razón del nivel.

### Profundidad uno por construcción

El turno hijo recibe el registro sin la herramienta de delegación. Esa ausencia es
la garantía. Además, el ejecutor rechaza una delegación si se lo invoca desde un
turno hijo; el rechazo vuelve como texto. Dos capas por si una definición futura
intenta saltear la primera.

### Solo lectura por filtrado y por validación

El hijo recibe la intersección entre lo que declara su definición y las herramientas
de lectura. Un agente de modo `all` puede declarar escritura para su uso como
primario, pero al lanzarse corre sin ella.

Una definición de modo `subagente` que declare una herramienta de efecto falla al
arrancar. El filtro protege en ejecución; la validación evita que la configuración
diga una cosa y el sistema haga otra. La garantía no depende del prompt: el modelo
puede pedir escritura y recibe el rechazo porque la herramienta no está en su
registro.

### Presupuesto, pasos y modelo propios

El hijo calcula su presupuesto sobre la ventana del modelo que usa. Su contador de
pasos es independiente: agotarlo no consume el límite del padre.

Si la definición declara un modelo, el hijo usa una instancia de provider para ese
modelo; el provider del padre no se toca. Cambiar el modelo compartido y restaurarlo
al terminar deja una ventana en la que otro consumidor ve el modelo equivocado.

El resultado del hijo se cuenta en el presupuesto del padre como el resultado de una
herramienta, con el truncado habitual.

### Cancelación en un solo sentido

El padre es dueño del árbol. Al cancelarse el padre, se cancela el hijo y este no
entrega una respuesta parcial. Al cancelarse o fallar el hijo, el padre sigue: el
error o el motivo vuelven como texto, igual que cualquier herramienta fallida.

### Interfaz: tarjeta propia, distinción textual

La delegación se muestra como una tarjeta con el nombre del subagente y el pedido, y
al terminar con el resumen. La distinción no puede depender del color porque la
salida línea a línea no tiene color: se apoya en una marca textual y en el nombre
del subagente.

La sesión arma el elemento visual a partir del evento de la herramienta; el núcleo
no cambia. La interfaz no decide nada: solo presenta lo que el evento trae.

## Risks / Trade-offs

- [El hijo no conoce la conversación] → el pedido debe ser autosuficiente; el
  subagente por defecto pide devolver solo el resultado.
- [Un hijo con modelo barato investiga peor] → es una decisión de configuración; el
  campo es opcional y sin él hereda el modelo del padre.
- [Olvidar propagar la cancelación deja al hijo cobrando] → la señal se enlaza en un
  solo punto y hay un test por escenario.
- [Filtrar por nombre de herramienta envejece mal] → la lista de herramientas de
  lectura es una constante del catálogo, junto a los nombres que ya usa el modelo.
- [Una tarjeta propia duplica la de herramienta] → es deliberado: la delegación no
  es una herramienta común y el usuario tiene que ver cuándo el agente decidió
  delegar.

## Migration Plan

Sin migración de datos. Al archivar, `subagents` se copia desde
`openspec/specs/subagents/spec.md` y los deltas reemplazan o agregan sus requisitos.
Las sesiones sin delegación conservan el comportamiento anterior: la herramienta no
aparece si el agente no la declara, y los agentes existentes siguen funcionando sin
el campo `modelo`.
