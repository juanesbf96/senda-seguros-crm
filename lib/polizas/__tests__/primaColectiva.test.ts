import { describe, it, expect } from 'vitest'
import { derivarPrimaColectiva, IVA_COLECTIVAS } from '../primaColectiva'

describe('derivarPrimaColectiva', () => {
  it('el caso de referencia: 5.000.000 → IVA 950.000, total 5.950.000', () => {
    expect(derivarPrimaColectiva(5000000)).toEqual({
      prima:          5000000,
      prima_neta:     5000000,
      iva:             950000,
      total_prima:    5950000,
      porcentaje_iva:      19,
    })
  })

  it('la suma de los afiliados es la NETA, nunca el total', () => {
    // El bug era escribir la suma donde correspondía un valor con IVA (o al revés).
    const r = derivarPrimaColectiva(1000000)
    expect(r.prima_neta).toBe(1000000)
    expect(r.total_prima).toBeGreaterThan(r.prima_neta)
  })

  it('mantiene la columna legacy sincronizada con prima_neta', () => {
    // Todavía la leen metas, el asistente, la tabla de Cumplimiento y AfiliadosPorPlan.
    for (const neta of [0, 750000, 1234567.89, 5000000]) {
      const r = derivarPrimaColectiva(neta)
      expect(r.prima).toBe(r.prima_neta)
    }
  })

  it('total_prima siempre es prima_neta + iva', () => {
    for (const neta of [1, 999, 750000, 3333333.33]) {
      const r = derivarPrimaColectiva(neta)
      expect(r.total_prima).toBeCloseTo(r.prima_neta + r.iva, 2)
    }
  })

  it('redondea a 2 decimales, sin arrastrar flotantes', () => {
    const r = derivarPrimaColectiva(1234567.89)
    expect(r.iva).toBe(234567.9)          // 1.234.567,89 × 0,19 = 234.567,8991
    expect(r.total_prima).toBe(1469135.79)
    // Nada de 0.30000000000000004
    expect(String(r.iva)).not.toMatch(/\d{6,}$/)
  })

  it('con 0 devuelve todo en 0 (no rompe ni escribe NaN)', () => {
    expect(derivarPrimaColectiva(0)).toMatchObject({ prima_neta: 0, iva: 0, total_prima: 0 })
  })

  it('escribe el porcentaje de IVA para que la fila no se contradiga', () => {
    // Sin esto, PolizaModal recalcularía el IVA desde otro porcentaje al guardar.
    expect(derivarPrimaColectiva(2000000).porcentaje_iva).toBe(IVA_COLECTIVAS)
  })
})
