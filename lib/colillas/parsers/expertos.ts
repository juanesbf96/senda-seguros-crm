/**
 * Parser COMISIONES EXPERTOS — PDF de recibo de comisión
 *
 * El layout es una "cuenta de cobro" (no una tabla de filas homogénea):
 * en el texto extraído, cada línea de póliza queda como
 *   POLIZA<tab>ASEGURADORA<tab>CLIENTE
 * y la línea siguiente trae los 3 montos (PRIMA, COMISION TOTAL, COMISION ASESOR)
 * con separador de miles '.', normalmente antecedidos por un código de concepto
 * (p.ej. "ANG") y seguidos de signos "$" sueltos.
 * Se usa COMISION ASESOR (el 3er monto) como valor_comision.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.').trim()) || 0
}

const MONTO_RE = /\d{1,3}(?:\.\d{3})+/g

export async function parseExpertos(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CanvasFactory } = require('pdf-parse/worker')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse')
    const { text } = await new PDFParse({ data: Buffer.from(buffer), CanvasFactory }).getText()

    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    const resultado: ColillaLineaRaw[] = []

    for (let i = 0; i < lines.length; i++) {
      const headerMatch = lines[i].match(/^(\d{5,})\s+(\S+)\s+(.+)$/)
      if (!headerMatch) continue

      const [, poliza, , cliente] = headerMatch
      const montos = (lines[i + 1] ?? '').match(MONTO_RE)
      if (!montos || montos.length < 3) continue

      resultado.push({
        numero_poliza_raw: poliza,
        nombre_tomador:    cliente.trim(),
        valor_prima:       parseNum(montos[0]),
        valor_comision:    parseNum(montos[2]),
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'No se encontraron líneas en el PDF de Expertos' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing Expertos: ${String(e)}` }
  }
}
