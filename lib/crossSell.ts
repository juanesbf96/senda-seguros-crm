// Etiquetas y textos de las familias de ramo usadas en cross-sell (fase 4.2).
// Compartido entre la API (prompt de IA) y la UI (chips/labels).

import { PrioridadOportunidad } from '@/types'

// Nombre legible del seguro por familia (para mensajes y UI).
export const FAMILIA_SEGURO: Record<string, string> = {
  AUTOS:        'seguro de automóvil',
  VIDA:         'seguro de vida',
  SALUD:        'seguro de salud',
  HOGAR:        'seguro de hogar',
  CUMPLIMIENTO: 'póliza de cumplimiento',
  RC:           'seguro de responsabilidad civil',
  EMPRESARIAL:  'seguro empresarial',
  TRANSPORTE:   'seguro de transporte',
  ACCIDENTES:   'seguro de accidentes personales',
  OTRO:         'seguro',
}

// Etiqueta corta para chips.
export const FAMILIA_CORTA: Record<string, string> = {
  AUTOS: 'Autos', VIDA: 'Vida', SALUD: 'Salud', HOGAR: 'Hogar',
  CUMPLIMIENTO: 'Cumplimiento', RC: 'RC', EMPRESARIAL: 'Empresarial',
  TRANSPORTE: 'Transporte', ACCIDENTES: 'Accidentes', OTRO: 'Otro',
}

export function familiaSeguro(f: string): string {
  return FAMILIA_SEGURO[f] || `seguro de ${f.toLowerCase()}`
}
export function familiaCorta(f: string): string {
  return FAMILIA_CORTA[f] || f
}

export const PRIORIDAD_STYLE: Record<PrioridadOportunidad, string> = {
  alta:  'bg-error-soft text-error',
  media: 'bg-warning-soft text-ink-700',
  baja:  'bg-cream-200 text-ink-500',
}
