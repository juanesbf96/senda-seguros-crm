/**
 * Parser AXA Colpatria — PDF texto
 *
 * Cada concepto/página trae su propia tabla:
 *   POLIZA TOMADOR RECIBO RAMO PERIODO VR RECAUDO VR COMISION FECHA RE %
 * Un mismo estado de cuenta puede traer varias tablas (una por concepto),
 * así que se recorre el documento completo en vez de detenerse en el primer TOTAL.
 * Fecha viene en formato YYYYMMDD (sin separadores).
 */
import type { ColillaLineaRaw, ParseResult } from './types'
import { extraerTextoPdf } from './pdf'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/[$.]/g, '').replace(',', '.').trim()) || 0
}

function parseDate(raw: string): string {
  if (!raw) return ''
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  }
  if (raw.includes('/')) {
    const [d, m, y] = raw.split('/')
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return raw.substring(0, 10)
}

// POLIZA (.TOMADOR lazy) RECIBO RAMO PERIODO VR_RECAUDO VR_COMISION FECHA(8díg) %
const FILA_RE =
  /^(\d{6,})\s+(.+?)\s+\d+\s+\d+\s+\d+\s+([\d.,]+)\s+([\d.,]+)\s+(\d{8})\s+[\d,.]+/

export async function parseAxa(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    const text = await extraerTextoPdf(buffer)

    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    const resultado: ColillaLineaRaw[] = []
    let enTabla = false

    for (const line of lines) {
      if (/POLIZA/i.test(line) && /TOMADOR/i.test(line) && /COMISION/i.test(line)) {
        enTabla = true
        continue
      }
      if (!enTabla) continue

      if (/^TOTAL/i.test(line) || /^Página/i.test(line) || /^FIN DEL REPORTE/i.test(line)) {
        enTabla = false
        continue
      }

      const match = line.match(FILA_RE)
      if (!match) continue

      const [, poliza, tomadorRaw, vrRecaudo, vrComision, fecha] = match
      // El primer token de tomadorRaw suele ser un código numérico residual de columna, se descarta
      const tomador = tomadorRaw.replace(/^\d+\s+/, '').trim()

      resultado.push({
        numero_poliza_raw: poliza,
        nombre_tomador:    tomador,
        valor_prima:       parseNum(vrRecaudo),
        valor_comision:    parseNum(vrComision),
        fecha_pago:        parseDate(fecha),
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
