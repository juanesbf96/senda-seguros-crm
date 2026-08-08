/**
 * Derivación de la prima de una póliza colectiva a partir de la suma de sus
 * afiliados.
 *
 * Por qué existe este módulo: los cuatro componentes de `components/afiliados/`
 * recalculaban la prima escribiendo **solo la columna legacy `polizas.prima`**,
 * mientras la UI muestra `prima_neta` / `total_prima`. El recálculo quedaba
 * invisible y las columnas en desacuerdo entre sí.
 *
 * La fórmula vive acá, pura y con tests, para que los cinco puntos de escritura
 * no puedan volver a divergir — es la lección de la fase 0.1 (mapeos sin
 * cobertura corrompieron producción dos veces).
 *
 * Regla de negocio (confirmada por el owner):
 *   La suma de las primas de los afiliados ES la prima NETA (sin IVA).
 *   El IVA de estas pólizas es siempre 19%.
 */

/** IVA de las pólizas colectivas. Fuente única: cambiar acá lo cambia en los 5 sitios. */
export const IVA_COLECTIVAS = 19

export interface PrimaColectiva {
  /** Columna legacy: se mantiene sincronizada con `prima_neta`. */
  prima: number
  prima_neta: number
  iva: number
  total_prima: number
  porcentaje_iva: number
}

function redondear2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Devuelve el objeto de `update` completo para la póliza.
 *
 * Se devuelve el payload entero (y no solo los números) a propósito: los cinco
 * call sites lo pasan verbatim a `.update(...)`, así que ninguno puede olvidarse
 * una columna ni escribir una fórmula propia.
 *
 * `prima` se sincroniza con `prima_neta` porque todavía hay lectores de la
 * columna legacy (metas, asistente, la tabla de Cumplimiento y la propia vista
 * de afiliados). Dejarla desincronizada reintroduciría la misma incoherencia
 * por el otro lado.
 */
export function derivarPrimaColectiva(primaNeta: number): PrimaColectiva {
  const neta = redondear2(primaNeta)
  const iva = redondear2(neta * (IVA_COLECTIVAS / 100))
  return {
    prima: neta,
    prima_neta: neta,
    iva,
    total_prima: redondear2(neta + iva),
    porcentaje_iva: IVA_COLECTIVAS,
  }
}
