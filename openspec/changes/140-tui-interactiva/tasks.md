# Tasks

## 1. Estado visual

- [x] 1.1 Agregar `contexto` y `herramientaEnCurso` a `EstadoSesionVisual`.
- [x] 1.2 Crear la barra de estado con modelo, directorio, turno y contexto.
- [x] 1.3 Reemplazar las etiquetas por componentes de mensaje y aviso.

## 2. Herramientas

- [x] 2.1 Crear la tarjeta de herramienta con nombre, argumentos, resultado,
  error y truncado.
- [x] 2.2 Mostrar `herramienta_inicio` en la caja viva y moverla al historial en
  `herramienta_fin`.
- [x] 2.3 Verificar que la tarjeta no queda congelada ni aparece dos veces.

## 3. Entrada

- [x] 3.1 Implementar multilínea con `Shift+Enter` y `Ctrl+J`; conservar saltos
  de línea al pegar.
- [x] 3.2 Implementar historial de pedidos con flechas arriba y abajo.
- [x] 3.3 Implementar la paleta de comandos con filtro, flechas, `Enter` y `Esc`.
- [x] 3.4 Implementar el selector de modelo con filtro, modelo activo y `Esc`.

## 4. Contexto

- [x] 4.1 Crear el panel `/contexto` con ventana, presupuesto, uso, disponible,
  consumo acumulado y última compactación.
- [x] 4.2 Mostrar el uso compacto en la barra de estado y marcar los conteos
  estimados.

## 5. Paneles y ayuda

- [x] 5.1 Agregar `/ayuda` con los atajos principales.
- [x] 5.2 Agregar `/salir` y el cierre de overlays con `Esc`.

## 6. Tests de los escenarios nuevos

- [x] 6.1 Test del estado de la sesión.
- [x] 6.2 Test de la lista de comandos y el selector de modelo.
- [x] 6.3 Test del pedido de varias líneas.
- [x] 6.4 Test de la herramienta en ejecución.
- [x] 6.5 Test del uso del contexto.
- [x] 6.6 Actualizar los tests visuales existentes.

## 7. Cierre

- [x] 7.1 Correr `npm run check` y verificar lint, typecheck y tests en verde.
- [x] 7.2 Correr `openspec validate --all` y verificar el change.
- [x] 7.3 Actualizar `AGENTS.md` y `openspec/config.yaml` con los conteos nuevos.
