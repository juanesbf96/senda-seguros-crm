/**
 * Parser SBS — archivo XLS (legacy Excel)
 *
 * Headers en la fila 9 (índice 8).
 * Columnas clave: Póliza | Comisión Acreditada | Prima Cobrada
 * Ignorar filas donde Póliza está vacío o es texto de sección.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  // xlsx ya entrega celdas numéricas como number; solo limpiar si viene como texto
  if (typeof val === 'number') return val
  return parseFloat(String(val).replace(/[$.]/g, '').replace(',', '.')) || 0
}

function findCol(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h =>
      h?.toString().toLowerCase().includes(c.toLowerCase())
    )
    if (idx !== -1) return idx
  }
  return -1
}

export async function parseSbs(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const wb   = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

    // Buscar fila de headers (contiene texto "Póliza" o "Poliza")
    let headerRowIdx = 8 // default fila 9
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i] as string[]
      if (row.some(c => /p[oó]liza/i.test(String(c ?? '')))) {
        headerRowIdx = i
        break
      }
    }

    const headers = (rows[headerRowIdx] as string[]).map(c => String(c ?? ''))

    const colPoliza    = findCol(headers, 'póliza', 'poliza', 'número poliza', 'no poliza')
    const colComision  = findCol(headers, 'comisión acreditada', 'comision acreditada', 'comisión')
    const colPrima     = findCol(headers, 'prima cobrada', 'prima', 'valor prima')
    const colTomador   = findCol(headers, 'documento - asegurado', 'asegurado', 'documento')

    if (colPoliza === -1) {
      return { ok: false, error: 'No se encontró la columna Póliza en el archivo SBS' }
    }

    const resultado: ColillaLineaRaw[] = []

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row  = rows[i] as unknown[]
      const pol  = String(row[colPoliza] ?? '').trim()
      if (!pol || !/\d/.test(pol)) continue  // saltar filas de sección o vacías

      resultado.push({
        numero_poliza_raw: pol,
        nombre_tomador:    colTomador !== -1 ? String(row[colTomador] ?? '').trim() || undefined : undefined,
        valor_prima:       colPrima   !== -1 ? parseNum(row[colPrima])   : undefined,
        valor_comision:    colComision !== -1 ? parseNum(row[colComision]) : undefined,
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'No se encontraron filas de póliza en el archivo SBS' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing SBS: ${String(e)}` }
  }
}
