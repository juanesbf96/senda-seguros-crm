/**
 * Fórmulas de comisión — fuente única de verdad.
 *
 * Antes estas cuentas estaban duplicadas en PolizaModal, PolizaDetalle,
 * ImportPolizasModal, LiquidacionModal e importarPolizas. Cuando cambia una
 * regla (p.ej. el % de retención) había que cazarla en varios lugares.
 *
 * Estas funciones son puras y NO redondean: el redondeo es una decisión de
 * presentación/persistencia que cada caller aplica según su contexto
 * (preview en vivo sin redondear, valores guardados con `redondear2`).
 */

/** Retención por defecto sobre la comisión del vendedor, en % (si la póliza no define otra). */
export const RETENCION_VENDEDOR_DEFAULT = 10

/** Retención fija sobre la comisión de la agencia, en %. */
export const RETENCION_AGENCIA = 10

/** base × pct / 100 — el primitivo del que se componen las demás. */
export function pctDe(base: number, pct: number): number {
  return (base * pct) / 100
}

/** Comisión bruta de la agencia sobre la prima neta. */
export function comisionAgencia(primaNeta: number, pctAgencia: number): number {
  return pctDe(primaNeta, pctAgencia)
}

/** Comisión del vendedor: un % de la comisión (bruta) de la agencia. */
export function comisionVendedor(comisionAgenciaBruta: number, pctVendedor: number): number {
  return pctDe(comisionAgenciaBruta, pctVendedor)
}

/** Comisión del intermediario: un % de la comisión (bruta) de la agencia. */
export function comisionIntermediario(comisionAgenciaBruta: number, pctIntermediario: number): number {
  return pctDe(comisionAgenciaBruta, pctIntermediario)
}

/** Valor de la retención sobre una comisión bruta. */
export function retencion(bruta: number, pct: number = RETENCION_VENDEDOR_DEFAULT): number {
  return pctDe(bruta, pct)
}

/** Comisión neta = bruta − retención. */
export function comisionNeta(bruta: number, pct: number = RETENCION_VENDEDOR_DEFAULT): number {
  return bruta - retencion(bruta, pct)
}

/** Redondea a 2 decimales (para valores que se persisten). */
export function redondear2(v: number): number {
  return Math.round(v * 100) / 100
}
