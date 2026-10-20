# Propuesta 030-tools: Catálogo de Herramientas del Sistema

## Motivación y Contexto
Las herramientas (`tools`) constituyen las extremidades del agente: le permiten interactuar con el sistema de archivos del proyecto (`read`, `write`, `edit`, `glob`, `grep`) y ejecutar comandos en el sistema operativo mediante un catálogo con lista negra. Siguiendo la especificación en `openspec/specs/tools/spec.md`, cada herramienta debe declarar un esquema explícito, normalizar rutas entre plataformas (evitando escapar del directorio del proyecto), truncar salidas a 30.000 caracteres, y deshabilitar la herramienta de ejecución en Windows.

## Requisitos de `openspec/specs/tools/spec.md` implementados
1. **El harness lee un archivo y devuelve su contenido (`read`)**
2. **El harness escribe un archivo (`write`)**
3. **El harness edita un archivo reemplazando una ocurrencia exacta (`edit`)**
4. **El harness encuentra archivos por patrón (`glob`)**
5. **El harness busca texto dentro de archivos (`grep`)**
6. **La herramienta de ejecución se resuelve contra el catálogo de la plataforma (`bash`)**
7. **Cada herramienta declara su esquema**
8. **El contenido devuelto por una herramienta se trunca**
9. **Un error de una herramienta no interrumpe el turno**
10. **Las rutas se resuelven igual en toda plataforma**
11. **Un comando de la lista negra no se ejecuta**

## Alcance
- Normalizador seguro de rutas de proyecto en `src/tools/path.ts`.
- Truncador de contenido a 30.000 caracteres en `src/tools/truncate.ts`.
- Implementación de herramientas de filesystem: `src/tools/read.ts`, `src/tools/write.ts`, `src/tools/edit.ts`, `src/tools/glob.ts`, `src/tools/grep.ts`.
- Catálogo de comandos, intérpretes por plataforma y lista negra en `src/tools/shell.ts`.
- Creador y registro de catálogo completo en `src/tools/catalog.ts`.
- Suite de pruebas completa en `tests/tools/tools.test.ts` que cubre los 35 escenarios normativos.
