# Tasks

## 1. Contrato y resolución

- [x] 1.1 Agregar `modelo?: string` a `Proveedor` y a todos los adaptadores, incluido el simulado, sin romper los tests existentes; verificar que `npm run typecheck` pasa.
- [x] 1.2 Exponer en la factory `resolver(proveedorId, modeloId)` y `listarModelos()`; verificar con tests de id válido e inválido.
- [x] 1.3 Verificar la credencial al resolver, sin instanciar el adaptador si falta; verificar que el error no incluye el valor.

## 2. Cambio en la sesión

- [x] 2.1 Implementar `cambiarModelo` atómico en `SesionInteractiva`; verificar con un test que un fallo deja el provider anterior.
- [x] 2.2 Rechazar el cambio con `turnoEnCurso`; verificar que el turno en curso no se altera.
- [x] 2.3 Reconstruir `PresupuestoContexto` con la ventana del modelo nuevo; verificar que el límite cambia.
- [x] 2.4 Conservar `mensajesHistorial` y `EstadoSesionVisual.historial`; verificar que el turno siguiente recibe el historial previo.
- [x] 2.5 Exponer `modeloActivo` y `modelosDisponibles` en la sesión; verificar el formato `proveedor/modelo`.

## 3. Comando en la TUI

- [x] 3.1 Reconocer `/modelo` y `/modelo proveedor/modelo` en `input.ts`; verificar que no se envían como pedido.
- [x] 3.2 Implementar la lista de modelos cuando no hay argumentos; verificar el contenido mostrado.
- [x] 3.3 Mostrar el modelo activo en la línea de estado; verificar con `renderToString`.
- [x] 3.4 Mostrar el error de cambio (desconocido, credencial, turno en curso) como aviso y mantener el modelo anterior; verificar cada caso.

## 4. Tests de los escenarios nuevos

- [x] 4.1 Test «Cambio entre turnos»: tras el cambio, el body del turno siguiente lleva el modelo nuevo.
- [x] 4.2 Test «El historial se conserva»: la cantidad de mensajes y el primer mensaje no cambian.
- [x] 4.3 Test «Cambio durante un turno»: se rechaza y el turno termina normalmente.
- [x] 4.4 Test «Modelo desconocido»: error y modelo anterior intacto.
- [x] 4.5 Test «Falta la credencial del modelo nuevo»: error y modelo anterior intacto.
- [x] 4.6 Test «El modelo nuevo no soporta herramientas»: el body no incluye `tools`.

## 5. Cierre

- [x] 5.1 Actualizar `openspec/config.yaml` con 44 requisitos y 123 escenarios y documentar `/modelo` en `AGENTS.md`; verificar `openspec validate --all`.
- [x] 5.2 Correr `npm run check` y verificar lint, typecheck y tests en verde.
