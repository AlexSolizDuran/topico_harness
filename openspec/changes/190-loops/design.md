# Design

## Context

El turno ya tiene un límite de pasos que termina el turno cuando el modelo no
converge. Es un freno de última instancia: a los 25 pasos el trabajo se perdió.

Lo que falta es un freno barato para el caso más común: la misma llamada repetida
sin ningún cambio en el medio.

## Goals / Non-Goals

**Goals:**

- Cortar la repetición idéntica en el tercer intento, no en el vigésimo quinto.
- No interrumpir el turno: devolver el aviso y dejar que el modelo corrija.
- No agregar una decisión humana para un error del modelo.

**Non-Goals:**

- Detectar ciclos alternados (`a, b, a, b`): los corta el límite de pasos.
- Convertirlo en una acción de permiso.
- Analizar el contenido del resultado para decidir si “cambió algo”.

## Decisions

### Dispara en la tercera, no en la cuarta

Dos llamadas idénticas pueden ser legítimas: reintentar una lectura tras un cambio
externo, o pedir algo dos veces por un error de armado del mensaje. La tercera, sin
nada distinto en el medio, ya es un bucle.

Se ejecutan las dos primeras y se bloquea la tercera. Toda llamada idéntica
posterior también se bloquea hasta que el conteo se reinicie.

Alternativa descartada: dejar pasar tres y bloquear la cuarta. Gasta un viaje más y
no cambia el diagnóstico.

### Consecutivas, no “en todo el turno”

Si hubo un `edit` en el medio, la lectura siguiente puede devolver algo distinto y
es sana. El contador mira la racha, no el turno entero.

Un ciclo alternado no es una racha idéntica; detectarlo exige recordar una ventana y
comparar secuencias. No vale la complejidad para la v1: el límite de pasos ya lo
cubre.

### Argumentos canónicos

La comparación no depende del orden de las claves del objeto:

```json
{ "ruta": "a.ts", "limite": 10 }
```

es igual a:

```json
{ "limite": 10, "ruta": "a.ts" }
```

El contenido de los valores sí importa: `read a.ts` y `read b.ts` son llamadas
distintas. Se comparan los argumentos ya normalizados, no el texto crudo que mandó
el modelo.

### Va en `core`, no en `permissions`

Los permisos responden “¿puede pasar?” y evalúan una llamada a la vez, sin memoria.
Un loop no es un problema de acceso: es que la operación ya se hizo igual.

OpenCode V1 tenía `doom_loop` como permiso; V2 lo sacó. Ya decidimos alinear con V2,
así que no se inventa una acción nueva.

### Bloquear con texto, no preguntar

El resultado del bloqueo es un mensaje al modelo:

```
ERROR: llamaste a read con los mismos argumentos 3 veces seguidas.
El resultado anterior no cambió. Cambiá de estrategia o respondé con lo que ya tenés.
```

Preguntar “¿seguir?” agrega una decisión humana para un error que el modelo puede
corregir solo, y reutiliza el panel de aprobación para algo que no es un permiso.

El mensaje no repite los argumentos crudos: pueden ser largos o contener rutas
sensibles. Nombra la herramienta y el conteo, nada más.

### Por turno

Cada turno arranca el contador en cero. Un subagente tiene su propio turno y su
propio contador: el padre no ve las llamadas internas del hijo, y el hijo no hereda
el estado del padre.

### Interacción con las tandas

El conteo se hace sobre las llamadas tal como las pidió el modelo, antes de agrupar.
Si en un mismo mensaje vienen tres `read` iguales, la tercera se bloquea y las otras
dos corren en la tanda. La decisión no depende del tiempo de ejecución.

## Risks / Trade-offs

- [Un polling legítimo con el mismo comando se bloquea en la tercera] → el mensaje
  empuja a cambiar el comando; el límite de pasos sigue existiendo.
- [Un reintento legítimo se bloquea] → se permiten dos; el tercero sin cambios en el
  medio no aporta.
- [El modelo insiste y el turno se alarga] → cada insistencia es un bloqueo barato;
  el límite de pasos termina el turno.
- [Argumentos con claves en otro orden] → se comparan canónicamente.

## Migration Plan

Sin migración: no hay estado persistido. El comportamiento actual (ejecutar todo)
sigue igual salvo en la racha idéntica, que ahora devuelve texto en la tercera.
