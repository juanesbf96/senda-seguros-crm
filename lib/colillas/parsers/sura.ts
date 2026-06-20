/**
 * Parser SURA — aplica a EPS, Generales y Vida (mismo schema CSV)
 *
 * Formato: CSV separado por ';', encoding latin-1 (decodificar antes de llamar)
 * Columnas (0-indexed):
 *   [0]  Código asesor
 *   [4]  Póliza
 *   [7]  Nombre Tomador
 *   [10] Valor Prima
 *   [14] % Comisión
 *   [16] Valor Comisión
 *   [22] Fecha Recaudo  ('2026-05-29 00:00:00.0')
 *   [24] Fecha Pago     ('2026-06-10 00:00:00.0')
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.')) || 0
}

function parseDate(raw: string): string {
  // '2026-05-29 00:00:00.0' → '2026-05-29'
  return raw ? raw.substring(0, 10) : ''
}

export function parseSura(texto: string): ParseResult {
  try {
    const lineas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    // Saltar cabecera
    const filas = lineas.slice(1)
    const resultado: ColillaLineaRaw[] = []

    for (const fila of filas) {
      const cols = fila.split(';').map(c => c.replace(/^"|"$/g, '').trim())
      if (cols.length < 25) continue

      const numeroPoliza = cols[4]
      if (!numeroPoliza) continue

      const valorComision = parseNum(cols[16])
      // Agrupar por póliza: si ya existe la línea, sumar comisión
      const existing = resultado.find(r => r.numero_poliza_raw === numeroPoliza)
      if (existing) {
        existing.valor_comision = (existing.valor_comision ?? 0) + valorComision
        existing.valor_prima    = (existing.valor_prima    ?? 0) + parseNum(cols[10])
        continue
      }

      resultado.push({
        numero_poliza_raw:    numeroPoliza,
        nombre_tomador:       cols[7],
        valor_prima:          parseNum(cols[10]),
        valor_comision:       valorComision,
        porcentaje_comision:  parseFloat(cols[14]) || 0,
        fecha_recaudo:        parseDate(cols[22]),
        fecha_pago:           parseDate(cols[24]),
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'El archivo SURA no contiene filas de datos válidas' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing SURA: ${String(e)}` }
  }
}
