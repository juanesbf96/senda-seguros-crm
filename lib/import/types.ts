/**
 * Tipos compartidos del import de pólizas desde Excel.
 * Usados por el modal (parseo client-side) y por el endpoint server-side
 * que hace las escrituras en bloque.
 */

export interface ExcelRow {
  // Flags
  es_renovacion: boolean
  mes_emision: string
  oneroso: boolean
  endoso_enviado: boolean
  cancelada_anterior: boolean
  aseguradora_anterior: string
  // Cliente
  tipo_poliza: string
  nombre: string
  tipo_documento: string
  cedula: string
  fecha_nacimiento: string
  telefono: string
  email: string
  // Póliza base
  fecha_inicio: string
  fecha_fin: string
  aseguradora: string
  numero_poliza: string
  ramo: string
  periodicidad: string
  // Financiero
  pct_comision_negocio: number | null
  prima_neta: number | null
  prima_periodica: number | null
  comision_agencia: number | null
  comision_periodica: number | null
  retencion_agencia: number | null
  // Intermediario
  intermediario: string
  pct_comision_int: number | null
  comision_intermediario: number | null
  // Asesor
  asesor: string
  pct_comision_asesor: number | null
  retencion_asesor: number | null
  comision_asesor: number | null
  // Referido
  referido: string
  pct_comision_referido: number | null
  retencion_referido: number | null
  comision_referido: number | null
  // ABC / Agencia neta
  comision_abc_periodica: number | null
  pct_comision_abc: number | null
  retencion_abc: number | null
  comision_abc_anual: number | null
  comision_recibida: boolean
  fecha_pago_abc: string
  asesor_pago_estado: 'pagada' | 'pendiente' | 'no_aplica'
  fecha_pago_asesor: string
}

export interface ImportResult {
  clientesCreados: number
  clientesExistentes: number
  polizasCreadas: number
  /** Filas que NO se importaron. */
  errores: string[]
  /**
   * Filas que SÍ se importaron, pero con un dato corregido o descartado.
   * Separado de `errores` a propósito: "no la importé" y "la importé pero
   * revisá este campo" exigen acciones distintas del usuario.
   */
  advertencias: string[]
}
