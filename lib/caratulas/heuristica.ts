// Extracción heurística de campos de una carátula colombiana (fase 4.1).
// Funciones PURAS sobre el texto ya extraído del PDF — testeables sin pdf-parse.
//
// Es un primer paso genérico (regex de etiquetas comunes). No reemplaza a un
// parser por aseguradora afinado con PDFs reales; cuando un campo clave falta,
// el endpoint completa con el motor de IA (4.3).

import { BorradorPoliza, PrimaDiscriminada } from '@/types'
import { detectarAseguradora } from './aseguradoras'

const RAMOS_CONOCIDOS = [
  'autos', 'automóviles', 'automoviles', 'vehículos', 'soat', 'moto',
  'vida', 'salud', 'hogar', 'copropiedad', 'incendio', 'cumplimiento',
  'responsabilidad civil', 'rc', 'transporte', 'maquinaria', 'todo riesgo',
  'arrendamiento', 'accidentes personales', 'pyme',
]

// Meses en español (con y sin tilde) → número. Cubre fechas escritas de carátulas
// oficiales colombianas, p.ej. "15 de marzo de 2026".
const MES_NUM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
}

// Fragmento de regex que matchea una fecha NUMÉRICA (DD/MM/AAAA) o ESCRITA
// ("DD de MMMM de AAAA"). Se usa para extraer vigencias en cualquiera de los dos formatos.
export const FECHA_RE = String.raw`(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}\s+de\s+[a-záéíóú]+\s+de\s+\d{4})`

function armar(a: string, mes: number, d: number): string | null {
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null
  return `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Convierte una fecha numérica (DD/MM/AAAA) o escrita ("15 de marzo de 2026") a 'YYYY-MM-DD'. */
export function normalizarFecha(raw: string | undefined | null): string | null {
  if (!raw) return null
  const t = raw.trim()

  // Escrita: "15 de marzo de 2026"
  const w = t.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/)
  if (w) {
    const mes = MES_NUM[w[2]]
    if (mes) return armar(w[3], mes, Number(w[1]))
  }

  // Numérica: DD/MM/AAAA (o DD-MM-AA)
  const m = t.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/)
  if (!m) return null
  let a = m[3]
  if (a.length === 2) a = (Number(a) > 50 ? '19' : '20') + a
  return armar(a, Number(m[2]), Number(m[1]))
}

/** Convierte un monto en formato colombiano ('1.234.567,89' o '1234567') a número. */
export function normalizarMonto(raw: string | undefined | null): number | null {
  if (!raw) return null
  let s = raw.replace(/[^\d.,]/g, '')
  if (!s) return null
  // Formato colombiano: '.' miles, ',' decimales. Quitar miles, coma→punto.
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/\./g, '')   // solo miles con punto
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

function buscar(texto: string, re: RegExp): string | null {
  const m = texto.match(re)
  return m?.[1]?.trim() || null
}

function detectarRamo(texto: string): string | null {
  const low = texto.toLowerCase()
  const hit = RAMOS_CONOCIDOS.find(r => low.includes(r))
  return hit ? hit.charAt(0).toUpperCase() + hit.slice(1) : null
}

export interface ExtraccionHeuristica {
  borrador: BorradorPoliza
  prima: PrimaDiscriminada
  camposFaltantes: string[]
}

/** Extrae lo que puede del texto con regex de etiquetas. Lo que no encuentra queda null. */
export function extraerHeuristica(texto: string): ExtraccionHeuristica {
  const numero_poliza = buscar(texto,
    /(?:n[uú]mero\s+de\s+p[oó]liza|p[oó]liza\s*(?:n[o°.]?|number)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-]{3,})/i)
  const tomador_nombre = buscar(texto,
    /(?:tomador|asegurado|contratante)\s*[:]?\s*([A-ZÁÉÍÓÚÑ][^\n]{3,60})/i)
  const tomador_documento = buscar(texto,
    /(?:nit|c\.?c\.?|c[eé]dula|documento|identificaci[oó]n)\s*[:.]?\s*([\d][\d.\-]{5,})/i)

  // Vigencia: dos fechas (numéricas o escritas) en una zona etiquetada "vigencia/desde...hasta".
  const fechas = texto.match(new RegExp(FECHA_RE, 'gi')) || []
  let fecha_inicio: string | null = null, fecha_fin: string | null = null
  const vig = texto.match(new RegExp(`vigencia[\\s\\S]{0,120}?(${FECHA_RE})[\\s\\S]{0,40}?(${FECHA_RE})`, 'i'))
  if (vig) { fecha_inicio = normalizarFecha(vig[1]); fecha_fin = normalizarFecha(vig[2]) }
  const desde = buscar(texto, new RegExp(`(?:desde|inicio|vigente\\s+desde)\\s*[:]?\\s*(${FECHA_RE})`, 'i'))
  const hasta = buscar(texto, new RegExp(`(?:hasta|vencimiento|vence|vigente\\s+hasta)\\s*[:]?\\s*(${FECHA_RE})`, 'i'))
  if (desde) fecha_inicio = normalizarFecha(desde)
  if (hasta) fecha_fin = normalizarFecha(hasta)
  // Último recurso: si hay exactamente 2 fechas y no se etiquetaron, asumir orden.
  if (!fecha_inicio && !fecha_fin && fechas.length === 2) {
    fecha_inicio = normalizarFecha(fechas[0]); fecha_fin = normalizarFecha(fechas[1])
  }

  // Prima: buscar PRIMERO las etiquetas específicas (neta/total) y solo si NO hay
  // ninguna, aceptar una prima genérica como INDETERMINADA. El orden importa: "PRIMA
  // TOTAL" también matchearía un patrón laxo de "PRIMA", así que la genérica usa un
  // lookahead negativo para no capturar "prima neta"/"prima total".
  const prima_neta  = normalizarMonto(buscar(texto, /prima\s*neta[\s:$]*([\d][\d.,]*)/i))
  const prima_total = normalizarMonto(buscar(texto, /prima\s*total[\s:$]*([\d][\d.,]*)/i))
  const iva         = normalizarMonto(buscar(texto, /\bi\.?\s*v\.?\s*a\.?[\s:$]*([\d][\d.,]*)/i))
  const prima_indeterminada = (prima_neta == null && prima_total == null)
    ? normalizarMonto(buscar(texto, /prima(?!\s*(?:neta|total))\s*(?:anual)?[\s:$]*([\d][\d.,]*)/i))
    : null
  const prima: PrimaDiscriminada = { prima_neta, prima_total, iva, prima_indeterminada }

  const borrador: BorradorPoliza = {
    numero_poliza,
    aseguradora: detectarAseguradora(texto),
    ramo: detectarRamo(texto),
    tomador_nombre,
    tomador_documento,
    fecha_inicio,
    fecha_fin,
    // Transicional: `prima` = la mejor disponible, para no romper a Carril B mientras migra.
    prima: prima_neta ?? prima_total ?? prima_indeterminada,
  }

  const camposFaltantes = faltanCamposClave(borrador, prima)
  return { borrador, prima, camposFaltantes }
}

/** True si hay ALGUNA prima (neta, total o indeterminada). */
export function tienePrima(p: PrimaDiscriminada): boolean {
  return p.prima_neta != null || p.prima_total != null || p.prima_indeterminada != null
}

/** Campos clave faltantes. 'prima' se cumple con que exista cualquier prima. */
export function faltanCamposClave(b: BorradorPoliza, prima: PrimaDiscriminada): string[] {
  const faltantes: string[] = []
  if (b.numero_poliza == null) faltantes.push('numero_poliza')
  if (b.aseguradora == null)   faltantes.push('aseguradora')
  if (b.fecha_inicio == null)  faltantes.push('fecha_inicio')
  if (b.fecha_fin == null)     faltantes.push('fecha_fin')
  if (!tienePrima(prima))      faltantes.push('prima')
  return faltantes
}
