/**
 * Parser 48 HORAS — XLSX con VOUCHER (no número de póliza estándar)
 *
 * IMPORTANTE: El identificador de 48 Horas es VOUCHER, no el número de póliza
 * del CRM. Todas las líneas se marcan con requiere_mapeo_manual = true.
 * El usuario deberá vincular manualmente cada línea a una póliza en el paso 3.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  return parseFloat(String(val).replace(/[$.]/g, '').replace(',', '.')) || 0
}

function findCol(headers: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h =>
      String(h ?? '').toLowerCase().includes(c.toLowerCase())
    )
    if (idx !== -1) return idx
  }
  return -1
}

export async function parseCuarentaYOchoHoras(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const wb   = XLSX.read(Buffer.from(buffer), { type: 'buffer' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

    // Buscar fila de headers
    let headerIdx = -1
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i] as string[]
      if (row.some(c => /voucher/i.test(String(c ?? '')))) {
        headerIdx = i
        break
      }
    }

    if (headerIdx === -1) {
      return { ok: false, error: 'No se encontró columna VOUCHER en el archivo de 48 Horas' }
    }

    const headers    = (rows[headerIdx] as unknown[]).map(c => String(c ?? ''))
    const colVoucher = findCol(headers, 'voucher')
    const colComision = findCol(headers, 'comision', 'comisión', 'valor comision')
    const colPrima    = findCol(headers, 'prima', 'valor prima', 'importe')
    const colTomador  = findCol(headers, 'tomador', 'cliente', 'nombre')

    const resultado: ColillaLineaRaw[] = []

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row     = rows[i] as unknown[]
      const voucher = String(row[colVoucher] ?? '').trim()
      if (!voucher || voucher === '') continue

      resultado.push({
        numero_poliza_raw:    voucher,   // VOUCHER, NO es número de póliza del CRM
        nombre_tomador:       colTomador  !== -1 ? String(row[colTomador] ?? '') : undefined,
        valor_prima:          colPrima    !== -1 ? parseNum(row[colPrima])   : undefined,
        valor_comision:       colComision !== -1 ? parseNum(row[colComision]) : undefined,
        requiere_mapeo_manual: true,     // Siempre true para 48 Horas
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'No se encontraron filas en el archivo de 48 Horas' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing 48 Horas: ${String(e)}` }
  }
}
