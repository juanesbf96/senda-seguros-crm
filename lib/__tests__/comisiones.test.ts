import { describe, it, expect } from 'vitest'
import {
  pctDe, comisionAgencia, comisionVendedor, comisionIntermediario,
  retencion, comisionNeta, redondear2,
  RETENCION_VENDEDOR_DEFAULT, RETENCION_AGENCIA,
} from '../comisiones'

describe('pctDe', () => {
  it('calcula base × pct / 100', () => {
    expect(pctDe(1_000_000, 12.5)).toBe(125_000)
    expect(pctDe(0, 10)).toBe(0)
    expect(pctDe(1000, 0)).toBe(0)
  })
})

describe('comisiones derivadas', () => {
  it('comisionAgencia sobre prima neta', () => {
    expect(comisionAgencia(2_000_000, 14)).toBe(280_000)
  })
  it('comisionVendedor sobre la comisión de agencia', () => {
    expect(comisionVendedor(280_000, 50)).toBe(140_000)
  })
  it('comisionIntermediario sobre la comisión de agencia', () => {
    expect(comisionIntermediario(280_000, 25)).toBe(70_000)
  })
})

describe('retención y neto', () => {
  it('usa 10% por defecto', () => {
    expect(RETENCION_VENDEDOR_DEFAULT).toBe(10)
    expect(RETENCION_AGENCIA).toBe(10)
    expect(retencion(100_000)).toBe(10_000)
    expect(comisionNeta(100_000)).toBe(90_000)
  })
  it('acepta un % de retención explícito', () => {
    expect(retencion(100_000, 4)).toBe(4_000)
    expect(comisionNeta(100_000, 4)).toBe(96_000)
  })
  it('neto = bruta − retención (equivale a bruta × 0.9 con 10%)', () => {
    const bruta = 137_979
    expect(comisionNeta(bruta)).toBeCloseTo(bruta * 0.9, 6)
  })
})

describe('redondear2', () => {
  it('redondea a 2 decimales', () => {
    expect(redondear2(140_000.129)).toBe(140_000.13)
    expect(redondear2(99_784.855)).toBe(99_784.86)
    expect(redondear2(100)).toBe(100)
  })
})
