# Tasks

## 1. Empaquetado y ejecución

- [x] 1.1 Agregar `tsx` como devDependency y los scripts `dev`, `build`, `start` y `link` en `package.json`; verificar que `npm install` termina sin errores.
- [x] 1.2 Crear `tsconfig.build.json` con `noEmit: false`, `outDir: "dist"`, `rootDir: "src"` e `include: ["src"]`; verificar que `npm run build` genera `dist/main.js`.
- [x] 1.3 Agregar `bin: { "harness": "./dist/main.js" }` y el shebang `#!/usr/bin/env node` en `src/main.ts`; verificar que `node dist/main.js --help` arranca.

## 2. Ensamblado

- [x] 2.1 Crear `src/app.ts` con `construirHarness({ directorioProyecto, proveedor, promptSistema })` que arma registro y sesión; verificar con un test que devuelve una sesión usable con `ProveedorSimulado`.
- [x] 2.2 Crear `src/main.ts` que parsea `--dir` y el pedido inicial por argumentos, arma el harness y ejecuta el turno; verificar que `npm run dev -- "hola"` con un provider simulado imprime la respuesta.
- [x] 2.3 Validar que `--dir` exista antes de armar el catálogo y salir con código `1` y mensaje en `stderr` si no existe; verificar manualmente con un `--dir` inválido (código `1` y mensaje en `stderr`).

## 3. Salida y terminal

- [x] 3.1 Exigir `stdout.isTTY` en `detectarTerminalInteractiva` y comprobar `stdin.isTTY` en `main.ts`; verificar con los tests de terminal interactiva y sin TTY.
- [x] 3.2 Conectar `RenderizadorLineaALinea` al estado de la sesión para mostrar usuario, texto, herramientas y avisos; verificar que la salida contiene el nombre de la herramienta ejecutada.
- [x] 3.3 Sin argumentos y con terminal, abrir la TUI y enviar lo escrito hasta `Ctrl+D`; verificar con `renderToString` y los tests de input.
- [x] 3.4 Propagar el estado final a un código de salida (`0` completado, `1` fallido); verificar con un proveedor simulado que falla.

## 4. Tests de los escenarios nuevos

- [x] 4.1 Test «Arranque en el directorio del proyecto»: `construirHarness` con `--dir` apunta las tools a ese directorio; verificar leyendo un archivo relativo.
- [x] 4.2 Test «Pedido inicial por argumentos»: el primer mensaje del historial es el texto de la invocación; verificar el contenido.
- [x] 4.3 Test «Sin pedido inicial en una terminal interactiva»: sin argumentos la sesión queda sin turno en curso y acepta el primer mensaje; verificar el estado.
- [x] 4.4 Una prueba de integración manual con `dist/main.js` contra OpenRouter que verifique la salida y el código `0`.

## 5. Documentación y estado

- [x] 5.1 Actualizar la tabla de `AGENTS.md` que afirma que `src/` y `tests/` están vacíos; verificar leyendo el archivo.
- [x] 5.2 Actualizar el bloque `ESTADO` de `openspec/config.yaml` con 44 requisitos y 123 escenarios y marcar el arranque como implementado; verificar que `openspec validate --all` pasa.
- [x] 5.3 Correr `npm run check` y verificar lint, typecheck y tests en verde.
