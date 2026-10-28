# Tasks

## 1. Descubrimiento

- [ ] 1.1 Crear `src/skills/descubrir.ts` con el recorrido de `.opencode/skills` en sus dos formas (directorio y archivo plano), el parseo manual del frontmatter y la validación del identificador; verificar con `tests/skills/` que cubra los escenarios de descubrimiento.
- [ ] 1.2 Agregar el tope configurable de 32 KiB con `ErrorSkillExcedida`, que nombra archivo, tamaño y tope; verificar que el escenario "supera el tope" falla y "justo en el tope" arranca.
- [ ] 1.3 Omitir con aviso las skills sin `description` o con frontmatter inválido, sin cortar el arranque; verificar los dos escenarios de omisión.

## 2. Anuncio y herramienta

- [ ] 2.1 Componer el catálogo `identificador + nombre + descripción` en `construirHarness` y ubicarlo entre las instrucciones y el prompt del agente; verificar que el prompt no incluye el cuerpo.
- [ ] 2.2 Crear la herramienta `skill({ id })` que devuelve cuerpo, carpeta base y hasta diez rutas de apoyo, y registrarla en el catálogo; verificar la invocación existente y el identificador inexistente.
- [ ] 2.3 Marcar el mensaje de resultado del cuerpo como no recortable y exceptuarlo en `recortarSalidasHerramientasViejas`; verificar con un test de `tests/context/` que el recorte no lo reemplaza.

## 3. Permisos

- [ ] 3.1 Sumar `skill` a `AccionPermisoCanon`, a la validación de reglas y al filtrado del anuncio; verificar que una regla `denegar` oculta la skill y bloquea la invocación.
- [ ] 3.2 Resolver `consultar` pidiendo aprobación antes de entregar el cuerpo y dejar el default en permitir; verificar el escenario de aprobación.
- [ ] 3.3 Sumar `skill` a la intersección de solo lectura de subagentes; verificar que un subagente con la herramienta habilitada recibe el cuerpo y uno restringido no.

## 4. Interfaz

- [ ] 4.1 Agregar el comando `/skills` con panel de catálogo, estado de carga y skills omitidas; verificar que se abre y muestra los tres estados.
- [ ] 4.2 Agregar la línea de costo del catálogo en el panel `/contexto`; verificar que los tokens del anuncio aparecen.
- [ ] 4.3 Actualizar la ayuda de la TUI con el comando nuevo; verificar que `/ayuda` lo lista.

## 5. Cierre

- [ ] 5.1 Actualizar `AGENTS.md` (capacidad nueva, conteos, fila `src/skills/`), `openspec/config.yaml`, `docs/comportamiento.md` y `PREGUNTAS.md`; verificar que las cifras coinciden con los specs.
- [ ] 5.2 Ejecutar `npm run check` y `openspec validate --all`; verificar que ambos terminan en verde.
- [ ] 5.3 Archivar el change con `openspec archive`; verificar que `openspec list` no muestra changes activos.
