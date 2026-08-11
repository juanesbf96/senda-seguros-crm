/**
 * Identificación de clientes por documento — fuente única.
 *
 * Existe por F4: los clientes se estaban creando dos veces. Medido en producción,
 * los duplicados vienen de DOS caminos distintos:
 *   1. El import de clientes insertaba a ciegas, sin mirar si ya existían
 *      (pares creados con minutos de diferencia = el mismo archivo importado
 *      dos veces).
 *   2. El alta manual no verificaba por documento antes de insertar
 *      (duplicados creados con días de diferencia).
 *
 * La normalización vive acá, pura y testeada, para que los tres caminos que
 * crean clientes —alta manual, import, y el alta desde el extractor de
 * carátulas— decidan "¿este cliente ya existe?" con el MISMO criterio. Sin
 * esto, F11 (crear el cliente al vuelo desde una póliza) volvería a duplicar.
 */

/**
 * Deja solo los dígitos del documento.
 *
 * Los documentos llegan escritos de muchas formas —'900.123.456-7',
 * '900123456', '43.215.678'— y compararlos como texto crudo trata al mismo
 * documento como si fueran varios, que es justamente cómo nacen los duplicados.
 */
export function normalizarDocumento(doc: string | null | undefined): string {
  return (doc ?? '').replace(/\D/g, '')
}

/**
 * Formas alternativas de un mismo documento, para buscarlo en la base.
 *
 * Incluye el valor crudo (así está guardado en muchas filas históricas), el de
 * solo dígitos, y —para NIT— el número sin el dígito de verificación, porque
 * unos registros lo guardan con DV y otros sin él.
 */
export function variantesDocumento(doc: string | null | undefined): string[] {
  const crudo = (doc ?? '').trim()
  if (!crudo) return []
  const digitos = normalizarDocumento(crudo)
  if (!digitos) return []
  const sinDv = digitos.length > 9 ? digitos.slice(0, -1) : null
  return [...new Set([crudo, digitos, sinDv].filter(Boolean) as string[])]
}

/** ¿Dos documentos identifican a la misma persona/empresa? */
export function mismoDocumento(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarDocumento(a)
  const nb = normalizarDocumento(b)
  if (!na || !nb) return false
  if (na === nb) return true
  // NIT con y sin dígito de verificación: '9001234567' vs '900123456'.
  const [largo, corto] = na.length > nb.length ? [na, nb] : [nb, na]
  return largo.length === corto.length + 1 && largo.startsWith(corto)
}

/**
 * Índice documento → id de cliente, para deduplicar un lote sin una query por fila.
 * Cada cliente se indexa por todas sus variantes, así el lookup acierta venga
 * como venga escrito el documento en el archivo.
 */
export interface ClienteConDocumento {
  id: string
  nombre?: string | null
  cedula?: string | null
  nit?: string | null
}

export function indexarPorDocumento(clientes: ClienteConDocumento[]): Map<string, ClienteConDocumento> {
  const idx = new Map<string, ClienteConDocumento>()
  for (const c of clientes) {
    for (const doc of [c.cedula, c.nit]) {
      const d = normalizarDocumento(doc)
      if (!d) continue
      if (!idx.has(d)) idx.set(d, c)
      // También sin dígito de verificación, para que un NIT escrito de las dos
      // formas encuentre la misma fila.
      if (d.length > 9) {
        const sinDv = d.slice(0, -1)
        if (!idx.has(sinDv)) idx.set(sinDv, c)
      }
    }
  }
  return idx
}

/** Busca en el índice el cliente que ya existe para ese documento, o null. */
export function buscarEnIndice(
  idx: Map<string, ClienteConDocumento>,
  doc: string | null | undefined,
): ClienteConDocumento | null {
  const d = normalizarDocumento(doc)
  if (!d) return null
  return idx.get(d) ?? (d.length > 9 ? idx.get(d.slice(0, -1)) ?? null : null)
}
