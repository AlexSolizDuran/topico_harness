# Tasks

## 1. Conteo

- [x] 1.1 Agregar al turno el estado de la racha: herramienta, argumentos canónicos y conteo.
- [x] 1.2 Incrementar el conteo cuando la llamada es idéntica a la anterior.
- [x] 1.3 Reiniciar el conteo cuando cambia la herramienta, cambia un argumento o hay otra llamada en el medio.
- [x] 1.4 Arrancar el conteo en cero en cada turno; no compartirlo con el padre ni con los hijos.

## 2. Comparación

- [x] 2.1 Canonicalizar los argumentos antes de comparar, sin depender del orden de las claves.
- [x] 2.2 Comparar el contenido de los valores: una ruta distinta es una llamada distinta.
- [x] 2.3 Test: `{a,b}` y `{b,a}` son la misma llamada.
- [x] 2.4 Test: `read a.ts` y `read b.ts` son llamadas distintas.

## 3. Bloqueo

- [x] 3.1 No ejecutar la tercera llamada idéntica ni las posteriores mientras dure la racha.
- [x] 3.2 Devolver un mensaje que nombre la herramienta, el conteo y que el resultado no cambió.
- [x] 3.3 No incluir los argumentos crudos en el mensaje.
- [x] 3.4 Dejar el turno en curso después del bloqueo.
- [x] 3.5 Registrar el mensaje como resultado de esa llamada.

## 4. Interacción con tandas

- [x] 4.1 Contar sobre las llamadas pedidas, antes de agrupar en tandas.
- [x] 4.2 Si la tercera idéntica cae en una tanda, bloquearla y ejecutar las otras dos.
- [x] 4.3 Test: tres `read` iguales en un mensaje producen dos ejecuciones y un bloqueo.

## 5. Tests

- [x] 5.1 Un test por cada escenario del delta de `core`.
- [x] 5.2 Test: el bloqueo no termina el turno y el modelo puede corregir en el paso siguiente.
- [x] 5.3 Test: el historial queda con un resultado por llamada después del bloqueo.
- [x] 5.4 Correr `npm run check` en verde.

## 6. Cierre

- [x] 6.1 Archivar después de `180-tandas`.
- [x] 6.2 Actualizar los conteos de `AGENTS.md` y `openspec/config.yaml` al archivar.
