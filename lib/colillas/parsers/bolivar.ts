/**
 * Parser SEGUROS BOLÍVAR — PDF multi-bloque por empresa
 *
 * El PDF tiene secciones por compañía. Dentro de cada sección, las filas
 * de comisión tienen el concepto 71005 = COMISION GRAVADA.
 * Columnas: POLIZA | VLR PRI. | VLR COM.
 */
import type { ColillaLineaRaw, ParseResult } from './types'

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/[$.]/g, '').replace(',', '.').trim()) || 0
}

export async function parseBolivar(buffer: ArrayBuffer): Promise<ParseResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('pdf-parse')
    const pdfParse: (b: Buffer) => Promise<{ text: string }> = mod.default ?? mod
    const { text } = await pdfParse(Buffer.from(buffer))

    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    const resultado: ColillaLineaRaw[] = []

    for (const line of lines) {
      // Solo líneas con concepto 71005 (COMISION GRAVADA)
      if (!line.includes('71005')) continue

      const parts = line.split(/\s+/)
      // Formato típico: POLIZA  71005  COMISION GRAVADA  VLR_PRI  VLR_COM
      // La póliza es el primer token alfanumérico largo
      const polizaIdx = parts.findIndex((p: string) => /^[A-Z0-9]{6,}$/i.test(p) && !/71005/.test(p))
      if (polizaIdx === -1) continue

      const poliza   = parts[polizaIdx]
      const numeros  = parts.filter((p: string) => /^[\d.,]+$/.test(p) && parseNum(p) > 0).map(parseNum)
      if (numeros.length < 2) continue

      const vlrPrima    = numeros[0]
      const vlrComision = numeros[numeros.length - 1]

      resultado.push({
        numero_poliza_raw: poliza,
        valor_prima:       vlrPrima,
        valor_comision:    vlrComision,
      })
    }

    if (resultado.length === 0) {
      return { ok: false, error: 'No se encontraron líneas de comisión (71005) en el PDF de Bolívar' }
    }

    return { ok: true, lineas: resultado }
  } catch (e) {
    return { ok: false, error: `Error parsing Bolívar: ${String(e)}` }
  }
}
