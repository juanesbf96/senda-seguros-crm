import { describe, it, expect } from 'vitest'
import { normalizarFecha, normalizarMonto, extraerHeuristica } from '../heuristica'
import { detectarAseguradora } from '../aseguradoras'
import { parseRespuestaIA } from '../promptIA'

describe('normalizarFecha', () => {
  it('convierte DD/MM/AAAA a YYYY-MM-DD', () => {
    expect(normalizarFecha('05/03/2026')).toBe('2026-03-05')
    expect(normalizarFecha('5-3-2026')).toBe('2026-03-05')
  })
  it('expande año de 2 dígitos', () => {
    expect(normalizarFecha('01/01/26')).toBe('2026-01-01')
    expect(normalizarFecha('01/01/99')).toBe('1999-01-01')
  })
  it('rechaza fechas inválidas o vacías', () => {
    expect(normalizarFecha('32/13/2026')).toBeNull()
    expect(normalizarFecha(null)).toBeNull()
    expect(normalizarFecha('sin fecha')).toBeNull()
  })
})

describe('normalizarMonto', () => {
  it('parsea formato colombiano con miles y decimales', () => {
    expect(normalizarMonto('$1.234.567')).toBe(1234567)
    expect(normalizarMonto('1.234.567,89')).toBe(1234567.89)
    expect(normalizarMonto('900000')).toBe(900000)
  })
  it('devuelve null si no hay dígitos', () => {
    expect(normalizarMonto('N/A')).toBeNull()
    expect(normalizarMonto(null)).toBeNull()
  })
})

describe('detectarAseguradora', () => {
  it('reconoce aseguradoras por su marca en el texto', () => {
    expect(detectarAseguradora('SEGUROS SURA S.A. Póliza...')).toBe('Sura')
    expect(detectarAseguradora('Compañía de Seguros Bolívar')).toBe('Seguros Bolívar')
    expect(detectarAseguradora('AXA COLPATRIA SEGUROS')).toBe('AXA Colpatria')
  })
  it('devuelve null si no reconoce ninguna', () => {
    expect(detectarAseguradora('Aseguradora Desconocida XYZ')).toBeNull()
  })
})

describe('extraerHeuristica', () => {
  const caratula = `
    SEGUROS SURA S.A.
    Póliza No: AUT-0012345
    Ramo: Automóviles
    Tomador: Juan Pérez Gómez
    C.C. 79.123.456
    Vigencia desde 05/03/2026 hasta 05/03/2027
    Prima Total: $1.200.000
  `
  it('extrae los campos clave de una carátula típica', () => {
    const { borrador, camposFaltantes } = extraerHeuristica(caratula)
    expect(borrador.numero_poliza).toBe('AUT-0012345')
    expect(borrador.aseguradora).toBe('Sura')
    expect(borrador.tomador_nombre).toContain('Juan Pérez')
    expect(borrador.fecha_inicio).toBe('2026-03-05')
    expect(borrador.fecha_fin).toBe('2027-03-05')
    expect(borrador.prima).toBe(1200000)
    expect(camposFaltantes).toHaveLength(0)
  })
  it('reporta los campos clave que no encuentra', () => {
    const { borrador, camposFaltantes } = extraerHeuristica('Texto sin datos de póliza')
    expect(borrador.numero_poliza).toBeNull()
    expect(camposFaltantes).toContain('numero_poliza')
    expect(camposFaltantes).toContain('prima')
  })
})

describe('parseRespuestaIA', () => {
  it('parsea un JSON limpio', () => {
    const r = parseRespuestaIA('{"numero_poliza":"X-1","prima":500000,"fecha_inicio":"2026-01-01"}')
    expect(r?.numero_poliza).toBe('X-1')
    expect(r?.prima).toBe(500000)
  })
  it('tolera ```json y texto alrededor', () => {
    const r = parseRespuestaIA('Aquí está:\n```json\n{"aseguradora":"Sura","prima":"1.000.000"}\n```')
    expect(r?.aseguradora).toBe('Sura')
    expect(r?.prima).toBe(1000000)
  })
  it('devuelve null si no hay JSON', () => {
    expect(parseRespuestaIA('no pude extraer nada')).toBeNull()
  })
})
