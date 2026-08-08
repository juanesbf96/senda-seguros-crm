// Respuestas de ejemplo de POST /api/polizas/extraer-caratula (fase 4.1),
// con la forma exacta del contrato `ResultadoExtraccionCaratula`.
//
// Sirven de fixture para los tests del mapeo y como referencia del contrato
// mientras no haya carátulas reales de muestra en el repo.

import type { ResultadoExtraccionCaratula } from '@/types'

/** Parser determinístico con todos los campos clave: no exige revisión. */
export const CARATULA_PARSER_ALTA: ResultadoExtraccionCaratula = {
  borrador: {
    numero_poliza:     '010-45-9876543',
    aseguradora:       'Sura',
    ramo:              'Autos',
    tomador_nombre:    'MARIA FERNANDA GOMEZ RUIZ',
    tomador_documento: '43.215.678',
    fecha_inicio:      '2026-03-01',
    fecha_fin:         '2027-03-01',
    prima:             1850000,
  },
  prima_neta: 1850000,
  prima_total: 2201500,
  iva: 351500,
  prima_indeterminada: null,
  origen: 'parser',
  confianza: 'alta',
  aseguradora_detectada: 'Sura',
  campos_faltantes: [],
}

/** La IA completó huecos: el contrato obliga a marcarlo como revisable. */
export const CARATULA_IA_REVISION: ResultadoExtraccionCaratula = {
  borrador: {
    numero_poliza:     'AX-2026-778812',
    aseguradora:       'Seguros Bolívar',
    ramo:              'Vida',
    tomador_nombre:    'INVERSIONES DELTA S.A.S.',
    tomador_documento: '900.123.456-7',
    fecha_inicio:      '2026-05-10',
    fecha_fin:         null,
    prima:             990000,
  },
  prima_neta: 990000,
  prima_total: null,
  iva: null,
  prima_indeterminada: null,
  origen: 'ia',
  confianza: 'requiere_revision',
  aseguradora_detectada: 'Seguros Bolívar',
  campos_faltantes: ['fecha_fin'],
}

/** Carátula pobre: casi todo vacío y un ramo que no está en el catálogo. */
export const CARATULA_INCOMPLETA: ResultadoExtraccionCaratula = {
  borrador: {
    numero_poliza:     null,
    aseguradora:       null,
    ramo:              'Maquinaria',
    tomador_nombre:    'PEDRO PEREZ',
    tomador_documento: null,
    fecha_inicio:      null,
    fecha_fin:         null,
    prima:             null,
  },
  prima_neta: null,
  prima_total: null,
  iva: null,
  prima_indeterminada: null,
  origen: 'ia',
  confianza: 'requiere_revision',
  aseguradora_detectada: null,
  campos_faltantes: ['numero_poliza', 'aseguradora', 'fecha_inicio', 'fecha_fin', 'prima'],
}

/** Carátula que solo discrimina el TOTAL y el IVA: la neta se deriva exacta. */
export const CARATULA_TOTAL_CON_IVA: ResultadoExtraccionCaratula = {
  borrador: {
    numero_poliza:     'BOL-77-11223',
    aseguradora:       'Seguros Bolívar',
    ramo:              'Hogar',
    tomador_nombre:    'CARLOS ANDRES RUIZ',
    tomador_documento: '71234567',
    fecha_inicio:      '2026-04-01',
    fecha_fin:         '2027-04-01',
    prima:             1190000,   // transicional: la mejor disponible (el total)
  },
  prima_neta: null,
  prima_total: 1190000,
  iva: 190000,
  prima_indeterminada: null,
  origen: 'parser',
  confianza: 'alta',
  aseguradora_detectada: 'Seguros Bolívar',
  campos_faltantes: [],
}

/** Carátula que solo trae el total, sin discriminar IVA: hay que estimar la neta. */
export const CARATULA_SOLO_TOTAL: ResultadoExtraccionCaratula = {
  borrador: {
    numero_poliza:     'MAP-33-99887',
    aseguradora:       'Mapfre',
    ramo:              'Autos',
    tomador_nombre:    'LUZ MARINA TORRES',
    tomador_documento: '52998877',
    fecha_inicio:      '2026-06-15',
    fecha_fin:         '2027-06-15',
    prima:             2380000,
  },
  prima_neta: null,
  prima_total: 2380000,
  iva: null,
  prima_indeterminada: null,
  origen: 'parser',
  confianza: 'alta',
  aseguradora_detectada: 'Mapfre',
  campos_faltantes: [],
}

/** Un solo número de prima sin etiqueta: el endpoint fuerza `requiere_revision`. */
export const CARATULA_PRIMA_INDETERMINADA: ResultadoExtraccionCaratula = {
  borrador: {
    numero_poliza:     'HDI-01-44556',
    aseguradora:       'HDI',
    ramo:              'Salud',
    tomador_nombre:    'JORGE ELIECER PARRA',
    tomador_documento: '80445566',
    fecha_inicio:      '2026-02-01',
    fecha_fin:         '2027-02-01',
    prima:             1500000,
  },
  prima_neta: null,
  prima_total: null,
  iva: null,
  prima_indeterminada: 1500000,
  origen: 'parser',
  confianza: 'requiere_revision',
  aseguradora_detectada: 'HDI',
  campos_faltantes: [],
}
