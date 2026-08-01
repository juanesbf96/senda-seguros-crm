import { describe, it, expect } from 'vitest'
import { normalizarNumeroPoliza, mapaPorNumeroNormalizado } from '../numeroPoliza'

/**
 * Esta tabla es la MISMA que se corre contra la función SQL
 * `public.normalizar_numero_poliza` (ver el bloque de verificación al final de
 * supabase/migrations/20260801163626_modelo_polizas_v2.sql). Si alguien cambia
 * una de las dos implementaciones sin la otra, el matching se rompe en
 * silencio: el TS normaliza distinto a la columna generada y nada coincide.
 */
const CASOS: [descripcion: string, entrada: string | null, esperado: string | null][] = [
  ['AXA: colilla con ceros vs BD sin ceros', '000000108969', '108969'],
  ['Allianz: sufijo /N de renovación',       '23475157/0',   '234751570'],
  ['Sura: un cero inicial',                  '090001701545', '90001701545'],
  ['Bolívar: sin ceros, se deja igual',      '1563238109801','1563238109801'],
  ['todo ceros no queda vacío',              '000',          '0'],
  ['nulo',                                    null,           null],
  ['solo espacios',                          '   ',          null],
  ['guiones y espacios',                     ' 00-12 345 ',  '12345'],
  ['alfanumérico en minúscula',              '0ab12x',       'AB12X'],
]

describe('normalizarNumeroPoliza (debe coincidir con la función SQL)', () => {
  for (const [desc, entrada, esperado] of CASOS) {
    it(desc, () => {
      expect(normalizarNumeroPoliza(entrada)).toBe(esperado)
    })
  }

  it('undefined se trata como nulo', () => {
    expect(normalizarNumeroPoliza(undefined)).toBeNull()
  })
})

describe('mapaPorNumeroNormalizado', () => {
  it('mapea las claves únicas', () => {
    const { mapa, ambiguos } = mapaPorNumeroNormalizado([
      { id: 'a', numero_poliza_recortado: '108969' },
      { id: 'b', numero_poliza_recortado: '99' },
    ])
    expect(mapa.get('108969')).toBe('a')
    expect(mapa.get('99')).toBe('b')
    expect(ambiguos).toEqual([])
  })

  it('DESCARTA las ambiguas — actualizar la póliza equivocada es peor que duplicar', () => {
    const { mapa, ambiguos } = mapaPorNumeroNormalizado([
      { id: 'a', numero_poliza_recortado: '108969' },
      { id: 'b', numero_poliza_recortado: '108969' },
      { id: 'c', numero_poliza_recortado: '77' },
    ])
    expect(mapa.has('108969')).toBe(false)
    expect(ambiguos).toEqual(['108969'])
    expect(mapa.get('77')).toBe('c')
  })

  it('ignora filas sin número normalizado', () => {
    const { mapa } = mapaPorNumeroNormalizado([
      { id: 'a', numero_poliza_recortado: null },
    ])
    expect(mapa.size).toBe(0)
  })
})
