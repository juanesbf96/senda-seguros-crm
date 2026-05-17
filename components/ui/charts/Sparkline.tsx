import { cn } from '@/lib/utils'

export interface SparklineProps {
  /** Array de valores numéricos. Mínimo 2 puntos. */
  data: number[]
  /** Ancho del SVG en px. Default 80. */
  width?: number
  /** Alto del SVG en px. Default 28. */
  height?: number
  /** Tono visual. Default 'primary'. */
  tone?: 'primary' | 'warning' | 'error' | 'neutral'
  /** Si true, dibuja también el área bajo la línea con opacidad. */
  area?: boolean
  /** Marca el último punto con un dot. */
  showLastDot?: boolean
  className?: string
  'aria-label'?: string
}

const TONES = {
  primary: { stroke: '#6FCF97', fill: 'rgba(111, 207, 151, 0.18)' },
  warning: { stroke: '#F2C94C', fill: 'rgba(242, 201, 76, 0.18)' },
  error:   { stroke: '#EB5757', fill: 'rgba(235, 87, 87, 0.18)' },
  neutral: { stroke: '#7C7C8A', fill: 'rgba(124, 124, 138, 0.15)' },
} as const

export function Sparkline({
  data,
  width = 80,
  height = 28,
  tone = 'primary',
  area = true,
  showLastDot = true,
  className,
  'aria-label': ariaLabel,
}: SparklineProps) {
  if (data.length < 2) {
    // Fallback: línea recta plana en el centro
    const y = height / 2
    return (
      <svg width={width} height={height} className={className} role="img" aria-label={ariaLabel ?? 'sin datos'}>
        <line x1={0} y1={y} x2={width} y2={y} stroke={TONES[tone].stroke} strokeOpacity={0.3} strokeWidth={1.5} strokeLinecap="round" strokeDasharray="2 3" />
      </svg>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2 // padding vertical para no cortar el stroke

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return [x, y] as const
  })

  const pathLine = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const pathArea = `${pathLine} L${width},${height} L0,${height} Z`
  const last = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={ariaLabel ?? `tendencia ${tone}`}
    >
      {area && <path d={pathArea} fill={TONES[tone].fill} />}
      <path d={pathLine} fill="none" stroke={TONES[tone].stroke} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {showLastDot && (
        <>
          <circle cx={last[0]} cy={last[1]} r={4} fill="white" />
          <circle cx={last[0]} cy={last[1]} r={2.5} fill={TONES[tone].stroke} />
        </>
      )}
    </svg>
  )
}
