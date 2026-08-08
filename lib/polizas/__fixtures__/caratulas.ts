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
  origen: 'ia',
  confianza: 'requiere_revision',
  aseguradora_detectada: null,
  campos_faltantes: ['numero_poliza', 'aseguradora', 'fecha_inicio', 'fecha_fin', 'prima'],
}
