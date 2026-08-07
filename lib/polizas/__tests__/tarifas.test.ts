import { describe, it, expect } from 'vitest'
import { pctComisionPorDefecto, type TarifaCatalogo, type TarifaLegacy } from '../tarifas'

const catalogo: TarifaCatalogo[] = [
  { aseguradora: 'Sura',    ramo: 'Automóviles', pct_comision_default: 20, activo: true },
  { aseguradora: 'Bolivar', ramo: 'Automóviles', pct_comision_default: 15, activo: true },
  { aseguradora: 'Sura',    ramo: 'Hogar',       pct_comision_default: null, activo: true },
  { aseguradora: 'Mapfre',  ramo: 'Salud',       pct_comision_default: 30, activo: false },
]

const legacy: TarifaLegacy[] = [
  { codigo: 'A1', aseguradora: 'Sura',    ramo: 'Automóviles', porcentaje: 12 },
  { codigo: 'H1', aseguradora: 'Allianz', ramo: 'Hogar',       porcentaje: 8 },
]

describe('pctComisionPorDefecto — precedencia', () => {
  it('1º: el catálogo gana sobre el JSON heredado para la misma pareja', () => {
    // legacy dice 12 para Sura+Automóviles, el catálogo dice 20
    expect(pctComisionPorDefecto(catalogo, legacy, 'Sura', 'Automóviles')).toBe(20)
  })

  it('distingue por aseguradora dentro del mismo ramo', () => {
    expect(pctComisionPorDefecto(catalogo, legacy, 'Bolivar', 'Automóviles')).toBe(15)
  })

  it('2º: si el catálogo no cubre la pareja, usa la tarifa JSON exacta', () => {
    expect(pctComisionPorDefecto(catalogo, legacy, 'Allianz', 'Hogar')).toBe(8)
  })

  it('3º: respaldo histórico — primera tarifa del ramo aunque no coincida la aseguradora', () => {
    // "Otra" no está en ninguna fuente, pero legacy tiene Hogar (Allianz)
    expect(pctComisionPorDefecto(catalogo, legacy, 'Otra Aseguradora', 'Hogar')).toBe(8)
  })

  it('ignora entradas del catálogo sin pct definido y cae al respaldo', () => {
    // Sura+Hogar existe en catálogo pero con pct null → usa legacy por ramo (8)
    expect(pctComisionPorDefecto(catalogo, legacy, 'Sura', 'Hogar')).toBe(8)
  })

  it('ignora entradas del catálogo inactivas', () => {
    expect(pctComisionPorDefecto(catalogo, legacy, 'Mapfre', 'Salud')).toBeNull()
  })

  it('devuelve null si ninguna fuente aplica (el caller conserva su valor)', () => {
    expect(pctComisionPorDefecto(catalogo, legacy, 'Sura', 'Transportes')).toBeNull()
    expect(pctComisionPorDefecto([], [], 'Sura', 'Automóviles')).toBeNull()
  })

  it('sin ramo no resuelve nada', () => {
    expect(pctComisionPorDefecto(catalogo, legacy, 'Sura', '')).toBeNull()
    expect(pctComisionPorDefecto(catalogo, legacy, 'Sura', null)).toBeNull()
  })

  it('compara sin distinguir mayúsculas ni espacios sobrantes', () => {
    expect(pctComisionPorDefecto(catalogo, legacy, '  sura ', 'automóviles')).toBe(20)
  })
})
