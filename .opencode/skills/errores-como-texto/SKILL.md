---
name: errores-como-texto
description: El contrato de errores del harness - un error nunca se tira, vuelve al modelo como texto. Usar al escribir cualquier codigo que pueda fallar, al manejar excepciones, al construir el mensaje que recibe el modelo, o al debuggear un turno que se frena a mitad de tarea.
---

# Un error nunca se tira: vuelve al modelo como texto

## La regla, en una linea

```ts
try {
  return await ejecutar(tool, args)
} catch (e) {
  return `ERROR: ${e.message}\nLa operacion no se completo.`
}
```

## Por que importa

Tirar la excepcion **mata el proceso a mitad de tarea**. Devolverla como texto
hace que el modelo la lea y **se corrija solo**.

El caso real del Nivel 1: el agente corre la suite, falla por un import mal
escrito, el error vuelve como texto, y en el siguiente paso arregla el import.
Sin esto, hay que reiniciar a mano.

Es la diferencia entre un harness que se frena y uno que termina.

## Las cuatro reglas

**1. Devolver, nunca tirar.** El turno sigue. El error es un resultado mas, igual
que un `read` exitoso.

**2. Truncar.** El mensaje va a un modelo con presupuesto de contexto. Un volcado de
20.000 caracteres de un stack trace se come el turno entero.

**3. No filtrar la credencial.** Ni en el mensaje que vuelve al modelo, ni en un
log, ni en un evento. `provider` R4 lo prohibe explicitamente.

**4. Decir que no se completo.** El mensaje tiene que dejar claro que la operacion
no ocurrio, para que el modelo no asuma que si.

## Que tira y que no

| Situacion | Que hacer |
|---|---|
| La herramienta fallo | Devolver el error como texto. **Nunca tirar.** |
| Los argumentos no validan | Devolver que se esperaba y que se recibio |
| El comando sale con codigo distinto de cero | Devolver el codigo y la salida. No es una excepcion |
| El comando esta en la lista negra | Devolver el rechazo como texto, antes de ejecutar |
| El provider dio 429 o 5xx | Reintentar con espera creciente. Agotados los reintentos, devolver el fallo |
| La credencial falta | Informarlo antes de intentar la peticion |
| El prompt del modelo se corto a la mitad | Tirar. **No hay turno al que volver** |

La excepcion se tira solo cuando no queda nada que recuperar: el proceso ya se cae
de todas formas y un error silencioso sería peor.

## Dónde NO aplica

- **`src/interface/`**: la interfaz puede tirar. Si Ink revienta, no hay modelo a
  quien avisarle.
- **`src/provider/adapter.ts`**: el catch final que devuelve el fallo al nucleo si
  se agotaron los reintentos.

## El error que vuelve, bien formado

```
ERROR: <que se intento hacer>
<que fallo y por que>
La operacion no se completo. No cambies nada todavia.
```

El modelo lee eso y decide. Lo que **no** puede leer es una excepción de Node con
cuatro stack frames.

## Trampas

| Trampa | Síntoma |
|---|---|
| Tirar la excepción | El proceso muere a mitad de tarea |
| Devolver el error sin decir que fallo | El modelo cree que la operación se hizo |
| Volcar el stack trace entero | Se come el presupuesto de contexto |
| Filtrar la credencial en el mensaje | El secreto llega al modelo y al prompt siguiente |
| Loguear los encabezados de la petición | La credencial queda en el archivo de log |
| Confundir "código de salida distinto de cero" con "error" | El turno se frena por algo que no lo amerita |