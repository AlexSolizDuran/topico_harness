# Propuesta 040-interface: Interfaz de Terminal y Renderizado con Degradación

## Motivación y Contexto
La interfaz de usuario (`interface`) es la capa de presentación que conecta a la persona con el núcleo. Debe mostrar el streaming de texto incremental conforme se recibe, exhibir las herramientas ejecutadas y sus resultados (distinguiendo errores y truncados), mostrar el system prompt de forma persistente, permitir ingresar nuevos pedidos entre turnos, posibilitar la cancelación con teclado/señal y degradar limpiamente a salida línea a línea cuando no se cuente con una TTY interactiva. Siguiendo la regla fundamental, la interfaz solo dibuja lo que recibe y no contiene lógica de negocio.

## Requisitos de `openspec/specs/interface/spec.md` implementados
1. **La interfaz muestra el texto del modelo a medida que llega**
2. **La interfaz muestra cada herramienta ejecutada y su resultado**
3. **La interfaz permite escribir el siguiente pedido**
4. **La interfaz muestra el prompt del sistema de forma persistente**
5. **La interfaz permite cancelar el turno en curso**
6. **Sin terminal interactiva la interfaz degrada a salida línea a línea**
7. **La interfaz no contiene lógica de negocio**

## Alcance
- Modelo de estado de UI y renderizado agnóstico en `src/interface/state.ts`.
- Renderizador de consola línea a línea (`PlainTextRenderer`) en `src/interface/plain.ts`.
- Componentes React/Ink para terminal interactiva en `src/interface/app.tsx`.
- Manejador de entrada y cancelación interactiva en `src/interface/runner.ts`.
- Suite de pruebas completa en `tests/interface/interface.test.ts` que cubre los 17 escenarios normativos.
