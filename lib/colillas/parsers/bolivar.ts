/**
 * Parser SEGUROS BOLÍVAR — PDF exportado desde el portal web (transac.segurosbolivar.com)
 *
 * El texto extraído NO trae una fila por póliza: el nombre del cliente
 * queda partido en varias líneas (una por palabra) y a veces incluso
 * cruza un salto de página. Lo único estable es:
 *   - una línea de metadata con el número de póliza (13 dígitos), y
 *   - unas líneas después, la línea de montos "$VLR_PRI $VLR_REC PART% $VLR_COM"
 * Formato numérico: separador de miles ',' y decimales '.' (estilo US),
 * a diferencia de los demás parsers PDF que usan estilo europeo.
 */
import type { ColillaLineaRaw, ParseResult } from './types'
import { extraerTextoPdf } from './pdf'

function parseNumUS(raw: string): number {
  return parseFloat(raw.replace(/,/g, '').trim()) || 0
}

const POLIZA_RE = /(\d{10,})/
const MONTOS_RE = /\$([\d,]+)\s+\$([\d,]+)\s+\d+\s+\$([\d,]+)/
const VENTANA_BUSQUEDA = 15

/** Lógica pura: parsea el texto ya extraído del PDF. Testeable sin pdf-parse. */
export function parseBolivarText(text: string): ParseResult {
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

  const resultado: ColillaLineaRaw[] = []

  for (let i = 0; i < lines.length; i++) {
    const polizaMatch = lines[i].match(POLIZA_RE)
    if (!polizaMatch) continue

    for (let j = i + 1; j < Math.min(i + VENTANA_BUSQUEDA, lines.length); j++) {
      const montosMatch = lines[j].match(MONTOS_RE)
      if (!montosMatch) continue

      const [, vlrPri, , vlrCom] = montosMatch
      resultado.push({
        numero_poliza_raw: polizaMatch[1],
        valor_prima:       parseNumUS(vlrPri),
        valor_comision:    parseNumUS(vlrCom),
      })
      break
    }
  }

  if (resultado.length === 0) {
    return { ok: false, error: 'No se encontraron líneas de comisión en el PDF de Bolívar' }
  }

  return { ok: true, lineas: resultado }
}

export async function parseBolivar(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    return parseBolivarText(await extraerTextoPdf(buffer))
  } catch (e) {
    return { ok: false, error: `Error parsing Bolívar: ${String(e)}` }
  }
}
