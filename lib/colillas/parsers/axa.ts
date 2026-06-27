/**
 * Parser AXA Colpatria — PDF texto
 *
 * La tabla útil aparece en la página 2 (o donde esté el header):
 *   POLIZA  TOMADOR  VR RECAUDO  VR COMISION  FECHA RE  %
 *
 * Estrategia: parsear texto completo, localizar header, leer filas hasta
 * encontrar "TOTAL" o línea en blanco larga.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/[$.]/g, '').replace(',', '.').trim()) || 0
}

function parseDate(raw: string): string {
  // Puede venir 'DD/MM/YYYY' o 'YYYY-MM-DD'
  if (!raw) return ''
  if (raw.includes('/')) {
    const [d, m, y] = raw.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return raw.substring(0, 10)
}

export async function parseAxa(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PDFParse } = require('pdf-parse')
    const { text } = await new PDFParse({ data: Buffer.from(buffer) }).getText()

    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    // Localizar header
    const headerIdx = lines.findIndex((l: string) =>
      /POLIZA/i.test(l) && /COMISION/i.test(l)
    )
    if (headerIdx === -1) {
      return { ok: false, error: 'No se encontró la tabla de comisiones en el PDF de AXA' }
    }

    const resultado: ColillaLineaRaw[] = []

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i]
      if (/^TOTAL/i.test(line) || /^Página/i.test(line)) break

      // Las columnas en el PDF de AXA vienen separadas por espacios múltiples
      // Patrón: número de póliza (todo números o alfanumérico), luego datos
      const match = line.match(
        /^(\S+)\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+(\d{2}[/\-]\d{2}[/\-]\d{4})\s+([\d.]+)%?/
      )
      if (!match) continue

      const [, poliza, tomador, vrRecaudo, vrComision, fecha] = match
      if (!poliza || !/\d/.test(poliza)) continue

      resultado.push({
        numero_poliza_raw:   poliza.trim(),
        nombre_tomador:      tomador.trim(),
        valor_prima:         parseNum(vrRecaudo),
        valor_comision:      parseNum(vrComision),
        fecha_pago:          parseDate(fecha),
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'No se encontraron líneas de comisión en el PDF de AXA' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing AXA: ${String(e)}` }
  }
}
