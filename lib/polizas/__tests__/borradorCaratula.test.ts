import { describe, it, expect } from 'vitest'
import {
  borradorAPoliza, camposBorrador, mapearRamo, mapearAseguradora, resolverPrima,
} from '../borradorCaratula'
import {
  CARATULA_PARSER_ALTA, CARATULA_IA_REVISION, CARATULA_INCOMPLETA,
  CARATULA_TOTAL_CON_IVA, CARATULA_SOLO_TOTAL, CARATULA_PRIMA_INDETERMINADA,
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
    const p = borradorAPoliza(CARATULA_PARSER_ALTA, 'cli-1')
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
    const p = borradorAPoliza(CARATULA_PARSER_ALTA, 'cli-1')
    expect('id' in p).toBe(false)
  })

  it('omite client_id cuando el tomador no se pudo resolver', () => {
    const p = borradorAPoliza(CARATULA_PARSER_ALTA)
    expect('client_id' in p).toBe(false)
  })

  it('carga la prima como prima_neta (base de cálculo del formulario)', () => {
    const p = borradorAPoliza(CARATULA_IA_REVISION)
    expect(p.prima_neta).toBe(990000)
  })

  it('deja en null los campos que el extractor no encontró', () => {
    const p = borradorAPoliza(CARATULA_INCOMPLETA)
    expect(p.numero_poliza).toBeNull()
    expect(p.fecha_inicio).toBeNull()
    expect(p.prima_neta).toBeNull()
    expect(p.ramo).toBe('')          // 'Maquinaria' no está en el catálogo
    expect(p.aseguradora).toBe('')
  })

  it('aplica el alias de aseguradora en el pre-llenado', () => {
    const p = borradorAPoliza(CARATULA_IA_REVISION)
    expect(p.aseguradora).toBe('Bolívar')
  })
})

describe('camposBorrador', () => {
  it('desglosa la prima en neta / IVA / total cuando la carátula los discrimina', () => {
    const filas = camposBorrador(CARATULA_PARSER_ALTA)
    const primas = filas.filter(f => f.campo.startsWith('prima') || f.campo === 'iva')
    expect(primas.map(f => f.campo)).toEqual(['prima_neta', 'iva', 'prima_total'])
    expect(primas[0].valor).toBe('$ 1.850.000')
    expect(primas.every(f => !f.falta)).toBe(true)
  })

  it('mantiene los 7 campos del borrador antes de la prima, en orden', () => {
    const filas = camposBorrador(CARATULA_PARSER_ALTA)
    expect(filas.slice(0, 7).map(f => f.campo)).toEqual([
      'numero_poliza', 'aseguradora', 'ramo', 'tomador_nombre',
      'tomador_documento', 'fecha_inicio', 'fecha_fin',
    ])
  })

  it('muestra solo las filas de prima que existen', () => {
    // Esta carátula trae solo neta: no debe inventar filas de IVA ni total.
    const campos = camposBorrador(CARATULA_IA_REVISION).map(f => f.campo)
    expect(campos).toContain('prima_neta')
    expect(campos).not.toContain('iva')
    expect(campos).not.toContain('prima_total')
  })

  it('marca la prima indeterminada como pendiente aunque tenga valor', () => {
    // Lo que falta no es el número: es saber de qué tipo es.
    const fila = camposBorrador(CARATULA_PRIMA_INDETERMINADA)
      .find(f => f.campo === 'prima_indeterminada')!
    expect(fila.valor).toBe('$ 1.500.000')
    expect(fila.falta).toBe(true)
    expect(fila.label).toMatch(/IVA/)
  })

  it('deja una fila de prima vacía y marcada cuando no se encontró ninguna', () => {
    const fila = camposBorrador(CARATULA_INCOMPLETA).find(f => f.campo === 'prima')!
    expect(fila.valor).toBeNull()
    expect(fila.falta).toBe(true)
  })

  it('marca como faltante todo campo vacío del borrador', () => {
    const porCampo = Object.fromEntries(camposBorrador(CARATULA_IA_REVISION).map(f => [f.campo, f.falta]))
    expect(porCampo.fecha_fin).toBe(true)       // reportado por el endpoint
    expect(porCampo.numero_poliza).toBe(false)  // sí vino
  })

  it('muestra la aseguradora ya normalizada', () => {
    const filas = camposBorrador(CARATULA_IA_REVISION)
    expect(filas.find(f => f.campo === 'aseguradora')!.valor).toBe('Bolívar')
  })
})

describe('resolverPrima', () => {
  it('usa la neta tal cual cuando la carátula la trae', () => {
    const r = resolverPrima({ prima_neta: 1000000, prima_total: null, iva: null, prima_indeterminada: null })
    expect(r).toMatchObject({ prima_neta: 1000000, origen: 'neta', aviso: null })
  })

  it('con neta + IVA usa el porcentaje REAL, no el 19% por defecto', () => {
    // Ramo exento: si se asumiera 19% el total quedaría inflado.
    const r = resolverPrima({ prima_neta: 1000000, prima_total: 1000000, iva: 0, prima_indeterminada: null })
    expect(r.prima_neta).toBe(1000000)
    expect(r.porcentaje_iva).toBe(0)
    expect(r.origen).toBe('neta')
  })

  it('deriva la neta de forma exacta cuando hay total + IVA discriminado', () => {
    const r = resolverPrima(CARATULA_TOTAL_CON_IVA)
    expect(r.prima_neta).toBe(1000000)      // 1.190.000 − 190.000
    expect(r.porcentaje_iva).toBe(19)
    expect(r.origen).toBe('derivada_iva')
    expect(r.aviso).toContain('producción')
  })

  it('con solo el total estima la neta y DECLARA el supuesto', () => {
    const r = resolverPrima(CARATULA_SOLO_TOTAL)
    expect(r.prima_neta).toBe(2000000)      // 2.380.000 / 1.19
    expect(r.porcentaje_iva).toBe(19)
    expect(r.origen).toBe('derivada_supuesto')
    // El aviso debe nombrar el supuesto y el caso donde falla.
    expect(r.aviso).toContain('19%')
    expect(r.aviso).toMatch(/SOAT/)
  })

  it('nunca guarda un valor con IVA como si fuera neto', () => {
    // La neta es la producción del CRM y la base de la comisión: cargar el
    // total ahí la sobrevaloraría ~19%.
    const r = resolverPrima(CARATULA_SOLO_TOTAL)
    expect(r.prima_neta).toBeLessThan(CARATULA_SOLO_TOTAL.prima_total!)
  })

  it('con prima indeterminada la carga pero pide confirmar el tipo', () => {
    const r = resolverPrima(CARATULA_PRIMA_INDETERMINADA)
    expect(r.prima_neta).toBe(1500000)
    expect(r.porcentaje_iva).toBeNull()     // deja el default del formulario
    expect(r.origen).toBe('indeterminada')
    expect(r.aviso).toMatch(/no dice si incluye IVA/)
  })

  it('sin ninguna prima no carga nada ni avisa', () => {
    const r = resolverPrima(CARATULA_INCOMPLETA)
    expect(r).toMatchObject({ prima_neta: null, porcentaje_iva: null, origen: 'ninguna', aviso: null })
  })

  it('tolera un wrapper sin los campos de prima (fixtures viejos)', () => {
    expect(resolverPrima(undefined).origen).toBe('ninguna')
    expect(resolverPrima({}).origen).toBe('ninguna')
  })
})

describe('borradorAPoliza — prima', () => {
  it('pre-carga el porcentaje de IVA cuando se pudo derivar', () => {
    const p = borradorAPoliza(CARATULA_TOTAL_CON_IVA)
    expect(p.prima_neta).toBe(1000000)
    expect(p.porcentaje_iva).toBe(19)
  })

  it('omite porcentaje_iva cuando no se pudo determinar, para no pisar el default', () => {
    const p = borradorAPoliza(CARATULA_PRIMA_INDETERMINADA)
    expect(p.prima_neta).toBe(1500000)
    expect('porcentaje_iva' in p).toBe(false)
  })

  it('ya no depende de borrador.prima (campo transicional)', () => {
    // Si el wrapper no trae prima discriminada, no se cae de vuelta al campo viejo.
    const sinDiscriminar = { ...CARATULA_SOLO_TOTAL, prima_total: null }
    expect(borradorAPoliza(sinDiscriminar).prima_neta).toBeNull()
  })
})
