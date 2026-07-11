/**
 * Parser VIVA — XLSX multi-sección
 *
 * El archivo tiene múltiples secciones, una por aseguradora.
 * El inicio de sección se detecta cuando la col A tiene texto (nombre aseguradora)
 * pero no es un número de póliza.
 * Dentro de cada sección, las filas con POLIZA en col A y DEVENGADOS son las de comisión.
 *
 * Allianz usa un formato de póliza distinto dentro de este mismo archivo:
 *   "[número de póliza]/[período de renovación]"  (ej: "23475157/0")
 * El número de póliza en el CRM no incluye el período de renovación, así que
 * se descarta ese sufijo para poder conciliar contra la tabla de pólizas.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  // xlsx ya entrega celdas numéricas como number; solo limpiar si viene como texto
  if (typeof val === 'number') return val
  return parseFloat(String(val).replace(/[$.]/g, '').replace(',', '.')) || 0
}

function isPoliza(val: unknown): boolean {
  const s = String(val ?? '').trim()
  return s.length >= 5 && /^\d/.test(s)
}

// "23475157/0" (Allianz) → "23475157"; el resto de aseguradoras no trae '/'
function limpiarNumeroPoliza(val: unknown): string {
  return String(val ?? '').trim().split('/')[0]
}

export async function parseViva(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const wb   = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

    const resultado: ColillaLineaRaw[] = []

    // Buscar filas con header de tabla (contiene POLIZA y algún indicador de monto)
    let colPoliza    = 0
    let colAsegurado = -1
    let colDevengado = -1
    let colPrima     = -1

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const rowStr = row.map(c => String(c ?? '').toLowerCase())

      // Detectar fila de headers de sub-tabla
      if (rowStr.some(c => c.includes('poliza') || c.includes('póliza'))) {
        colPoliza    = rowStr.findIndex(c => c.includes('poliza') || c.includes('póliza'))
        colAsegurado = rowStr.findIndex(c => c.includes('asegurado'))
        colDevengado = rowStr.findIndex(c => c.includes('devengado'))
        colPrima     = rowStr.findIndex(c => c.includes('prima') || c.includes('valor recaudo'))
        continue
      }

      // Filas de datos: col A tiene número de póliza
      const polVal = row[colPoliza]
      if (!isPoliza(polVal)) continue

      resultado.push({
        numero_poliza_raw: limpiarNumeroPoliza(polVal),
        nombre_tomador:    colAsegurado !== -1 ? String(row[colAsegurado] ?? '').trim() || undefined : undefined,
        valor_prima:       colPrima     !== -1 ? parseNum(row[colPrima])     : undefined,
        valor_comision:    colDevengado !== -1 ? parseNum(row[colDevengado]) : undefined,
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'No se encontraron filas de póliza en el archivo VIVA' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing VIVA: ${String(e)}` }
  }
}
