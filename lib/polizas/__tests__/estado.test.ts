import { describe, it, expect } from 'vitest'
import { estadoEfectivo, esVigente } from '../estado'

const HOY = '2026-08-08'

describe('estadoEfectivo', () => {
  it('una cancelada con vigencia futura NO se muestra activa', () => {
    // El bug: la fecha mandaba y la cancelación quedaba invisible, justo en el
    // caso en que cancelar importa (nadie cancela una póliza ya vencida).
    expect(estadoEfectivo({ estado: 'cancelada', fecha_fin: '2027-08-08' }, HOY)).toBe('cancelada')
  })

  it('una cancelada ya vencida sigue siendo cancelada', () => {
    expect(estadoEfectivo({ estado: 'cancelada', fecha_fin: '2020-01-01' }, HOY)).toBe('cancelada')
  })

  it('una pendiente no se muestra activa por tener vigencia futura', () => {
    expect(estadoEfectivo({ estado: 'pendiente', fecha_fin: '2027-08-08' }, HOY)).toBe('pendiente')
  })

  it('sigue calculando activa/vencida por fecha, ignorando un estado obsoleto', () => {
    // Esto es lo que la fase 6 vino a arreglar y NO se puede perder: nadie
    // actualiza la columna el día que la póliza vence.
    expect(estadoEfectivo({ estado: 'activa', fecha_fin: '2020-01-01' }, HOY)).toBe('vencida')
    expect(estadoEfectivo({ estado: 'vencida', fecha_fin: '2027-08-08' }, HOY)).toBe('activa')
  })

  it('el día del vencimiento la póliza sigue activa', () => {
    expect(estadoEfectivo({ estado: 'activa', fecha_fin: HOY }, HOY)).toBe('activa')
  })

  it('sin fecha_fin cae en la columna, y sin nada asume activa', () => {
    expect(estadoEfectivo({ estado: 'vencida', fecha_fin: null }, HOY)).toBe('vencida')
    expect(estadoEfectivo({ estado: null, fecha_fin: null }, HOY)).toBe('activa')
    expect(estadoEfectivo({}, HOY)).toBe('activa')
  })
})

describe('esVigente', () => {
  it('no cuenta como vigente una póliza cancelada', () => {
    // El conteo "N activas" de la cabecera las estaba sumando.
    expect(esVigente({ estado: 'cancelada', fecha_fin: '2027-08-08' }, HOY)).toBe(false)
  })

  it('cuenta como vigente una póliza en curso', () => {
    expect(esVigente({ estado: 'activa', fecha_fin: '2027-08-08' }, HOY)).toBe(true)
  })
})
