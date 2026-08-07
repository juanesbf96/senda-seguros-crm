import { describe, it, expect } from 'vitest'
import { modeloEfectivo, mapaMensajesGemini, MODELO_DEFAULT, PROVEEDORES_IA } from '../ia/motor'

describe('modeloEfectivo', () => {
  it('usa el modelo del workspace cuando está definido', () => {
    expect(modeloEfectivo({ proveedor: 'openai', modelo: 'gpt-4o' })).toBe('gpt-4o')
  })
  it('cae al default del proveedor cuando el modelo es null o vacío', () => {
    expect(modeloEfectivo({ proveedor: 'openai', modelo: null })).toBe(MODELO_DEFAULT.openai)
    expect(modeloEfectivo({ proveedor: 'groq', modelo: '   ' })).toBe(MODELO_DEFAULT.groq)
  })
})

describe('mapaMensajesGemini', () => {
  it('traduce assistant → model y user → user, con parts', () => {
    const out = mapaMensajesGemini([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'qué tal' },
    ])
    expect(out).toEqual([
      { role: 'user', parts: [{ text: 'hola' }] },
      { role: 'model', parts: [{ text: 'qué tal' }] },
    ])
  })
})

describe('catálogo de proveedores', () => {
  it('todos los proveedores tienen modelo por defecto', () => {
    for (const p of PROVEEDORES_IA) {
      expect(MODELO_DEFAULT[p]).toBeTruthy()
    }
  })
})
