/**
 * Parser COMISIONES EXPERTOS — PDF simple
 *
 * Tabla directa con columnas:
 *   POLIZA | ASEGURADORA | CLIENTE | PRIMA | COMISION TOTAL | COMISION ASESOR
 *
 * Se usa COMISION ASESOR como valor_comision.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/[$.]/g, '').replace(',', '.').trim()) || 0
}

export async function parseExpertos(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse')
    const { text } = await new PDFParse({ data: Buffer.from(buffer) }).getText()

    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    const headerIdx = lines.findIndex((l: string) =>
      /POLIZA/i.test(l) && /CLIENTE/i.test(l) && /COMISION/i.test(l)
    )
    if (headerIdx === -1) {
      return { ok: false, error: 'No se encontró la tabla en el PDF de Expertos' }
    }

    const resultado: ColillaLineaRaw[] = []

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i]
      if (/^TOTAL/i.test(line) || line === '') break

      // Formato: POLIZA  ASEGURADORA  CLIENTE  PRIMA  COMISION_TOTAL  COMISION_ASESOR
      const parts = line.split(/\s{2,}/)
      if (parts.length < 5) continue

      const poliza = parts[0]?.trim()
      if (!poliza || !/\d/.test(poliza)) continue

      const cliente        = parts[2]?.trim()
      const prima          = parseNum(parts[3] ?? '')
      const comisionAsesor = parseNum(parts[parts.length - 1] ?? '')

      resultado.push({
        numero_poliza_raw: poliza,
        nombre_tomador:    cliente,
        valor_prima:       prima,
        valor_comision:    comisionAsesor,
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
