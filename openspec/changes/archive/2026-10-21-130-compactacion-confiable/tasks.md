# Tasks

## 1. Presupuesto entre pasos

- [x] 1.1 Agregar `prepararHistorial` a `OpcionesTurno` y llamarlo antes de cada
  petición al provider; verificar con un test de dos pasos.
- [x] 1.2 Sincronizar el historial recortado con el estado final del turno;
  verificar que la petición siguiente no vuelve a incluir el contenido viejo.
- [x] 1.3 Devolver un error claro y no llamar al provider si el historial sigue
  fuera del presupuesto; verificar con un test de turno bloqueado.

## 2. Compactación repetida

- [x] 2.1 Repetir recorte y compactación al final del turno hasta quedar bajo el
  límite o hasta que no haya progreso; verificar con un historial que necesita
  más de una pasada.
- [x] 2.2 Marcar el resultado cuando el presupuesto no se puede satisfacer y
  exponerlo como aviso; verificar con un turno que no se puede reducir.
- [x] 2.3 Conservar un solo resumen automático al compactar dos veces; verificar
  el conteo de mensajes de resumen.

## 3. Calidad del resumen

- [x] 3.1 Conservar el contenido de resúmenes anteriores al generar uno nuevo;
  verificar que no se pierdan las rutas ya registradas.
- [x] 3.2 Mantener rutas con línea y correcciones observadas; verificar los
  escenarios existentes de resumen.

## 4. Métricas

- [x] 4.1 Crear `src/context/metrics.ts` con ventana, límite, uso, disponible,
  mensajes, consumo acumulado y última compactación.
- [x] 4.2 Exponer las métricas en `SesionInteractiva` y actualizarlas después de
  cada turno, compactación y cambio de modelo.
- [x] 4.3 Agregar `contexto` a `EstadoSesionVisual` sin romper el modo línea a
  línea.

## 5. Tests de los escenarios nuevos

- [x] 5.1 Test del presupuesto entre pasos.
- [x] 5.2 Test de compactación repetida.
- [x] 5.3 Test de resumen único.
- [x] 5.4 Test de presupuesto imposible de satisfacer.

## 6. Cierre

- [x] 6.1 Correr `npm run check` y verificar lint, typecheck y tests en verde.
- [x] 6.2 Correr `openspec validate --all` y verificar el change.
- [x] 6.3 Actualizar `AGENTS.md` y `openspec/config.yaml` con los conteos nuevos.
