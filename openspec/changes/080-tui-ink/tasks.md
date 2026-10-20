# Tasks

## 1. Entrada de teclado

- [x] 1.1 Crear `src/interface/input.ts` con `aplicarTecla` y las acciones `enviar`, `cancelar`, `salir`, `ninguna`; verificar con tests de escritura, borrado y cursor.
- [x] 1.2 Soportar `Backspace`, `Delete`, flechas izquierda/derecha, `Home` y `End`; verificar cada tecla con un test.
- [x] 1.3 Integrar `usePaste` para insertar texto pegado de una vez; verificar con un test del reducer y un pegado largo.

## 2. Componente interactivo

- [x] 2.1 Crear `src/interface/app-interactiva.tsx` con `useState`, `useInput` y `alActualizar` conectado a la sesión; verificar que un texto llega al historial al presionar Enter.
- [x] 2.2 Mostrar el historial dentro de `<Static>` y la caja viva (streaming, spinner, aviso) fuera; verificar con `renderToString` que el texto en streaming aparece una sola vez.
- [x] 2.3 Mostrar la herramienta con su nombre, resultado y marcas de error y truncado; verificar con un estado construido a mano.
- [x] 2.4 Implementar `Ctrl+C` (cancelar o salir) y `Ctrl+D` (salir); verificar con tests del reducer y manualmente en terminal.

## 3. Sesión y errores

- [x] 3.1 Mantener `enviarMensaje(): Promise<void>` y agregar `obtenerUltimoTurno()` para distinguir completado y cancelado sin romper el uso actual; verificar con un test.
- [x] 3.2 Reemplazar el `catch` vacío por un aviso con el mensaje sanitizado; verificar que un historial inválido se ve en pantalla y el turno cierra.
- [x] 3.3 Asegurar que `finalizarTurnoVisual` corre en el camino de éxito y en el de error; verificar que no queda `turnoEnCurso` en ningún camino.

## 4. Arranque y degradación

- [x] 4.1 Crear `src/interface/render.tsx` con `render(..., { exitOnCtrlC: false })` y restauración de la terminal al salir; verificar manualmente.
- [x] 4.2 Elegir TUI o línea a línea en `src/main.ts` según `detectarTerminalInteractiva`; verificar con stdin y stdout simulados.
- [x] 4.3 Mantener el modo línea a línea con la misma información que la TUI; verificar que un turno con herramienta produce las mismas líneas esenciales.

## 5. Tests y cierre

- [x] 5.1 Test «Escribir con el turno terminado»: el buffer acepta texto solo sin turno en curso.
- [x] 5.2 Test «El mensaje inicia el turno siguiente»: lo escrito es el primer mensaje del historial.
- [x] 5.3 Test «No se escribe durante un turno»: con turno en curso el envío se bloquea y el buffer se conserva.
- [x] 5.4 Test «Se cancela desde la interfaz» y «El turno cancelado se refleja»: el estado queda cancelado y habilita escribir.
- [x] 5.5 Test «Sin terminal interactiva»: la salida no contiene secuencias de control.
- [x] 5.6 Correr `npm run check` y verificar lint, typecheck y tests en verde.
