import { describe, it, expect } from 'vitest'
import {
  aseguradoraEsNumerica, normalizarRetencionVendedor, RETENCION_VENDEDOR_DEFAULT,
} from '../validaciones'

describe('aseguradoraEsNumerica', () => {
  it('detecta los teléfonos que quedaron en la columna de aseguradora', () => {
    // El caso real documentado en HANDOFF.md: columna corrida en el Excel.
    expect(aseguradoraEsNumerica('3105551234')).toBe(true)
    expect(aseguradoraEsNumerica('310 555 1234')).toBe(true)
    expect(aseguradoraEsNumerica('310-555-1234')).toBe(true)
    expect(aseguradoraEsNumerica('(604) 4441234')).toBe(true)
    expect(aseguradoraEsNumerica('+57 3105551234')).toBe(true)
  })

  it('NO toca las aseguradoras reales, incluidas las que llevan números', () => {
    expect(aseguradoraEsNumerica('Sura')).toBe(false)
    expect(aseguradoraEsNumerica('AXA Colpatria')).toBe(false)
    expect(aseguradoraEsNumerica('Seguros del Estado')).toBe(false)
    // '48 Horas' es una aseguradora real del módulo de colillas.
    expect(aseguradoraEsNumerica('48 Horas')).toBe(false)
    expect(aseguradoraEsNumerica('Liberty Mutual 2')).toBe(false)
  })

  it('no marca números cortos, que no parecen teléfonos', () => {
    // Podría ser un código interno; rechazar la fila sería desproporcionado.
    expect(aseguradoraEsNumerica('48')).toBe(false)
    expect(aseguradoraEsNumerica('1234')).toBe(false)
  })

  it('trata vacío y nulo como "sin dato", no como sospechoso', () => {
    expect(aseguradoraEsNumerica('')).toBe(false)
    expect(aseguradoraEsNumerica('   ')).toBe(false)
    expect(aseguradoraEsNumerica(null)).toBe(false)
    expect(aseguradoraEsNumerica(undefined)).toBe(false)
  })
})

describe('normalizarRetencionVendedor', () => {
  it('deja pasar cualquier porcentaje válido', () => {
    expect(normalizarRetencionVendedor(10)).toEqual({ valor: 10, corregido: false })
    expect(normalizarRetencionVendedor(0)).toEqual({ valor: 0, corregido: false })
    expect(normalizarRetencionVendedor(100)).toEqual({ valor: 100, corregido: false })
    expect(normalizarRetencionVendedor(3.5)).toEqual({ valor: 3.5, corregido: false })
  })

  it('descarta el monto en pesos que venía en la columna de retención', () => {
    // El bug real: 150000 leído como "150000 %" → comisión neta absurda.
    expect(normalizarRetencionVendedor(150000))
      .toEqual({ valor: RETENCION_VENDEDOR_DEFAULT, corregido: true })
    expect(normalizarRetencionVendedor(101))
      .toEqual({ valor: RETENCION_VENDEDOR_DEFAULT, corregido: true })
  })

  it('descarta negativos', () => {
    expect(normalizarRetencionVendedor(-5))
      .toEqual({ valor: RETENCION_VENDEDOR_DEFAULT, corregido: true })
  })

  it('usa el default sin marcar corrección cuando el Excel no trae el dato', () => {
    // Ausencia no es corrupción: no debe ensuciar el reporte de advertencias.
    expect(normalizarRetencionVendedor(null))
      .toEqual({ valor: RETENCION_VENDEDOR_DEFAULT, corregido: false })
    expect(normalizarRetencionVendedor(undefined))
      .toEqual({ valor: RETENCION_VENDEDOR_DEFAULT, corregido: false })
    expect(normalizarRetencionVendedor(NaN))
      .toEqual({ valor: RETENCION_VENDEDOR_DEFAULT, corregido: false })
  })
})
