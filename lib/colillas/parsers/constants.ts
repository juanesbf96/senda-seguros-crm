/**
 * Constantes y tipos de aseguradoras soportadas.
 *
 * IMPORTANTE: este archivo no debe importar ningún parser (axa.ts, bolivar.ts,
 * qualitas.ts, etc.), ya que esos usan `pdf-parse`/`xlsx` (dependencias solo
 * de servidor, con require de `fs`). Los componentes cliente deben importar
 * ASEGURADORAS_DISPONIBLES/AseguradoraKey desde aquí, nunca desde './index',
 * para evitar que Turbopack intente incluir esas dependencias en el bundle
 * del navegador.
 */
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
