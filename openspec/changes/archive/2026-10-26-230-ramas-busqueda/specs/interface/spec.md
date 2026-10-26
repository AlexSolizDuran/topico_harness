# Spec Delta

## ADDED Requirements

### Requirement: La interfaz permite crear una rama de la sesión activa
La interfaz SHALL aceptar `/rama <n>` para crear una sesión nueva desde el turno
`n` de la sesión activa y SHALL cambiarla a esa rama. Si `n` no es un entero mayor
o igual que cero, SHALL mostrar un error y conservar la sesión activa. Si la sesión
no tiene ese turno, SHALL mostrar el error de la sesión y conservar la activa.

#### Scenario: Crear una rama desde la interfaz
- **WHEN** el usuario ejecuta `/rama <n>` con un turno válido
- **THEN** la interfaz pasa a la sesión nueva y muestra un aviso

#### Scenario: Un número de turno inválido
- **WHEN** el usuario ejecuta `/rama` sin un número válido
- **THEN** la interfaz muestra un error y conserva la sesión activa

---

### Requirement: La interfaz permite buscar en las sesiones
La interfaz SHALL aceptar `/sesiones buscar <texto>` y SHALL mostrar las sesiones
con coincidencias, su cantidad y un fragmento. Si no hay coincidencias SHALL
mostrar un panel vacío. Sin texto SHALL mostrar el uso del comando.

#### Scenario: Buscar desde la interfaz
- **WHEN** el usuario ejecuta `/sesiones buscar <texto>` con coincidencias
- **THEN** la interfaz muestra las sesiones encontradas con su fragmento

#### Scenario: Búsqueda sin coincidencias
- **WHEN** el usuario busca un texto que no aparece en ninguna sesión
- **THEN** la interfaz muestra que no hay coincidencias
