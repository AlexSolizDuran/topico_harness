---
name: agregar-tool
description: Checklist para agregar o modificar una herramienta del harness. Usar al escribir una tool nueva, al tocar su esquema, al sumarla al registro, al revisar su catalogo por plataforma o su lista negra, o al depurar una tool que el modelo pide mal.
---

# Agregar una herramienta

Las ocho preguntas, **en orden**. Cada una referencia el requisito que la obliga.

## 1. ¿Declara su esquema con zod?

`tools` R7 — *"cada herramienta SHALL declarar un esquema que describa el nombre,
el tipo y la obligatoriedad de cada uno de sus argumentos"*.

```ts
// src/tools/read.ts
import { z } from 'zod'

export const ESQUEMA_READ = z.object({
  ruta: z.string(),
  desde: z.number().optional(),
  hasta: z.number().optional(),
})
```

Una herramienta sin esquema **no se habilita**. El registro la rechaza.

## 2. ¿Está en el registro como dato, no como `switch`?

`core` R3 — el registro asocia `nombre → { esquema, ejecutar }`. Un `switch` sobre
el nombre haría imposible el Nivel 5.

```ts
// src/tools/registry.ts
export const REGISTRO = {
  read: { esquema: ESQUEMA_READ, ejecutar: ejecutarRead },
  write: { esquema: ESQUEMA_WRITE, ejecutar: ejecutarWrite },
} satisfies RegistroHerramientas
```

Agregar una tool **no toca el bucle**. Ese es el test: si tuviste que abrir
`src/core/turn.ts`, algo se hizo mal.

## 3. ¿Trunca su contenido?

`tools` R8 — máximo configurable, **30.000 caracteres por defecto**. Y el mensaje
tiene que decir que fue truncado, o el modelo no va a saber que le falta algo.

## 4. ¿Su error vuelve como texto?

`core` R5 — **nunca se tira la excepción**. Ver la skill `errores-como-texto`.

## 5. ¿Está en el catálogo de la plataforma?

`tools` R6 — la ejecución de comandos corre contra un catálogo, no contra un binario
cualquiera. Un comando fuera del catálogo se rechaza **antes de ejecutar**.

## 6. ¿Está en Windows?

`tools` R6 — **la herramienta de ejecución NO está disponible en Windows en la v1**.

Las otras cinco sí, con dos condiciones:

- las rutas se normalizan: acepta `/` y `\`, resuelve respecto del directorio del
  proyecto, y rechaza lo que sale del proyecto (`tools` R10)
- el directorio del proyecto es la raíz. Nada fuera.

## 7. ¿Su nombre está en la lista negra?

`tools` R11 — la lista negra bloquea el **nombre completo**, nunca una combinación
de flags. `rm -rf` es evadible con `rm -fr`, `rm -r -f` o `rm --recursive --force`.

En Windows la ejecución no está expuesta, así que la lista negra solo aplica a
Linux y macOS.

## 8. ¿Tiene un test por escenario?

Cada `#### Scenario:` del spec de `tools` que corresponda a esta tool, tiene un
test. El nombre del test es el del escenario, literal. Ver la skill
`escenarios-a-tests`.

---

## Antes de dar por terminada

```
[ ] El esquema declara nombre, tipo y obligatoriedad de cada argumento
[ ] Está en el registro como dato
[ ] El contenido se trunca a 30.000 caracteres y avisa cuando lo hace
[ ] Los errores vuelven como texto, no como excepción
[ ] Si ejecuta comandos: está en el catálogo de su plataforma
[ ] Si ejecuta comandos: no está expuesta en Windows
[ ] Las rutas se normalizan y no salen del directorio del proyecto
[ ] Un test por escenario
[ ] npm run check pasa
```

## Trampas

| Trampa | Síntoma |
|---|---|
| Tirar la excepción | El proceso muere a mitad de tarea |
| Un `switch` en vez del registro | El Nivel 5 exige reescribir el bucle |
| Truncar sin avisar | El modelo no sabe que le falta contenido |
| Devolver un error sin filtrar la credencial | El secreto llega al modelo |
| Asumir separador `/` | En Windows no encuentra el archivo |
| Asumir que existe `bash` | En Windows no existe |