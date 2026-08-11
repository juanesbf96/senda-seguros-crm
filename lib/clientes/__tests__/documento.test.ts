import { describe, it, expect } from 'vitest'
import {
  normalizarDocumento, variantesDocumento, mismoDocumento,
  indexarPorDocumento, buscarEnIndice,
} from '../documento'

describe('normalizarDocumento', () => {
  it('deja solo dígitos, sin importar cómo esté escrito', () => {
    // Es la raíz de F4: el mismo documento escrito distinto creaba otro cliente.
    expect(normalizarDocumento('900.123.456-7')).toBe('9001234567')
    expect(normalizarDocumento('43.215.678')).toBe('43215678')
    expect(normalizarDocumento(' 1020304050 ')).toBe('1020304050')
  })

  it('devuelve vacío ante ausencia de documento', () => {
    expect(normalizarDocumento(null)).toBe('')
    expect(normalizarDocumento(undefined)).toBe('')
    expect(normalizarDocumento('  ')).toBe('')
    expect(normalizarDocumento('sin datos')).toBe('')
  })
})

describe('mismoDocumento', () => {
  it('reconoce el mismo documento escrito de formas distintas', () => {
    expect(mismoDocumento('900.123.456-7', '9001234567')).toBe(true)
    expect(mismoDocumento('43.215.678', '43215678')).toBe(true)
  })

  it('reconoce un NIT con y sin dígito de verificación', () => {
    // Unas filas lo guardan con DV y otras sin él; son la misma empresa.
    expect(mismoDocumento('900123456-7', '900123456')).toBe(true)
    expect(mismoDocumento('9001234567', '900123456')).toBe(true)
  })

  it('NO confunde documentos distintos', () => {
    expect(mismoDocumento('43215678', '43215679')).toBe(false)
    expect(mismoDocumento('900123456', '800123456')).toBe(false)
    // Uno contenido en otro pero con más de un dígito de diferencia no es DV.
    expect(mismoDocumento('90012345678', '900123456')).toBe(false)
  })

  it('sin documento nunca hay coincidencia (dos vacíos no son la misma persona)', () => {
    expect(mismoDocumento(null, null)).toBe(false)
    expect(mismoDocumento('', '43215678')).toBe(false)
  })
})

describe('variantesDocumento', () => {
  it('incluye crudo, solo dígitos y sin dígito de verificación', () => {
    const v = variantesDocumento('900.123.456-7')
    expect(v).toContain('900.123.456-7')   // como está guardado en filas históricas
    expect(v).toContain('9001234567')
    expect(v).toContain('900123456')
  })

  it('no genera variante de DV para una cédula corta', () => {
    expect(variantesDocumento('43215678')).toEqual(['43215678'])
  })

  it('devuelve lista vacía si no hay documento', () => {
    expect(variantesDocumento(null)).toEqual([])
    expect(variantesDocumento('N/A')).toEqual([])
  })
})

describe('indexarPorDocumento / buscarEnIndice', () => {
  const existentes = [
    { id: 'c1', nombre: 'Inversiones Vortice SAS', cedula: null, nit: '901310952-5' },
    { id: 'c2', nombre: 'Maria Gomez',             cedula: '43.215.678', nit: null },
    { id: 'c3', nombre: 'Sin documento',           cedula: null, nit: null },
  ]

  it('encuentra el cliente aunque el documento venga escrito distinto', () => {
    const idx = indexarPorDocumento(existentes)
    expect(buscarEnIndice(idx, '9013109525')?.id).toBe('c1')
    expect(buscarEnIndice(idx, '901310952')?.id).toBe('c1')   // sin DV
    expect(buscarEnIndice(idx, '43215678')?.id).toBe('c2')
    expect(buscarEnIndice(idx, '43.215.678')?.id).toBe('c2')
  })

  it('devuelve null cuando el documento no existe', () => {
    const idx = indexarPorDocumento(existentes)
    expect(buscarEnIndice(idx, '11111111')).toBeNull()
  })

  it('no indexa clientes sin documento (no se pueden deduplicar así)', () => {
    const idx = indexarPorDocumento(existentes)
    expect(buscarEnIndice(idx, null)).toBeNull()
    expect(buscarEnIndice(idx, '')).toBeNull()
  })

  it('ante dos clientes con el mismo documento se queda con el primero', () => {
    // Ya hay duplicados en producción: el índice tiene que ser determinista.
    const idx = indexarPorDocumento([
      { id: 'viejo', cedula: '43215678' },
      { id: 'nuevo', cedula: '43215678' },
    ])
    expect(buscarEnIndice(idx, '43215678')?.id).toBe('viejo')
  })
})
