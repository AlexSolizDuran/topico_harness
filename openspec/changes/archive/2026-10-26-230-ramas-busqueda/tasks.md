# Tasks

## 1. Almacén

- [x] 1.1 Implementar `ramificar(id, desdeTurno)` con corte por turno y metadatos `padre`/`desdeTurno`.
- [x] 1.2 Implementar `buscar(texto)` con coincidencias y fragmento.
- [x] 1.3 Extraer la lectura de registros y reutilizarla.

## 2. Sesión

- [x] 2.1 Extraer `adoptarSesion` desde `cambiarSesion`.
- [x] 2.2 Agregar `ramificar(desdeTurno)` y `buscarSesiones(texto)`.

## 3. Interfaz

- [x] 3.1 Sumar `/rama` a los comandos.
- [x] 3.2 Implementar `/rama <n>` con validación del número.
- [x] 3.3 Implementar `/sesiones buscar <texto>` y el panel de resultados.

## 4. CLI

- [x] 4.1 Parsear `--rama-de` y `--desde`.
- [x] 4.2 Crear la rama al arrancar y exigir ambos argumentos juntos.

## 5. Pruebas

- [x] 5.1 Un test por escenario de `sesiones`.
- [x] 5.2 Un test por escenario de `interface`.
- [x] 5.3 `npm run check` en verde.

## 6. Cierre

- [x] 6.1 Actualizar `AGENTS.md` y los conteos.
- [x] 6.2 `openspec validate 230-ramas-busqueda`.
- [x] 6.3 Archivar el change.
