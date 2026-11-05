import { z } from 'zod'

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function aplicarEnum(base: z.ZodTypeAny, valores: unknown[]): z.ZodTypeAny {
  if (valores.every((valor) => typeof valor === 'string')) {
    const textos = valores as [string, ...string[]]
    return z.enum(textos)
  }
  return base.refine((valor) => valores.includes(valor), {
    message: `El valor debe ser uno de: ${valores.map((v) => String(v)).join(', ')}`,
  })
}

function zodObjeto(esquema: Record<string, unknown>): z.ZodTypeAny {
  const propiedades = esObjeto(esquema.properties) ? esquema.properties : {}
  const requeridos = new Set(
    Array.isArray(esquema.required)
      ? esquema.required.filter(
          (clave): clave is string => typeof clave === 'string',
        )
      : [],
  )

  const forma: Record<string, z.ZodTypeAny> = {}
  for (const [clave, valor] of Object.entries(propiedades)) {
    const campo = jsonSchemaAZod(esObjeto(valor) ? valor : {})
    forma[clave] = requeridos.has(clave) ? campo : campo.optional()
  }
  for (const clave of requeridos) {
    if (!(clave in forma)) forma[clave] = z.unknown()
  }

  const objeto = z.object(forma)
  if (esquema.additionalProperties === false) {
    return objeto.strict()
  }
  if (esObjeto(esquema.additionalProperties)) {
    return objeto.catchall(jsonSchemaAZod(esquema.additionalProperties))
  }
  return objeto.passthrough()
}

function zodArreglo(esquema: Record<string, unknown>): z.ZodTypeAny {
  const items = esObjeto(esquema.items)
    ? jsonSchemaAZod(esquema.items)
    : z.unknown()
  return z.array(items)
}

function zodBase(esquema: Record<string, unknown>): z.ZodTypeAny {
  switch (esquema.type) {
    case 'object':
      return zodObjeto(esquema)
    case 'array':
      return zodArreglo(esquema)
    case 'string':
      return z.string()
    case 'integer':
      return z.number().int()
    case 'number':
      return z.number()
    case 'boolean':
      return z.boolean()
    case 'null':
      return z.null()
    default:
      // Sin tipo declarado, un objeto con `properties` se valida como objeto.
      // Cualquier otra forma queda sin restricción: el servidor decide.
      return esObjeto(esquema.properties) ? zodObjeto(esquema) : z.unknown()
  }
}

/**
 * Traduce el subconjunto de JSON Schema que declaran los servidores MCP
 * (`type`, `properties`, `required`, `enum`, `items`, `additionalProperties`)
 * a un esquema de zod. Lo que queda fuera del subconjunto no se inventa: el
 * campo se acepta sin restricción.
 */
export function jsonSchemaAZod(
  esquema?: Record<string, unknown>,
): z.ZodTypeAny {
  if (!esquema) return z.record(z.string(), z.unknown())

  const base = zodBase(esquema)
  if (Array.isArray(esquema.enum)) {
    return aplicarEnum(base, esquema.enum)
  }
  return base
}
