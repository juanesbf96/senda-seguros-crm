import { describe, it, expect } from 'vitest'
import {
  borradorAPoliza, camposBorrador, mapearRamo, mapearAseguradora,
} from '../borradorCaratula'
import {
  CARATULA_PARSER_ALTA, CARATULA_IA_REVISION, CARATULA_INCOMPLETA,
} from '../__fixtures__/caratulas'

describe('mapearAseguradora', () => {
  it('normaliza los alias que el extractor escribe distinto al CRM', () => {
    // Sin esto se siembra una segunda grafía del mismo emisor.
    expect(mapearAseguradora('Seguros Bolívar')).toBe('Bolívar')
    expect(mapearAseguradora('Equidad Seguros')).toBe('La Equidad')
  })

  it('deja intactas las que ya coinciden', () => {
    expect(mapearAseguradora('Sura')).toBe('Sura')
    expect(mapearAseguradora('AXA Colpatria')).toBe('AXA Colpatria')
  })

  it('conserva una aseguradora desconocida (PolizaModal la maneja como "Otro")', () => {
    expect(mapearAseguradora('Zurich')).toBe('Zurich')
  })

  it('devuelve vacío si no se detectó', () => {
    expect(mapearAseguradora(null)).toBe('')
  })
})

describe('mapearRamo', () => {
  it('traduce los ramos inequívocos al catálogo del formulario', () => {
    expect(mapearRamo('Soat')).toEqual({ valor: 'SOAT', inferido: false })
    expect(mapearRamo('Autos')).toEqual({ valor: 'Todo Riesgo Vehículo', inferido: false })
    expect(mapearRamo('Rc')).toEqual({ valor: 'Responsabilidad Civil', inferido: false })
    expect(mapearRamo('transporte')).toEqual({ valor: 'Transportes', inferido: false })
  })

  it('marca como inferidos los ramos ambiguos', () => {
    // 'Vida' puede ser individual o grupo: se sugiere, pero se avisa.
    expect(mapearRamo('Vida')).toEqual({ valor: 'Vida Individual', inferido: true })
  })

  it('deja vacío un ramo fuera del catálogo en vez de inventarlo', () => {
    expect(mapearRamo('Maquinaria')).toEqual({ valor: '', inferido: false })
    expect(mapearRamo(null)).toEqual({ valor: '', inferido: false })
  })
})

describe('borradorAPoliza', () => {
  it('mapea una carátula completa al pre-llenado del formulario', () => {
    const p = borradorAPoliza(CARATULA_PARSER_ALTA.borrador, 'cli-1')
    expect(p).toMatchObject({
      client_id:      'cli-1',
      numero_poliza:  '010-45-9876543',
      aseguradora:    'Sura',
      ramo:           'Todo Riesgo Vehículo',
      nombre_tomador: 'MARIA FERNANDA GOMEZ RUIZ',
      fecha_inicio:   '2026-03-01',
      fecha_fin:      '2027-03-01',
      prima_neta:     1850000,
    })
  })

  it('NO incluye id: PolizaModal detecta el modo crear por su ausencia', () => {
    const p = borradorAPoliza(CARATULA_PARSER_ALTA.borrador, 'cli-1')
    expect('id' in p).toBe(false)
  })

  it('omite client_id cuando el tomador no se pudo resolver', () => {
    const p = borradorAPoliza(CARATULA_PARSER_ALTA.borrador)
    expect('client_id' in p).toBe(false)
  })

  it('carga la prima como prima_neta (base de cálculo del formulario)', () => {
    const p = borradorAPoliza(CARATULA_IA_REVISION.borrador)
    expect(p.prima_neta).toBe(990000)
  })

  it('deja en null los campos que el extractor no encontró', () => {
    const p = borradorAPoliza(CARATULA_INCOMPLETA.borrador)
    expect(p.numero_poliza).toBeNull()
    expect(p.fecha_inicio).toBeNull()
    expect(p.prima_neta).toBeNull()
    expect(p.ramo).toBe('')          // 'Maquinaria' no está en el catálogo
    expect(p.aseguradora).toBe('')
  })

  it('aplica el alias de aseguradora en el pre-llenado', () => {
    const p = borradorAPoliza(CARATULA_IA_REVISION.borrador)
    expect(p.aseguradora).toBe('Bolívar')
  })
})

describe('camposBorrador', () => {
  it('devuelve las 8 filas del preview en orden', () => {
    const filas = camposBorrador(CARATULA_PARSER_ALTA.borrador)
    expect(filas).toHaveLength(8)
    expect(filas[0].campo).toBe('numero_poliza')
    expect(filas.at(-1)!.campo).toBe('prima')
  })

  it('formatea la prima en pesos', () => {
    const prima = camposBorrador(CARATULA_PARSER_ALTA.borrador).find(f => f.campo === 'prima')
    expect(prima!.valor).toBe('$ 1.850.000')
  })

  it('no marca ningún faltante cuando la extracción vino completa', () => {
    const filas = camposBorrador(CARATULA_PARSER_ALTA.borrador, CARATULA_PARSER_ALTA.campos_faltantes)
    expect(filas.filter(f => f.falta)).toHaveLength(0)
  })

  it('marca como faltante todo campo vacío, lo reporte o no el endpoint', () => {
    const filas = camposBorrador(CARATULA_IA_REVISION.borrador, CARATULA_IA_REVISION.campos_faltantes)
    const porCampo = Object.fromEntries(filas.map(f => [f.campo, f.falta]))
    expect(porCampo.fecha_fin).toBe(true)       // reportado por el endpoint
    expect(porCampo.numero_poliza).toBe(false)  // sí vino
  })

  it('muestra la aseguradora ya normalizada', () => {
    const filas = camposBorrador(CARATULA_IA_REVISION.borrador)
    expect(filas.find(f => f.campo === 'aseguradora')!.valor).toBe('Bolívar')
  })
})
