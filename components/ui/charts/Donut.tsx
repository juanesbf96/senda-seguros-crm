import { cn } from '@/lib/utils'

export interface DonutSlice {
  label: string
  value: number
  /** Color CSS — usar tokens (ej: 'var(--color-primary-500)'). */
  color: string
}

export interface DonutProps {
  data: DonutSlice[]
  /** Tamaño total (ancho = alto). Default 160. */
  size?: number
  /** Grosor del anillo. Default 18. */
  thickness?: number
  /** Contenido custom para el centro (override del total). */
  centerLabel?: React.ReactNode
  /** Si true, muestra valor total en el centro. */
  showTotal?: boolean
  className?: string
}

export function Donut({
  data,
  size = 160,
  thickness = 18,
  centerLabel,
  showTotal = true,
  className,
}: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const cx = size / 2
  const cy = size / 2

  // Si total = 0, muestra anillo gris
  if (total === 0) {
    return (
      <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-cream-200)" strokeWidth={thickness} />
        </svg>
        {centerLabel ?? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-semibold text-ink-200 tabular-nums">0</p>
            <p className="text-[10px] text-ink-400 uppercase tracking-widest mt-0.5">total</p>
          </div>
        )}
      </div>
    )
  }

  // Calculamos offset acumulado para cada slice
  let cumulative = 0
  const slices = data.map(slice => {
    const fraction = slice.value / total
    const dash = fraction * circumference
    const gap = circumference - dash
    const offset = -cumulative * circumference
    cumulative += fraction
    return { ...slice, dash, gap, offset, pct: Math.round(fraction * 100) }
  })

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--color-cream-100)" strokeWidth={thickness} />
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={s.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>

      {centerLabel ?? (showTotal && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-semibold text-ink-700 tabular-nums leading-none">{total}</p>
          <p className="text-[10px] text-ink-400 uppercase tracking-widest mt-1">total</p>
        </div>
      ))}
    </div>
  )
}

/** Leyenda asociada al Donut. */
export function DonutLegend({ data, className }: { data: DonutSlice[]; className?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <ul className={cn('space-y-2', className)}>
      {data.map((d, i) => {
        const pct = Math.round((d.value / total) * 100)
        return (
          <li key={i} className="flex items-center gap-2.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="flex-1 text-ink-600 truncate">{d.label}</span>
            <span className="text-ink-400 tabular-nums">{pct}%</span>
            <span className="text-ink-700 font-semibold tabular-nums w-8 text-right">{d.value}</span>
          </li>
        )
      })}
    </ul>
  )
}
