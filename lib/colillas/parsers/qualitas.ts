/**
 * Parser QUÁLITAS — PDF estado de cuenta
 *
 * Filtrar solo filas con CVE = 'ACN' (comisión normal).
 * Columnas reales: FECHA PÓLIZA ENDOSO RECIBO SERIE REG.CTB. CVE
 *                  ASEGURADO/CONCEPTO IMPORTE %COMIS. COMISIÓN IVA.PAG
 *                  RETEFUENTE RETEICA RETEIVA CARGO ABONO
 * Las filas de subtotal/total (TOT. RAMO, SALDO, etc.) no tienen CVE ACN.
 */
import type { ColillaLineaRaw, ParseResult } from './types'
import { extraerTextoPdf } from './pdf'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/,/g, '').trim()) || 0
}

// FECHA POLIZA ENDOSO RECIBO SERIE REG.CTB. ACN ASEGURADO(lazy) IMPORTE %COMIS COMISION
const FILA_ACN_RE =
  /^\d{1,2}\s+(\d+)\s+\d+\s+\d+\s+\S+\s+\d+\s+ACN\s+(.+?)\s+([\d,]+)\s+([\d.]+)\s+([\d,]+)\s/i

export async function parseQualitas(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const text = await extraerTextoPdf(buffer)

    const lines = text.split('\n').map((l: string) => `${l.trim()} `)

    const resultado: ColillaLineaRaw[] = []

    for (const line of lines) {
      const match = line.match(FILA_ACN_RE)
      if (!match) continue

      const [, poliza, asegurado, importe, pct, comision] = match
      if (!poliza || poliza === '0' || /^0+$/.test(poliza)) continue

      resultado.push({
        numero_poliza_raw:   poliza,
        nombre_tomador:      asegurado.trim(),
        valor_prima:         parseNum(importe),
        porcentaje_comision: parseNum(pct),
        valor_comision:      parseNum(comision),
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'No se encontraron líneas ACN en el PDF de Quálitas' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing Quálitas: ${String(e)}` }
  }
}
