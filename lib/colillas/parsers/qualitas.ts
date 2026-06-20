/**
 * Parser QUÁLITAS — PDF estado de cuenta
 *
 * Filtrar solo filas con CVE = 'ACN' (comisión normal).
 * Columnas relevantes: PÓLIZA | IMPORTE | % COMIS. | COMISIÓN
 * Las filas de subtotal/total no tienen número de póliza válido.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/[$.,$]/g, '').replace(',', '.').trim()) || 0
}

export async function parseQualitas(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const { text } = await pdfParse(Buffer.from(buffer))

    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    const resultado: ColillaLineaRaw[] = []

    for (const line of lines) {
      // Solo procesar líneas que contengan CVE ACN (comisión normal)
      if (!/ACN/i.test(line)) continue

      // Buscar número de póliza: cadena alfanumérica de 6+ chars que no sea "ACN"
      const parts = line.split(/\s+/)
      const polizaIdx = parts.findIndex((p: string) => /^[A-Z0-9]{6,}$/i.test(p) && !/ACN/i.test(p))
      if (polizaIdx === -1) continue

      const poliza     = parts[polizaIdx]
      const numeros    = parts.filter((p: string) => /^[\d.,]+$/.test(p)).map(parseNum)
      if (numeros.length < 2) continue

      // El importe es el mayor, la comisión el último número relevante
      const importe   = numeros[0] ?? 0
      const comision  = numeros[numeros.length - 1] ?? 0
      const pct       = numeros.length >= 3 ? numeros[1] : undefined

      resultado.push({
        numero_poliza_raw:   poliza,
        valor_prima:         importe,
        valor_comision:      comision,
        porcentaje_comision: pct,
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
