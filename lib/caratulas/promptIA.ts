// Fallback de IA para la extracción de carátulas (fase 4.1).
// Construye el prompt y parsea la respuesta JSON del motor de IA (4.3).
// Funciones puras — el motor lo llama el endpoint.

import { BorradorPoliza, PrimaDiscriminada } from '@/types'
import { normalizarMonto } from './heuristica'

/** Lo que la IA puede rellenar: campos del borrador + la prima discriminada. */
export type ExtraccionIA = Partial<BorradorPoliza> & Partial<PrimaDiscriminada>

export const SYSTEM_EXTRACCION_CARATULA =
  'Eres un extractor de datos de carátulas de pólizas de seguros colombianas. ' +
  'Devuelves ÚNICAMENTE un objeto JSON válido, sin texto adicional ni markdown. ' +
  'Si un dato no aparece en el texto, su valor es null. No inventes datos.'

export function buildPromptCaratula(texto: string, faltantes: string[]): string {
  const foco = faltantes.length
    ? `Presta especial atención a estos campos que faltan: ${faltantes.join(', ')}.`
    : ''
  return `Extrae los datos de esta carátula de póliza y devuélvelos EXACTAMENTE en este JSON:
{
  "numero_poliza": string|null,
  "aseguradora": string|null,
  "ramo": string|null,
  "tomador_nombre": string|null,
  "tomador_documento": string|null,
  "fecha_inicio": "YYYY-MM-DD"|null,
  "fecha_fin": "YYYY-MM-DD"|null,
  "prima_neta": number|null,
  "prima_total": number|null,
  "iva": number|null,
  "prima_indeterminada": number|null
}
Las fechas SIEMPRE en formato YYYY-MM-DD. Los montos como número sin separadores de miles ni símbolo.

REGLA CRÍTICA DE LA PRIMA — no adivines si incluye IVA:
- Si la carátula distingue prima neta (antes de IVA) y/o prima total (con IVA), llena "prima_neta" y/o "prima_total" y deja "prima_indeterminada" en null.
- Si solo aparece UN valor de prima sin decir claramente si incluye o no el IVA, ponlo en "prima_indeterminada" y deja "prima_neta" y "prima_total" en null. NUNCA supongas que una prima sin etiqueta es neta.
- "iva" solo si el valor del IVA aparece explícito. ${foco}

--- TEXTO DE LA CARÁTULA ---
${texto.slice(0, 6000)}`
}

/** Parsea la respuesta del modelo a un BorradorPoliza parcial. Tolera ```json y texto alrededor. */
export function parseRespuestaIA(respuesta: string): ExtraccionIA | null {
  if (!respuesta) return null
  // Extraer el primer bloque {...} aunque venga con ```json o texto.
  const limpio = respuesta.replace(/```json/gi, '').replace(/```/g, '')
  const m = limpio.match(/\{[\s\S]*\}/)
  if (!m) return null
  let obj: Record<string, unknown>
  try { obj = JSON.parse(m[0]) } catch { return null }

  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : null
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && !isNaN(v)) return v
    if (typeof v === 'string') return normalizarMonto(v)  // tolera formato colombiano
    return null
  }
  const prima_neta          = num(obj.prima_neta)
  const prima_total         = num(obj.prima_total)
  const prima_indeterminada = num(obj.prima_indeterminada)
  return {
    numero_poliza:     str(obj.numero_poliza),
    aseguradora:       str(obj.aseguradora),
    ramo:              str(obj.ramo),
    tomador_nombre:    str(obj.tomador_nombre),
    tomador_documento: str(obj.tomador_documento),
    fecha_inicio:      str(obj.fecha_inicio),
    fecha_fin:         str(obj.fecha_fin),
    prima_neta,
    prima_total,
    iva:               num(obj.iva),
    prima_indeterminada,
    // Transicional: si el modelo antiguo devolviera "prima", se respeta; si no, la mejor.
    prima:             num(obj.prima) ?? prima_neta ?? prima_total ?? prima_indeterminada,
  }
}
