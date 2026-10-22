# Tasks

## 1. Definiciones

- [ ] 1.1 Crear `src/agents/definiciones.ts` con el tipo de agente, la
  validación y errores explícitos; verificar con los escenarios de definición
  inválida.
- [ ] 1.2 Crear `src/agents/defaults.ts` con el agente completo y el de solo
  lectura, armados con las herramientas disponibles; verificar el escenario sin
  archivo de agentes.

## 2. Carga

- [ ] 2.1 Crear `src/agents/cargar.ts`: leer `.harness/agents.json`, mergear con
  los defaults por nombre y resolver el agente por defecto; verificar el
  escenario de lectura al arrancar.
- [ ] 2.2 Fallar con un mensaje explícito ante JSON inválido o un agente por
  defecto inexistente.

## 3. Registro filtrado

- [ ] 3.1 Agregar `filtrar(nombres)` y `listarNombres()` a
  `RegistroHerramientas` sin mutar el original; verificar con un test.
- [ ] 3.2 Entregar al turno el registro del agente activo; verificar que la
  petición solo incluye sus herramientas y que una herramienta no declarada se
  rechaza.

## 4. Sesión

- [ ] 4.1 Agregar agentes, agente activo y `cambiarAgente` a `SesionInteractiva`,
  conservando historial y modelo.
- [ ] 4.2 Rechazar el cambio durante un turno en curso.
- [ ] 4.3 Componer el prompt efectivo con el prompt base y el del agente.

## 5. Interfaz

- [ ] 5.1 Agregar `agenteActivo` al estado visual y a la barra de estado.
- [ ] 5.2 Implementar el ciclo con `Tab` y el comando `/agente` con su lista,
  mostrando solo primarios.
- [ ] 5.3 Agregar `--agente` a los argumentos y a la ayuda.

## 6. Tests de los escenarios nuevos

- [ ] 6.1 Tests de `agents`: definición declarativa, modos, herramientas,
  agente activo, definición inválida y defaults.
- [ ] 6.2 Tests de `interface`: barra con agente, cambio por atajo, elección
  desde la lista y conservación entre turnos.
- [ ] 6.3 Extender el test de dependencias para que `core/` no importe `agents/`.

## 7. Cierre

- [ ] 7.1 Crear `.harness/agents.json` y la excepción en `.gitignore`.
- [ ] 7.2 Correr `npm run check` y verificar lint, typecheck y tests en verde.
- [ ] 7.3 Correr `openspec validate --all` y verificar el change.
- [ ] 7.4 Actualizar `AGENTS.md` y `openspec/config.yaml` con la capacidad y los
  conteos nuevos.
