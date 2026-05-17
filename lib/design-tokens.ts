/**
 * Design Tokens — Senda Seguros CRM
 *
 * Fuente de verdad para colores, radios, sombras, tipografía y espaciado.
 * Los valores aquí deben coincidir 1:1 con los definidos en `app/globals.css`
 * dentro del bloque `@theme`.
 *
 * Uso:
 *  - En Tailwind (recomendado): `bg-primary-500`, `text-ink-700`, `rounded-2xl`
 *  - En JS/estilos dinámicos:   `import { colors } from '@/lib/design-tokens'`
 */

export const colors = {
  primary: {
    50:  '#E8F7EF',
    100: '#C8EBD6',
    200: '#A5DDBC',
    300: '#8AD4AA',
    400: '#7DD0A0',
    500: '#6FCF97', // ← marca
    600: '#56B87E',
    700: '#3D9F65',
    800: '#2A7F4D',
    900: '#1B5F37',
  },
  semantic: {
    success:     '#6FCF97',
    warning:     '#F2C94C',
    warningSoft: '#FCE9A8',
    error:       '#EB5757',
    errorSoft:   '#FBC8C8',
    info:        '#56A8E0',
  },
  cream: {
    50:  '#FEFDFB',
    100: '#FBF9F5',
    200: '#F4F1EA',
    300: '#E8E2D4',
    400: '#C9BC9F',
  },
  ink: {
    50:  '#F7F7F8',
    100: '#ECECEF',
    200: '#D8D8DE',
    300: '#B0B0BA',
    400: '#7C7C8A',
    500: '#4F4F5A',
    600: '#2F2F38',
    700: '#1F1F26',
    800: '#131318',
    900: '#0A0A0E',
  },
  surface: {
    base:       '#FFFFFF',
    background: '#FBF9F5',
    foreground: '#1F1F26',
    muted:      '#7C7C8A',
    border:     '#ECECEF',
  },
} as const

export const radius = {
  xs:   '6px',
  sm:   '10px',
  md:   '14px',
  lg:   '20px',
  xl:   '28px',
  '2xl':'36px',
  pill: '999px',
} as const

export const shadows = {
  soft:   '0 1px 2px rgba(20, 20, 30, 0.04), 0 2px 6px rgba(20, 20, 30, 0.04)',
  card:   '0 2px 6px rgba(20, 20, 30, 0.04), 0 8px 24px rgba(20, 20, 30, 0.06)',
  lifted: '0 10px 30px rgba(20, 20, 30, 0.10), 0 20px 60px rgba(20, 20, 30, 0.08)',
  glass:  '0 8px 32px rgba(20, 20, 30, 0.12)',
} as const

export const typography = {
  fontFamily: {
    sans:    'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif',
  },
  size: {
    xs:   '0.75rem',
    sm:   '0.875rem',
    base: '1rem',
    lg:   '1.125rem',
    xl:   '1.25rem',
    '2xl':'1.5rem',
    '3xl':'1.875rem',
    '4xl':'2.25rem',
    '5xl':'3rem',
    '6xl':'3.75rem',
  },
} as const

/**
 * Mapeo semántico para badges, alerts, status indicators.
 * Una sola fuente para decidir qué color usar según contexto.
 */
export const statusTones = {
  /** Estados positivos: activo, completado, al día */
  positive: { bg: 'bg-primary-100', text: 'text-primary-800', icon: 'text-primary-700' },
  /** Estados de atención: pendiente, próximo a vencer */
  warning:  { bg: 'bg-warning-soft', text: 'text-ink-700', icon: 'text-ink-700' },
  /** Estados críticos: vencido, urgente, error */
  danger:   { bg: 'bg-error-soft', text: 'text-error', icon: 'text-error' },
  /** Estados neutros/inactivos */
  neutral:  { bg: 'bg-cream-200', text: 'text-ink-600', icon: 'text-ink-500' },
  /** Sin valor / placeholder */
  muted:    { bg: 'bg-cream-100', text: 'text-ink-400', icon: 'text-ink-300' },
} as const

export type StatusTone = keyof typeof statusTones

/**
 * Variantes de Card unificadas para uso consistente.
 */
export const cardVariants = {
  base:    'bg-white border border-cream-200/80 rounded-2xl',
  soft:    'bg-white border border-cream-200/80 rounded-2xl shadow-soft',
  raised:  'bg-white border border-cream-200/80 rounded-2xl shadow-card',
  glass:   'glass rounded-2xl',
  cream:   'bg-cream-50 border border-cream-200 rounded-2xl',
  dark:    'bg-ink-700 text-white rounded-2xl',
  hover:   'hover:shadow-card hover:-translate-y-0.5 transition-all duration-200',
} as const
