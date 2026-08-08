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
    const { borrador, prima, camposFaltantes } = extraerHeuristica(caratula)
    expect(borrador.numero_poliza).toBe('AUT-0012345')
    expect(borrador.aseguradora).toBe('Sura')
    expect(borrador.tomador_nombre).toContain('Juan Pérez')
    expect(borrador.fecha_inicio).toBe('2026-03-05')
    expect(borrador.fecha_fin).toBe('2027-03-05')
    // "Prima Total" → total poblada, neta null, indeterminada null.
    expect(prima.prima_total).toBe(1200000)
    expect(prima.prima_neta).toBeNull()
    expect(prima.prima_indeterminada).toBeNull()
    expect(borrador.prima).toBe(1200000)   // transicional
    expect(camposFaltantes).toHaveLength(0)
  })
  it('reporta los campos clave que no encuentra', () => {
    const { borrador, camposFaltantes } = extraerHeuristica('Texto sin datos de póliza')
    expect(borrador.numero_poliza).toBeNull()
    expect(camposFaltantes).toContain('numero_poliza')
    expect(camposFaltantes).toContain('prima')
  })
})

describe('extraerHeuristica — discriminación de prima', () => {
  it('carátula que discrimina: neta, IVA y total correctas; indeterminada null', () => {
    const { borrador, prima } = extraerHeuristica(
      'SURA\nPÓLIZA No X-1\nPrima Neta 1.000.000\nIVA 190.000\nPrima Total 1.190.000')
    expect(prima.prima_neta).toBe(1000000)
    expect(prima.prima_total).toBe(1190000)
    expect(prima.iva).toBe(190000)
    expect(prima.prima_indeterminada).toBeNull()
    expect(borrador.prima).toBe(1000000)   // transicional = mejor disponible (neta)
  })
  it('solo "Prima Total": total poblada, neta e indeterminada null', () => {
    const { prima } = extraerHeuristica('Prima Total: 1.190.000')
    expect(prima.prima_total).toBe(1190000)
    expect(prima.prima_neta).toBeNull()
    expect(prima.prima_indeterminada).toBeNull()
  })
  it('"Prima:" a secas cae en indeterminada, NUNCA en neta', () => {
    const { borrador, prima } = extraerHeuristica('Prima: 1.850.000')
    expect(prima.prima_indeterminada).toBe(1850000)
    expect(prima.prima_neta).toBeNull()
    expect(prima.prima_total).toBeNull()
    expect(borrador.prima).toBe(1850000)   // transicional refleja la indeterminada
  })
  it('orden: "Prima Total" no es capturada por el patrón genérico (indeterminada)', () => {
    const { prima } = extraerHeuristica('Prima Total 1.190.000')
    expect(prima.prima_indeterminada).toBeNull()
    expect(prima.prima_total).toBe(1190000)
  })
  it('sin ninguna prima → campo clave "prima" faltante', () => {
    const { prima, camposFaltantes } = extraerHeuristica('Póliza No Z-9, sin montos')
    expect(prima.prima_neta).toBeNull()
    expect(prima.prima_total).toBeNull()
    expect(prima.prima_indeterminada).toBeNull()
    expect(camposFaltantes).toContain('prima')
  })
})

describe('parseRespuestaIA', () => {
  it('parsea prima discriminada (neta + total)', () => {
    const r = parseRespuestaIA('{"numero_poliza":"X-1","prima_neta":500000,"prima_total":595000,"iva":95000}')
    expect(r?.numero_poliza).toBe('X-1')
    expect(r?.prima_neta).toBe(500000)
    expect(r?.prima_total).toBe(595000)
    expect(r?.iva).toBe(95000)
    expect(r?.prima).toBe(500000)   // transicional = mejor disponible
  })
  it('parsea prima indeterminada y tolera formato colombiano en string', () => {
    const r = parseRespuestaIA('```json\n{"aseguradora":"Sura","prima_indeterminada":"1.000.000"}\n```')
    expect(r?.aseguradora).toBe('Sura')
    expect(r?.prima_indeterminada).toBe(1000000)
    expect(r?.prima_neta).toBeNull()
    expect(r?.prima).toBe(1000000)
  })
  it('respeta un campo "prima" antiguo si el modelo lo devolviera', () => {
    const r = parseRespuestaIA('{"prima":750000}')
    expect(r?.prima).toBe(750000)
  })
  it('devuelve null si no hay JSON', () => {
    expect(parseRespuestaIA('no pude extraer nada')).toBeNull()
  })
})
