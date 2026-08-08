// Traducción del borrador que devuelve el extractor de carátulas (fase 4.1)
// al pre-llenado que consume PolizaModal.
//
// Función PURA y testeada a propósito: es la lección de la fase 0.1 (el parser
// de Excel corrompió producción dos veces por mapeos de columna sin cobertura).
// El borrador viene de un PDF (o de una IA), así que el mapeo es donde se
// concentran las ambigüedades; se resuelven acá, con tests, y no dentro de un
// componente de 1.200 líneas.

import type { BorradorPoliza, Poliza, PrimaDiscriminada, ResultadoExtraccionCaratula } from '@/types'

/** Etiquetas legibles de cada campo del borrador (preview y campos faltantes). */
export const ETIQUETAS_BORRADOR: Record<keyof BorradorPoliza, string> = {
  numero_poliza:     'Número de póliza',
  aseguradora:       'Aseguradora',
  ramo:              'Ramo',
  tomador_nombre:    'Tomador',
  tomador_documento: 'Documento del tomador',
  fecha_inicio:      'Vigencia desde',
  fecha_fin:         'Vigencia hasta',
  prima:             'Prima',
}

/**
 * El extractor nombra algunas aseguradoras distinto a como ya están escritas en
 * el CRM. Sin esto se sembraría una segunda grafía del mismo emisor ('Seguros
 * Bolívar' junto a 'Bolívar'), que rompe filtros e informes por aseguradora.
 */
const ALIAS_ASEGURADORA: Record<string, string> = {
  'Seguros Bolívar': 'Bolívar',
  'Equidad Seguros': 'La Equidad',
}

/**
 * El extractor detecta ramos de su propia lista (`autos`, `vida`, `rc`…), que no
 * es la del formulario. Se traduce solo lo inequívoco; lo demás queda vacío para
 * que el usuario lo elija, en vez de guardar un ramo que no existe en el catálogo.
 */
const MAPA_RAMO: Record<string, string> = {
  'soat':                  'SOAT',
  'salud':                 'Salud',
  'hogar':                 'Hogar',
  'copropiedad':           'Hogar',
  'incendio':              'Incendio',
  'responsabilidad civil': 'Responsabilidad Civil',
  'rc':                    'Responsabilidad Civil',
  'transporte':            'Transportes',
  'cumplimiento':          'Cumplimiento',
  'autos':                 'Todo Riesgo Vehículo',
  'automóviles':           'Todo Riesgo Vehículo',
  'automoviles':           'Todo Riesgo Vehículo',
  'vehículos':             'Todo Riesgo Vehículo',
  'todo riesgo':           'Todo Riesgo Vehículo',
  'vida':                  'Vida Individual',
}

/**
 * Ramos cuya traducción es una suposición razonable pero no un hecho: `vida`
 * puede ser individual o grupo, y `moto` puede ser SOAT o todo riesgo. Se
 * traducen igual (dejar el campo vacío sería peor UX), pero el preview los
 * marca como sugeridos para que el usuario los confirme.
 */
const RAMOS_INFERIDOS = new Set(['vida', 'todo riesgo', 'copropiedad'])

export interface RamoMapeado {
  /** Valor para el formulario. Vacío si no se pudo traducir con confianza. */
  valor: string
  /** true si la traducción es una suposición que conviene confirmar. */
  inferido: boolean
}

export function mapearRamo(ramo: string | null | undefined): RamoMapeado {
  if (!ramo) return { valor: '', inferido: false }
  const clave = ramo.trim().toLowerCase()
  const valor = MAPA_RAMO[clave]
  if (!valor) return { valor: '', inferido: false }
  return { valor, inferido: RAMOS_INFERIDOS.has(clave) }
}

export function mapearAseguradora(aseguradora: string | null | undefined): string {
  if (!aseguradora) return ''
  const limpia = aseguradora.trim()
  return ALIAS_ASEGURADORA[limpia] ?? limpia
}


/* ────────────────────────────────────────────────────────── */
/*  Prima discriminada (contrato de #53)                      */
/* ────────────────────────────────────────────────────────── */

/** IVA general de seguros en Colombia. Solo se usa como SUPUESTO explícito. */
const IVA_ASUMIDO = 19

export type OrigenPrima =
  | 'neta'            // la carátula trae la neta: se usa tal cual
  | 'derivada_iva'    // trae total + IVA discriminado: neta = total − IVA (exacto)
  | 'derivada_supuesto' // trae solo el total: la neta se estima asumiendo IVA_ASUMIDO
  | 'indeterminada'   // hay un número de prima pero no se sabe de qué tipo
  | 'ninguna'

export interface PrimaResuelta {
  /** Valor para el campo `prima_neta` del formulario. */
  prima_neta: number | null
  /** `porcentaje_iva` a pre-cargar; null = dejar el default del formulario. */
  porcentaje_iva: number | null
  origen: OrigenPrima
  /** Aviso dirigido, o null si no hay nada que advertir. */
  aviso: string | null
}

function redondear(n: number, decimales = 2): number {
  const f = 10 ** decimales
  return Math.round(n * f) / f
}

function pesos(v: number): string {
  return '$ ' + Math.round(v).toLocaleString('es-CO')
}

/**
 * Decide qué prima cargar en el formulario a partir de la prima discriminada.
 *
 * Por qué importa el tipo: `prima_neta` NO es un campo cualquiera del formulario —
 * es el valor **sin IVA**, que el CRM usa como producción de la agencia y como base
 * de la comisión. El valor **con IVA** es lo que se le cobra al cliente final.
 * Meter un total en `prima_neta` no "infla un número": corrompe la métrica de
 * producción y sobrevalora la comisión ~19%.
 *
 * De ahí la regla: nunca se guarda un valor con IVA como si fuera neto. Cuando la
 * neta no viene y no se puede derivar de forma exacta, se estima y el aviso dice
 * qué se asumió y cuándo esa suposición falla.
 */
export function resolverPrima(p: Partial<PrimaDiscriminada> | undefined | null): PrimaResuelta {
  const neta  = p?.prima_neta ?? null
  const total = p?.prima_total ?? null
  const iva   = p?.iva ?? null
  const indet = p?.prima_indeterminada ?? null

  // 1. La neta vino explícita: es exactamente lo que el CRM quiere guardar.
  if (neta != null) {
    // Si además discrimina IVA, se usa el porcentaje REAL en vez del 19% por
    // defecto: hay ramos exentos (SOAT, vida) donde asumir 19% inflaría el total.
    const pct = iva != null && neta > 0 ? redondear((iva / neta) * 100) : null
    return { prima_neta: neta, porcentaje_iva: pct, origen: 'neta', aviso: null }
  }

  // 2. Total con IVA discriminado: la neta se deriva sin asumir nada.
  if (total != null && iva != null) {
    const derivada = redondear(total - iva)
    const pct = derivada > 0 ? redondear((iva / derivada) * 100) : null
    return {
      prima_neta: derivada,
      porcentaje_iva: pct,
      origen: 'derivada_iva',
      aviso: `La carátula traía la prima total (${pesos(total)}) con el IVA discriminado; ` +
             `se cargó la prima neta (${pesos(derivada)}), que es la que cuenta como producción.`,
    }
  }

  // 3. Solo el total: hay que estimar. Se asume el IVA general y se dice.
  if (total != null) {
    const derivada = redondear(total / (1 + IVA_ASUMIDO / 100))
    return {
      prima_neta: derivada,
      porcentaje_iva: IVA_ASUMIDO,
      origen: 'derivada_supuesto',
      aviso: `La carátula solo traía la prima total con IVA (${pesos(total)}). Se estimó la ` +
             `prima neta en ${pesos(derivada)} asumiendo ${IVA_ASUMIDO}% de IVA — confírmala, ` +
             `porque es la base de la comisión. Si el ramo es exento (SOAT, vida), la neta es ` +
             `igual al total.`,
    }
  }

  // 4. Hay una prima pero no se sabe de qué tipo. El endpoint ya baja la confianza
  //    a 'requiere_revision' en este caso; acá el aviso dice qué confirmar.
  if (indet != null) {
    return {
      prima_neta: indet,
      porcentaje_iva: null,
      origen: 'indeterminada',
      aviso: `Se encontró una prima de ${pesos(indet)} pero la carátula no dice si incluye IVA. ` +
             `Se cargó como prima neta: confirma el tipo antes de guardar — si ese valor ya ` +
             `traía IVA, la prima neta y la comisión quedan sobrevaloradas.`,
    }
  }

  return { prima_neta: null, porcentaje_iva: null, origen: 'ninguna', aviso: null }
}

/**
 * Arma el objeto de pre-llenado para PolizaModal.
 *
 * Va SIN `id` a propósito: PolizaModal detecta el modo crear por `poliza?.id`,
 * así que un objeto parcial sin id abre el formulario en alta (mismo patrón que
 * usa el flujo de colillas).
 *
 * La prima sale de `resolverPrima` sobre el WRAPPER, no de `borrador.prima`
 * (transicional y sin tipo).
 */
export function borradorAPoliza(
  resultado: ResultadoExtraccionCaratula,
  clientId?: string | null,
): Partial<Poliza> {
  const b = resultado.borrador
  const ramo = mapearRamo(b.ramo)
  const prima = resolverPrima(resultado)
  return {
    ...(clientId ? { client_id: clientId } : {}),
    numero_poliza:  b.numero_poliza || null,
    aseguradora:    mapearAseguradora(b.aseguradora),
    ramo:           ramo.valor,
    nombre_tomador: b.tomador_nombre || null,
    fecha_inicio:   b.fecha_inicio || null,
    fecha_fin:      b.fecha_fin || null,
    prima_neta:     prima.prima_neta,
    ...(prima.porcentaje_iva != null ? { porcentaje_iva: prima.porcentaje_iva } : {}),
  }
}

export interface CampoBorrador {
  /** Clave del borrador, o una etiqueta propia para las filas de prima. */
  campo: string
  label: string
  /** Ya formateado para mostrar; null si el extractor no lo encontró. */
  valor: string | null
  falta: boolean
}

/**
 * Filas del preview, en el orden en que conviene leerlas.
 *
 * La prima se muestra DESGLOSADA (neta / IVA / total, o "sin determinar"): es el
 * dato que el usuario más necesita juzgar, y el contrato ahora permite mostrarlo
 * en vez de un único número ambiguo.
 */
export function camposBorrador(resultado: ResultadoExtraccionCaratula): CampoBorrador[] {
  const b = resultado.borrador
  const faltantes = new Set(resultado.campos_faltantes ?? [])

  const orden: (keyof BorradorPoliza)[] = [
    'numero_poliza', 'aseguradora', 'ramo', 'tomador_nombre',
    'tomador_documento', 'fecha_inicio', 'fecha_fin',
  ]
  const filas: CampoBorrador[] = orden.map(campo => {
    const bruto = b[campo]
    const valor =
      bruto == null || bruto === ''  ? null
      : campo === 'aseguradora'      ? mapearAseguradora(String(bruto))
      : String(bruto)
    return {
      campo,
      label: ETIQUETAS_BORRADOR[campo],
      valor,
      falta: valor == null || faltantes.has(campo),
    }
  })

  return [...filas, ...filasPrima(resultado)]
}

function filasPrima(p: Partial<PrimaDiscriminada>): CampoBorrador[] {
  const filas: CampoBorrador[] = []
  if (p.prima_neta != null)  filas.push({ campo: 'prima_neta',  label: 'Prima neta (sin IVA)', valor: pesos(p.prima_neta),  falta: false })
  if (p.iva != null)         filas.push({ campo: 'iva',         label: 'IVA',                  valor: pesos(p.iva),         falta: false })
  if (p.prima_total != null) filas.push({ campo: 'prima_total', label: 'Prima total (con IVA)', valor: pesos(p.prima_total), falta: false })
  if (p.prima_indeterminada != null) {
    filas.push({
      campo: 'prima_indeterminada',
      label: 'Prima (¿incluye IVA?)',
      valor: pesos(p.prima_indeterminada),
      // Se marca aunque tenga valor: el tipo es lo que falta, y hay que confirmarlo.
      falta: true,
    })
  }
  // Ninguna prima: se conserva la fila vacía para que el faltante siga visible.
  // (El endpoint la reporta en `campos_faltantes` como 'prima'; el contrato de
  //  campos_faltantes no cambió con la prima discriminada.)
  if (filas.length === 0) {
    filas.push({ campo: 'prima', label: ETIQUETAS_BORRADOR.prima, valor: null, falta: true })
  }
  return filas
}
