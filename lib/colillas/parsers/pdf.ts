/**
 * Carga compartida de pdf-parse para entornos serverless (Vercel).
 *
 * Dos problemas resueltos aquí, en un solo lugar:
 *
 * 1. "DOMMatrix is not defined": pdfjs-dist necesita APIs de canvas que no
 *    existen en Node; se pasa CanvasFactory (respaldado por @napi-rs/canvas)
 *    al construir PDFParse.
 *
 * 2. "Setting up fake worker failed: Cannot find module .../pdf.worker.mjs":
 *    en Vercel el file-tracing no incluye el worker de pdfjs porque se carga
 *    con un import dinámico de ruta calculada. Se configura el worker con
 *    getData() (data-URI con el worker embebido) para no depender de ningún
 *    archivo en disco en runtime.
 *
 * Los parsers PDF (Quálitas, AXA, Expertos, Bolívar) deben obtener PDFParse
 * SOLO a través de este helper.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDFParseCtor = new (opts: { data: Buffer; CanvasFactory: unknown }) => {
  getText(): Promise<{ text: string }>
}

let cached: { PDFParse: PDFParseCtor; CanvasFactory: unknown } | null = null

export function getPdfParser(): { PDFParse: PDFParseCtor; CanvasFactory: unknown } {
  if (cached) return cached

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const worker = require('pdf-parse/worker')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFParse } = require('pdf-parse')

  // Worker embebido como data-URI: funciona aunque el .mjs no exista en el bundle
  PDFParse.setWorker(worker.getData())

  cached = { PDFParse, CanvasFactory: worker.CanvasFactory }
  return cached
}

/** Extrae el texto completo de un PDF (con worker y canvas ya configurados). */
export async function extraerTextoPdf(buffer: ArrayBuffer): Promise<string> {
  const { PDFParse, CanvasFactory } = getPdfParser()
  const { text } = await new PDFParse({ data: Buffer.from(buffer), CanvasFactory }).getText()
  return text
}
