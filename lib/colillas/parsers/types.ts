export interface ColillaLineaRaw {
  numero_poliza_raw: string
  nombre_tomador?: string
  valor_prima?: number
  valor_comision?: number
  porcentaje_comision?: number
  fecha_pago?: string       // 'YYYY-MM-DD'
  fecha_recaudo?: string    // 'YYYY-MM-DD'
  retefuente?: number
  /** Solo 48 Horas: la columna de identificación es VOUCHER, no número de póliza */
  requiere_mapeo_manual?: boolean
}

export type ParseResult =
  | { ok: true;  lineas: ColillaLineaRaw[] }
  | { ok: false; error: string }
