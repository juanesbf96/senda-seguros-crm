/**
 * Tests de los parsers de colillas con fixtures SINTÉTICOS.
 *
 * Los archivos reales de las aseguradoras contienen datos de clientes (PII)
 * y el repo es público, así que NO se commitean. En su lugar, cada fixture
 * reproduce el formato/layout exacto de cada aseguradora con datos falsos.
 * Estos tests bloquean regresiones en la lógica de parseo — que ya se rompió
 * antes (fechas mal formateadas, columnas mal mapeadas, números inflados).
 *
 * Los 4 parsers PDF se prueban vía su función pura parseXxxText(text), que
 * opera sobre el texto ya extraído (sin pdf-parse ni canvas en CI).
 * Los 3 parsers XLSX reciben un buffer .xlsx sintético construido con la
 * librería xlsx. SURA recibe el CSV como texto.
 */
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'

import { parseQualitasText } from '../qualitas'
import { parseAxaText } from '../axa'
import { parseBolivarText } from '../bolivar'
import { parseExpertosText } from '../expertos'
import { parseSura } from '../sura'
import { parseSbs } from '../sbs'
import { parseViva } from '../viva'
import { parseCuarentaYOchoHoras } from '../cuarenta_y_ocho_horas'

/** Construye un ArrayBuffer .xlsx a partir de un array de arrays (una hoja). */
function aoaToXlsxBuffer(aoa: unknown[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return buf
}

// ── QUÁLITAS ────────────────────────────────────────────────────────────
describe('parseQualitas', () => {
  it('extrae solo filas ACN con póliza/tomador/prima/%/comisión', () => {
    const text = [
      'FECHA PÓLIZA ENDOSO RECIBO SERIE REG.CTB. CVE ASEGURADO / CONCEPTO IMPORTE % COMIS. COMISIÓN',
      '08 0070001106 000000 0000043777 01/01 0000042334 ACN JUAN PEREZ GOMEZ 1,000,000 14.00 140,000 0 14,000 0 0 0 126,000',
      '11 0070001214 000000 0000048126 01/01 0000042499 ACN MARIA LOPEZ SOTO 2,000,000 14.00 280,000 0 28,000 0 0 0 252,000',
      '15 0000000000 0 0000000 00/00 0000043753 PCN PAGO COMISIONES DEL 16 AL 30 837,482 0 83,748',
      'TOT. RAMO. 03 : 4,429,702 620,158',
    ].join('\n')

    const r = parseQualitasText(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lineas).toHaveLength(2)
    expect(r.lineas[0]).toEqual({
      numero_poliza_raw: '0070001106',
      nombre_tomador: 'JUAN PEREZ GOMEZ',
      valor_prima: 1000000,
      porcentaje_comision: 14,
      valor_comision: 140000,
    })
    expect(r.lineas[1].numero_poliza_raw).toBe('0070001214')
    expect(r.lineas[1].valor_comision).toBe(280000)
  })

  it('devuelve error si no hay filas ACN', () => {
    const r = parseQualitasText('cualquier texto sin filas de comisión')
    expect(r.ok).toBe(false)
  })
})

// ── AXA ─────────────────────────────────────────────────────────────────
describe('parseAxa', () => {
  it('parsea filas dentro de la tabla, con fecha YYYYMMDD y montos estilo europeo', () => {
    const text = [
      'COMPAÑIA: AXA COLPATRIA SEGUROS S.A',
      'POLIZA TOMADOR RECIBO RAMO PERIODO VR RECAUDO VR COMISION FECHA RE %',
      '000000108657 1 SERNA VILLEGAS JOAQUIN 133650340 00001 00000001 2.000.000 250.000 20260504 12,50',
      '000000108969 1 CUARTAS ARANGO DIEGO 133649515 00001 00000001 1.700.000 212.500 20260504 12,50',
      'TOTAL CONCEPTO 3.700.000 462.500',
    ].join('\n')

    const r = parseAxaText(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lineas).toHaveLength(2)
    expect(r.lineas[0]).toEqual({
      numero_poliza_raw: '000000108657',
      nombre_tomador: 'SERNA VILLEGAS JOAQUIN',
      valor_prima: 2000000,
      valor_comision: 250000,
      fecha_pago: '2026-05-04',
    })
  })

  it('no parsea filas fuera de la tabla (antes del header)', () => {
    const text = '000000108657 1 SERNA VILLEGAS JOAQUIN 133650340 00001 00000001 2.000.000 250.000 20260504 12,50'
    const r = parseAxaText(text)
    expect(r.ok).toBe(false)  // sin header, enTabla nunca se activa
  })
})

// ── BOLÍVAR ─────────────────────────────────────────────────────────────
describe('parseBolivar', () => {
  it('asocia póliza (13 díg) con la línea de montos estilo US posterior', () => {
    const text = [
      '71005 COMISION GRAVADA DV $2,000,000 1 250 1 1234567890123 1 1',
      'PABLO',
      'ANDRES',
      'GOMEZ',
      '$2,000,000 $2,000,000 100 $250,000',
      '1 250 1 1234567890999 1 1',
      'MARIA',
      '$3,000,000 $3,000,000 100 $375,000',
    ].join('\n')

    const r = parseBolivarText(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lineas).toHaveLength(2)
    expect(r.lineas[0]).toEqual({
      numero_poliza_raw: '1234567890123',
      valor_prima: 2000000,
      valor_comision: 250000,
    })
    expect(r.lineas[1].numero_poliza_raw).toBe('1234567890999')
    expect(r.lineas[1].valor_comision).toBe(375000)
  })
})

// ── EXPERTOS ────────────────────────────────────────────────────────────
describe('parseExpertos', () => {
  it('usa la 3ra cifra (comisión asesor) de la línea siguiente al header', () => {
    const text = [
      '12345678 SURA JUAN PEREZ',
      'ANG 1.000.000 $ 150.000 $ 120.000 $',
      '87654321 HDI MARIA LOPEZ',
      'ANG 2.000.000 $ 300.000 $ 240.000 $',
    ].join('\n')

    const r = parseExpertosText(text)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lineas).toHaveLength(2)
    expect(r.lineas[0]).toEqual({
      numero_poliza_raw: '12345678',
      nombre_tomador: 'JUAN PEREZ',
      valor_prima: 1000000,
      valor_comision: 120000,
    })
    expect(r.lineas[1].valor_comision).toBe(240000)
  })
})

// ── SURA (CSV) ──────────────────────────────────────────────────────────
describe('parseSura', () => {
  it('parsea CSV ; y agrupa por póliza sumando comisiones', () => {
    const header = Array.from({ length: 26 }, (_, i) => `col${i}`).join(';')
    // Columnas relevantes: [4]=póliza [7]=tomador [10]=prima [14]=% [16]=comisión [22]=recaudo [24]=pago
    const fila = (poliza: string, prima: string, comision: string) => {
      const cols = Array.from({ length: 26 }, () => '""')
      cols[4] = `"${poliza}"`
      cols[7] = '"JUAN PEREZ"'
      cols[10] = `"${prima}"`
      cols[14] = '"5"'
      cols[16] = `"${comision}"`
      cols[22] = '"2026-05-29 00:00:00.0"'
      cols[24] = '"2026-06-10 00:00:00.0"'
      return cols.join(';')
    }
    const csv = [
      header,
      fila('113101262256', '341332', '17067'),
      fila('113101262256', '27426', '1371'),   // misma póliza → se agrupa
      fila('113101255379', '333302', '16665'),
    ].join('\n')

    const r = parseSura(csv)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lineas).toHaveLength(2)  // dos pólizas únicas
    const p1 = r.lineas.find(l => l.numero_poliza_raw === '113101262256')!
    expect(p1.valor_comision).toBe(17067 + 1371)  // sumadas
    expect(p1.valor_prima).toBe(341332 + 27426)
    expect(p1.fecha_pago).toBe('2026-06-10')
  })
})

// ── SBS (XLS) ───────────────────────────────────────────────────────────
describe('parseSbs', () => {
  it('detecta la fila de headers y mapea póliza/comisión/prima/asegurado', () => {
    const buf = aoaToXlsxBuffer([
      ['RESUMEN DE CUENTA'],           // ruido antes del header
      [],
      ['Póliza', 'Documento - Asegurado', 'Prima Cobrada', 'Comisión Acreditada'],
      ['1000040', 'TRANSPORTCARS SAS', 79286.62, 15857.32],
      ['1011031', 'OSORIO SANTIAGO', 665232.43, 99784.86],
      ['', 'Total', '', ''],           // fila sin póliza → se ignora
    ])

    return parseSbs(buf).then(r => {
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.lineas).toHaveLength(2)
      expect(r.lineas[0]).toMatchObject({
        numero_poliza_raw: '1000040',
        nombre_tomador: 'TRANSPORTCARS SAS',
        valor_prima: 79286.62,
        valor_comision: 15857.32,
      })
    })
  })

  it('no infla valores numéricos ya nativos (bug histórico del punto decimal)', () =>
    parseSbs(aoaToXlsxBuffer([
      ['Póliza', 'Comisión Acreditada', 'Prima Cobrada'],
      ['555', 15857.32, 79286.62],
    ])).then(r => {
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.lineas[0].valor_comision).toBe(15857.32)  // NO 1585732
    }))
})

// ── VIVA (XLSX) ─────────────────────────────────────────────────────────
describe('parseViva', () => {
  it('mapea POLIZA/ASEGURADO/VALOR RECAUDO/DEVENGADOS y limpia sufijo Allianz', () => {
    const buf = aoaToXlsxBuffer([
      ['AXA COLPATRIA - SARA'],        // encabezado de sección
      ['POLIZA', 'ASEGURADO', 'VALOR RECAUDO', 'DEVENGADOS'],
      ['108063', 'PALACIO JUAN', 2075618, 259452],
      ['23475157/0', 'LOPEZ JULIAN', 198533, 21890.13],   // Allianz: /0 se descarta
    ])

    return parseViva(buf).then(r => {
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.lineas).toHaveLength(2)
      expect(r.lineas[0]).toMatchObject({
        numero_poliza_raw: '108063',
        nombre_tomador: 'PALACIO JUAN',
        valor_prima: 2075618,
        valor_comision: 259452,
      })
      expect(r.lineas[1].numero_poliza_raw).toBe('23475157')  // sin /0
    })
  })
})

// ── 48 HORAS (XLSX) ─────────────────────────────────────────────────────
describe('parseCuarentaYOchoHoras', () => {
  it('usa VOUCHER como id, marca mapeo manual y toma TOTAL COMISION PESOS COP', () => {
    const buf = aoaToXlsxBuffer([
      ['Fecha', 'VOUCHER', 'Pasajero', 'Total COP', 'Monto Comision', 'TOTAL COMISION PESOS COP'],
      [46133, 'HD-DEFM7K', 'CESAR CARDENAS', 113630.94, 0.3, 34089.28],
    ])

    return parseCuarentaYOchoHoras(buf).then(r => {
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.lineas).toHaveLength(1)
      expect(r.lineas[0]).toMatchObject({
        numero_poliza_raw: 'HD-DEFM7K',
        nombre_tomador: 'CESAR CARDENAS',
        valor_prima: 113630.94,
        valor_comision: 34089.28,       // la columna TOTAL, no "Monto Comision"
        requiere_mapeo_manual: true,
      })
    })
  })
})
