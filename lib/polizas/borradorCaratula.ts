// Traducción del borrador que devuelve el extractor de carátulas (fase 4.1)
// al pre-llenado que consume PolizaModal.
//
// Función PURA y testeada a propósito: es la lección de la fase 0.1 (el parser
// de Excel corrompió producción dos veces por mapeos de columna sin cobertura).
// El borrador viene de un PDF (o de una IA), así que el mapeo es donde se
// concentran las ambigüedades; se resuelven acá, con tests, y no dentro de un
// componente de 1.200 líneas.

import type { BorradorPoliza, Poliza } from '@/types'

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

/**
 * Arma el objeto de pre-llenado para PolizaModal.
 *
 * Va SIN `id` a propósito: PolizaModal detecta el modo crear por `poliza?.id`,
 * así que un objeto parcial sin id abre el formulario en alta (mismo patrón que
 * usa el flujo de colillas).
 *
 * ⚠️ `prima` se carga como **prima neta**. El borrador trae un solo campo de
 * prima y la heurística matchea tanto "PRIMA NETA" como "PRIMA TOTAL", así que
 * no hay forma de saber si el número incluye IVA. Se elige prima neta porque es
 * el campo que el formulario usa como base de cálculo; el preview avisa que hay
 * que confirmarlo.
 */
export function borradorAPoliza(
  borrador: BorradorPoliza,
  clientId?: string | null,
): Partial<Poliza> {
  const ramo = mapearRamo(borrador.ramo)
  return {
    ...(clientId ? { client_id: clientId } : {}),
    numero_poliza:  borrador.numero_poliza || null,
    aseguradora:    mapearAseguradora(borrador.aseguradora),
    ramo:           ramo.valor,
    nombre_tomador: borrador.tomador_nombre || null,
    fecha_inicio:   borrador.fecha_inicio || null,
    fecha_fin:      borrador.fecha_fin || null,
    prima_neta:     borrador.prima ?? null,
  }
}

export interface CampoBorrador {
  campo: keyof BorradorPoliza
  label: string
  /** Ya formateado para mostrar; null si el extractor no lo encontró. */
  valor: string | null
  falta: boolean
}

/** Filas del preview, en el orden en que conviene leerlas. */
export function camposBorrador(
  borrador: BorradorPoliza,
  camposFaltantes: string[] = [],
): CampoBorrador[] {
  const faltantes = new Set(camposFaltantes)
  const orden: (keyof BorradorPoliza)[] = [
    'numero_poliza', 'aseguradora', 'ramo', 'tomador_nombre',
    'tomador_documento', 'fecha_inicio', 'fecha_fin', 'prima',
  ]
  return orden.map(campo => {
    const bruto = borrador[campo]
    const valor =
      bruto == null || bruto === ''      ? null
      : campo === 'prima'                ? formatearPrima(Number(bruto))
      : campo === 'aseguradora'          ? mapearAseguradora(String(bruto))
      : String(bruto)
    return {
      campo,
      label: ETIQUETAS_BORRADOR[campo],
      valor,
      // El endpoint solo reporta como faltantes los campos clave; cualquier
      // campo vacío se marca igual para que el usuario lo vea.
      falta: valor == null || faltantes.has(campo),
    }
  })
}

function formatearPrima(v: number): string {
  return '$ ' + v.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}
