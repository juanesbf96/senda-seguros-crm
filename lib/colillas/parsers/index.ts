import { parseSura }               from './sura'
import { parseAxa }                from './axa'
import { parseExpertos }           from './expertos'
import { parseQualitas }           from './qualitas'
import { parseBolivar }            from './bolivar'
import { parseSbs }                from './sbs'
import { parseViva }               from './viva'
import { parseCuarentaYOchoHoras } from './cuarenta_y_ocho_horas'
import type { ParseResult }        from './types'

export const ASEGURADORAS_DISPONIBLES = [
  'SURA',
  'AXA',
  'EXPERTOS',
  'QUÁLITAS',
  'BOLÍVAR',
  'SBS',
  'VIVA',
  '48 HORAS',
] as const

export type AseguradoraKey = typeof ASEGURADORAS_DISPONIBLES[number]

/** Decodifica un ArrayBuffer con encoding latin-1 (necesario para CSV de SURA) */
function decodeLatinBuffer(buffer: ArrayBuffer): string {
  return new TextDecoder('latin1').decode(buffer)
}

export async function parsearColilla(
  aseguradora: AseguradoraKey,
  buffer: ArrayBuffer,
): Promise<ParseResult> {
  switch (aseguradora) {
    case 'SURA':      return parseSura(decodeLatinBuffer(buffer))
    case 'AXA':       return parseAxa(buffer)
    case 'EXPERTOS':  return parseExpertos(buffer)
    case 'QUÁLITAS':  return parseQualitas(buffer)
    case 'BOLÍVAR':   return parseBolivar(buffer)
    case 'SBS':       return parseSbs(buffer)
    case 'VIVA':      return parseViva(buffer)
    case '48 HORAS':  return parseCuarentaYOchoHoras(buffer)
    default:
      return { ok: false, error: `Aseguradora no soportada` }
  }
}

export type { ColillaLineaRaw, ParseResult } from './types'
