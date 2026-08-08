import { describe, it, expect } from 'vitest'
import { formatDate } from '../utils'

describe('formatDate', () => {
  it('formatea una fecha sola (columnas date: vigencias, compromisos)', () => {
    expect(formatDate('2026-08-08')).toBe('08 de ago de 2026')
  })

  it('no corre el día por zona horaria', () => {
    // Sin el ancla de hora local, '2026-01-01' se mostraría como 31 dic en Colombia.
    expect(formatDate('2026-01-01')).toBe('01 de ene de 2026')
  })

  it('formatea un timestamp completo (created_at)', () => {
    // El bug: concatenarle 'T00:00:00' daba "Invalid Date" en la cronología,
    // en la ficha del cliente y en la lista de colillas.
    expect(formatDate('2026-08-08T03:57:12.345Z')).toMatch(/ago de 2026$/)
    expect(formatDate('2026-08-08T03:57:12.345Z')).not.toContain('Invalid')
  })

  it('acepta un timestamp con offset', () => {
    expect(formatDate('2026-08-08T10:30:00+00:00')).toMatch(/ago de 2026$/)
  })

  it('devuelve guion ante ausencia de fecha', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
  })

  it('devuelve guion ante basura, nunca "Invalid Date"', () => {
    expect(formatDate('no es fecha')).toBe('—')
    expect(formatDate('0000-00-00')).toBe('—')
  })
})
