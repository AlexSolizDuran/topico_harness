---
name: escenarios-a-tests
description: Como convertir escenarios del OpenSpec en tests. Usar al escribir o modificar tests, al agregar un requisito o un escenario al spec, al revisar que un cambio no dejo ningun escenario sin cubrir, o al agregar una herramienta nueva.
---

# De escenarios a tests

## La regla

**Un `#### Scenario:` del spec es un test.** El nombre del test es el nombre del
escenario, literal.

```
openspec/specs/core/spec.md     →  23 escenarios
tests/core/*.test.ts                   23 tests

openspec/specs/tools/spec.md    →  32 escenarios
tests/tools/*.test.ts                  32 tests
```

42 requisitos, 113 escenarios. Ese es el numero al que hay que llegar.

## Por que la regla existe

Es la **unica** regla que ata codigo a spec. Sin ella, un requisito puede quedar
escrito, implementado a medias, y nadie lo nota hasta que falla en produccion.

Cuando agregas un requisito, agregas su escenario **y** su test. Si el test no se
puede escribir, el requisito esta mal escrito todavia.

## El patron

```ts
import { describe, expect, it } from 'vitest'

describe('El bucle itera hasta que el modelo termina sin pedir mas herramientas', () => {
  it('Una tarea de varios pasos se completa', async () => {
    // arrange
    const provider = providerFalso({ turnos: [...] })

    // act
    const eventos = await recorrer(provider)

    // assert
    expect(eventos).toContain('fin')
  })
})
```

- El `describe` es el **titulo del requisito**, literal
- El `it` es el **titulo del escenario**, literal
- Los helpers compartidos van en `tests/helpers/`

## Verificar que no falta ninguno

```bash
# contar escenarios por capacidad
grep -c '^#### Scenario:' openspec/specs/*/spec.md

# contar tests por capacidad
grep -rc "^  it(\|^  test(" tests/*/

# los dos numeros tienen que coincidir
```

Si no coinciden, falta un test. Ese es el chequeo, y es manual a proposito: no
hay forma de que una herramienta lo haga sola sin mentir.

## When/THEN

El `WHEN` es el **arrange + act**. El `THEN` es el **assert**.

No asserts cosas que el `THEN` no dice. Si un `THEN` dice *"devuelve un mensaje
de error"*, el assert es que hay mensaje de error, no que tenga la frase exacta.

## Cuando agregas un requisito

1. Escribir el requisito con su `SHALL` y sus escenarios
2. Correr `openspec validate --all`
3. Escribir un test por escenario
4. Actualizar el conteo de `ESTADO` en `openspec/config.yaml`

Ese ultimo paso es el que se olvida. Los numeros de `config.yaml` son la unica
fuente y si no se actualizan, mienten.

## Trampas

| Trampa | Síntoma |
|---|---|
| Un test que cubre dos escenarios | El conteo no cierra y no se sabe cual fallo |
| Nombres de test reescritos | No se puede rastrear contra el spec |
| Asertar la frase exacta del mensaje | Falla cuando solo importa que haya mensaje |
| Olvidar actualizar `ESTADO` | `config.yaml` miente |
| Un test por requisito y no por escenario | Los casos borde nunca se prueban |