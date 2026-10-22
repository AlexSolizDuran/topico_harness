# Design

## Context

El turno recibe las llamadas del modelo y las ejecuta en orden:

```ts
for (const llamada of llamadas) {
  await despacharHerramienta(llamada, ...)
}
```

Cada herramienta sabe ejecutarse y, desde `170`, declarar su acción y su recurso.
No sabe si puede convivir con otra ejecución.

## Goals / Non-Goals

**Goals:**

- Aprovechar las llamadas que el modelo ya mandó juntas sin romper dependencias.
- Que el orden del historial sea determinista.
- Que un fallo o una cancelación no deje resultados a medias.

**Non-Goals:**

- Subagentes en paralelo (`nivel 4`): acá se paralelizan herramientas del mismo
  turno, no turnos hijos.
- Reordenar llamadas para juntar las paralelizables.
- Un límite de concurrencia configurable: la tanda la acota el modelo.
- Detección de loops (`190`).

## Decisions

### Se agrupa lo consecutivo, no todo lo paralelizable

Se recorre la lista en orden y se abre una tanda. Una llamada paralela se suma; una
serial cierra la tanda abierta, se ejecuta sola y abre la siguiente.

```
[read a, read b, read c, edit a, shell, read a]
→ tanda A: read a, read b, read c
→ tanda B: edit a
→ tanda C: shell
→ tanda D: read a
```

Reordenar para juntar los `read` de los extremos rompería la dependencia: el último
`read` tiene que ver el resultado del `edit`.

Alternativa descartada: paralelizar todas las llamadas del mensaje. Es más rápido y
está mal: produce lecturas de estado viejo sin ningún aviso.

### Sin declaración, serial

El metadato es explícito y el valor por defecto es el seguro. Una herramienta nueva
que se olvide de declararlo se ejecuta sola. Paralelizar de más es un bug de
correctitud; de menos es solo lentitud.

Las lecturas (`read`, `glob`, `grep`) se declaran paralelas. Las que tienen efectos
(`write`, `edit`, `shell`, `subagent`) se declaran seriales. El subagente es serial
aunque el hijo solo lea: lanza trabajo, gasta tokens y su resultado es un efecto.

### Un fallo no cancela la tanda

`Promise.all` corta en el primer rechazo y deja las demás promesas en el aire. Se
usa `Promise.allSettled`: cada llamada resuelve con su contenido o con su error como
texto.

Es la misma regla del harness —los errores vuelven al modelo, no se tiran— aplicada
a un grupo. Si `read a` falla, `read b` y `read c` igual entregan lo suyo.

### La aprobación frena la tanda

El permiso se evalúa para todas las llamadas antes de ejecutar la tanda. Si alguna
requiere aprobación, la tanda entera espera la decisión. Así hay un solo momento de
preguntas y ninguna herramienta corre mientras la persona decide.

Denegar una llamada no deniega las demás: son operaciones independientes. Cada una
devuelve su propio resultado. (Distinto de una operación que toca varios recursos:
eso ya lo resuelve `170`.)

Alternativa descartada: ejecutar las permitidas y dejar la que pregunta para
después. Ahorra unos milisegundos y hace que la interfaz muestre resultados
mientras hay una pregunta abierta. No vale la complejidad en la v1.

### El historial va en orden de llamada

El modelo pidió `a, b, c`. Los resultados se agregan `a, b, c`, aunque `c` termine
primero. El proveedor espera los resultados en el mismo orden que las llamadas; si
no coinciden, el paso siguiente se rompe.

La interfaz hace lo contrario: muestra las tarjetas en orden de llamada y las va
completando a medida que llegan, sin reordenarlas.

### Cancelar deja un resultado por llamada

Al cancelar se abortan las llamadas en vuelo. Las que ya terminaron conservan su
resultado; las abortadas reciben un resultado de cancelación. El historial no puede
quedar con una llamada sin resultado, porque el turno siguiente no sabría qué hacer
con ella.

### Sin límite de concurrencia propio

La tanda tiene tantas llamadas como el modelo haya pedido. Un tope artificial
obligaría a partir tandas y a explicar por qué. Si en la práctica aparece un caso de
muchos archivos abiertos, se agrega después con medición.

## Risks / Trade-offs

- [Muchas lecturas a la vez compiten por I/O] → es una mejora de reloj, no de
  tokens; el turno igual espera al modelo.
- [Una herramienta nueva se declara paralela por error] → el valor por defecto es
  serial y el test del catálogo verifica la declaración.
- [Una tanda con una aprobación frena a las demás] → un solo momento de decisión y
  ningún resultado a medias.
- [El orden de las tarjetas no es el de finalización] → es intencional; refleja el
  orden en que el modelo pidió las cosas.

## Migration Plan

Sin migración: hoy las llamadas se ejecutan de a una y el resultado es el mismo. Los
llamadores que no declaren paralelo siguen ejecutando todo en serie. Al archivar,
`170` tiene que estar aplicado porque el texto del despacho lo incluye.
