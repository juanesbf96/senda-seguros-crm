/**
 * Resolución del % de comisión de agencia por defecto (fase 2.6).
 *
 * Hay dos fuentes conviviendo:
 *   1. `ramos_aseguradora` — el catálogo formal (tabla, fase 2.6). Es la fuente
 *      preferente: está indexada por (aseguradora, ramo) y se gestiona desde
 *      Configuración → Ramos por aseguradora.
 *   2. `configuracion.comisiones_tarifas` — el JSON heredado. Se mantiene como
 *      respaldo para no perder tarifas que algún workspace ya tuviera, y porque
 *      PolizaModal todavía permite crear tarifas ahí.
 *
 * La precedencia se centraliza aquí para que el import y PolizaModal no puedan
 * divergir (el mismo problema que ya nos mordió con la normalización del número
 * de póliza).
 */

/** Fila del catálogo `ramos_aseguradora` con % definido. */
export interface TarifaCatalogo {
  aseguradora: string
  ramo: string
  pct_comision_default: number | null
  activo?: boolean
}

/** Tarifa del JSON heredado en `configuracion.comisiones_tarifas`. */
export interface TarifaLegacy {
  codigo?: string
  ramo: string
  aseguradora: string
  porcentaje: number
}

function igual(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

/**
 * Devuelve el % de comisión de agencia por defecto para (aseguradora, ramo).
 *
 * Orden de precedencia:
 *   1. Catálogo, coincidencia exacta aseguradora + ramo   ← el más específico
 *   2. JSON heredado, coincidencia exacta aseguradora + ramo
 *   3. JSON heredado, coincidencia solo por ramo          ← comportamiento previo
 *
 * Devuelve null si ninguna fuente aplica (el caller conserva el valor actual).
 */
export function pctComisionPorDefecto(
  catalogo: TarifaCatalogo[],
  legacy: TarifaLegacy[],
  aseguradora: string | null | undefined,
  ramo: string | null | undefined,
): number | null {
  if (!ramo) return null

  const delCatalogo = catalogo.find(c =>
    c.activo !== false &&
    c.pct_comision_default !== null && c.pct_comision_default !== undefined &&
    igual(c.aseguradora, aseguradora) && igual(c.ramo, ramo)
  )
  if (delCatalogo) return delCatalogo.pct_comision_default as number

  const exacta = legacy.find(t => igual(t.ramo, ramo) && igual(t.aseguradora, aseguradora))
  if (exacta) return exacta.porcentaje

  // Respaldo histórico: primera tarifa del ramo, sin importar la aseguradora.
  const porRamo = legacy.find(t => igual(t.ramo, ramo))
  return porRamo ? porRamo.porcentaje : null
}
