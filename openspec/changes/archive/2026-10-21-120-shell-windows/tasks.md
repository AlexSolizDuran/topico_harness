# Tasks

## 1. Validación de invocación

- [x] 1.1 Implementar el detector de composición (`;`, `&&`, `||`, `|`, `&`, `` ` ``, `$(`, saltos de línea) ignorando comillas; verificar con tests de líneas simples y compuestas.
- [x] 1.2 Integrarlo antes de resolver el nombre del comando y devolver el rechazo como texto; verificar que no se invoca el ejecutor en un caso compuesto.
- [x] 1.3 Cubrir comillas simples y dobles con operadores adentro; verificar que no se rechazan comandos válidos.

## 2. Plataforma Windows

- [x] 2.1 Agregar `CATALOGO_COMANDOS_WINDOWS` y hacer que `crearHerramientaShell` devuelva la herramienta en `win32` con nombre `powershell`; verificar con un test de `plataforma: 'win32'`.
- [x] 2.2 Implementar la ejecución con `spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', comando])`; verificar con el `ejecutor` inyectado y con la ruta por defecto.
- [x] 2.3 Extraer el nombre del binario contemplando `\`, `C:\...` y `.exe`, en minúsculas; verificar con tests de rutas Windows.
- [x] 2.4 Rechazar los comandos de borrado (`remove-item`, `del`, `erase`, `rd`, `rmdir`, `rm`) en Windows; verificar cada uno como test.
- [x] 2.5 Mantener la lista negra Unix sin cambios y verificar que Windows no la necesita.

## 3. Unix

- [x] 3.1 Verificar que Linux y macOS siguen exponiendo `bash` y ejecutando contra `/bin/sh`; correr los tests existentes de shell.
- [x] 3.2 Agregar el rechazo de comandos compuestos a los tests de Unix; verificar que `cat x && rm -rf /` ya no se ejecuta.

## 4. Tests de los escenarios nuevos

- [x] 4.1 Test «En Windows se usa PowerShell»: plataforma `win32` devuelve herramienta y usa el intérprete esperado.
- [x] 4.2 Test «Un comando compuesto»: se rechaza sin ejecutar y el mensaje explica la regla.
- [x] 4.3 Reemplazar el test de «La herramienta no está disponible en Windows» por los dos anteriores; verificar el conteo de 33 escenarios.

## 5. Documentación y cierre

- [x] 5.1 Actualizar la decisión 3 de `AGENTS.md` y el bloque de Windows de `openspec/config.yaml`; verificar que ya no dicen que la ejecución no está disponible.
- [x] 5.2 Anotar en `design.md` o `AGENTS.md` la deuda de CI de Windows; verificar que la limitación es explícita.
- [x] 5.3 Correr `npm run check` y verificar lint, typecheck y tests en verde.
