import { differenceInDays } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Formatea una fecha para mostrar.
 *
 * Acepta dos formas, porque en el CRM conviven ambas:
 *  - fecha sola `'YYYY-MM-DD'` (columnas `date`: vigencias, compromisos de pago).
 *    Se le ancla la hora local para que no se corra un día por zona horaria.
 *  - timestamp ISO completo (`created_at` y demás columnas `timestamptz`).
 *    Concatenarle 'T00:00:00' producía `Invalid Date` en pantalla — es lo que
 *    se veía en la cronología, en la ficha del cliente y en la lista de colillas.
 *
 * Ante un valor no parseable devuelve '—' en vez de "Invalid Date": un guion es
 * información honesta ("no hay fecha"), el texto crudo del motor no lo es.
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = dateStr.length > 10 ? new Date(dateStr) : new Date(dateStr + 'T00:00:00')
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return differenceInDays(target, today)
}
