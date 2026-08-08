/**
 * Estado que se le muestra al usuario para una póliza.
 *
 * Desde la fase 6 la UI dejó de confiar en la columna `estado` para decidir si
 * una póliza está vigente, porque quedaba obsoleta: nadie la actualiza el día
 * que la póliza vence. Calcularlo desde `fecha_fin` fue lo correcto para eso.
 *
 * El problema es que ese cálculo pasó a mandar SIEMPRE, y se llevó por delante
 * los estados que fija una persona a propósito. Una póliza cancelada con
 * vigencia todavía futura se seguía mostrando como "Activa" — que es
 * precisamente el caso en que cancelar importa (nadie cancela una vencida).
 *
 * La regla correcta separa las dos cosas:
 *  - `cancelada` y `pendiente` los declara un humano → mandan sobre la fecha.
 *  - `activa` vs `vencida` es una consecuencia del calendario → se calcula.
 */
import type { EstadoPoliza } from '@/types'

export interface PolizaEstadoInput {
  estado?: EstadoPoliza | null
  fecha_fin?: string | null
}

/** Estados declarados por una persona; el calendario no los puede contradecir. */
const ESTADOS_EXPLICITOS: EstadoPoliza[] = ['cancelada', 'pendiente']

export function estadoEfectivo(
  poliza: PolizaEstadoInput,
  hoy: string = new Date().toISOString().slice(0, 10),
): EstadoPoliza {
  if (poliza.estado && ESTADOS_EXPLICITOS.includes(poliza.estado)) return poliza.estado
  if (poliza.fecha_fin) return poliza.fecha_fin >= hoy ? 'activa' : 'vencida'
  return poliza.estado ?? 'activa'
}

/** Atajo para conteos y filtros de "cartera vigente". */
export function esVigente(poliza: PolizaEstadoInput, hoy?: string): boolean {
  return estadoEfectivo(poliza, hoy) === 'activa'
}

export const ESTADO_LABELS: Record<EstadoPoliza, string> = {
  activa:    'Activa',
  vencida:   'Vencida',
  cancelada: 'Cancelada',
  pendiente: 'Pendiente',
}
