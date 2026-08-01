import { describe, it, expect } from 'vitest'
import { normalizarTelefono, whatsappLink, plantillaRecordatorioPago } from '../whatsapp'

describe('normalizarTelefono', () => {
  it('antepone 57 a un celular colombiano de 10 dígitos', () => {
    expect(normalizarTelefono('3001234567')).toBe('573001234567')
  })
  it('limpia caracteres no numéricos antes de normalizar', () => {
    expect(normalizarTelefono('(300) 123-4567')).toBe('573001234567')
    expect(normalizarTelefono('+57 300 123 4567')).toBe('573001234567')
  })
  it('respeta un número que ya trae indicativo 57', () => {
    expect(normalizarTelefono('573001234567')).toBe('573001234567')
  })
  it('devuelve vacío si no hay dígitos', () => {
    expect(normalizarTelefono('sin numero')).toBe('')
  })
})

describe('whatsappLink', () => {
  it('devuelve vacío para teléfono nulo o inválido', () => {
    expect(whatsappLink(null)).toBe('')
    expect(whatsappLink('')).toBe('')
    expect(whatsappLink('abc')).toBe('')
  })
  it('construye el link base sin mensaje', () => {
    expect(whatsappLink('3001234567')).toBe('https://wa.me/573001234567')
  })
  it('agrega el mensaje url-encoded', () => {
    const link = whatsappLink('3001234567', 'Hola mundo & cía')
    expect(link.startsWith('https://wa.me/573001234567?text=')).toBe(true)
    expect(link).toContain(encodeURIComponent('Hola mundo & cía'))
  })
})

describe('plantillaRecordatorioPago', () => {
  it('usa el primer nombre y el tono de "próximo pago" cuando no está vencido', () => {
    const msg = plantillaRecordatorioPago({
      nombre: 'Ana María Pérez', ramo: 'Autos', aseguradora: 'Sura',
      valor: '$1.200.000', fecha: '15 ago 2026', vencido: false,
    })
    expect(msg).toContain('Hola Ana')
    expect(msg).toContain('Autos · Sura')
    expect(msg).toContain('$1.200.000')
    expect(msg).toContain('próximo pago')
  })
  it('usa el tono de "pendiente/al día" cuando está vencido', () => {
    const msg = plantillaRecordatorioPago({ nombre: 'Juan', valor: '$50.000', vencido: true })
    expect(msg).toContain('pago pendiente')
    expect(msg).toContain('ponerte al día')
  })
  it('agrega la firma de la agencia si se provee', () => {
    const msg = plantillaRecordatorioPago({ valor: '$10', agencia: 'Senda Seguros' })
    expect(msg).toContain('— Senda Seguros')
  })
})
