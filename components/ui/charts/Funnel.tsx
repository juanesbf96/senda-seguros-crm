import { cn } from '@/lib/utils'

export interface FunnelStage {
  label: string
  value: number
  color: string
}

export interface FunnelProps {
  data: FunnelStage[]
  className?: string
}

/**
 * Funnel horizontal con barras decrecientes que muestran conversión entre etapas.
 * Cada barra es proporcional al valor del primer stage (top of funnel).
 */
export function Funnel({ data, className }: FunnelProps) {
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className={cn('space-y-2', className)}>
      {data.map((stage, i) => {
        const pct = (stage.value / max) * 100
        const prevValue = i > 0 ? data[i - 1].value : stage.value
        const conversion = prevValue > 0 ? Math.round((stage.value / prevValue) * 100) : 0

        return (
          <div key={stage.label} className="relative">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-medium text-ink-600 w-24 flex-shrink-0">{stage.label}</span>
              <span className="text-sm font-semibold text-ink-700 tabular-nums">{stage.value}</span>
              {i > 0 && (
                <span className="text-[10px] text-ink-400 tabular-nums ml-auto">
                  {conversion}% conversión
                </span>
              )}
            </div>
            <div className="h-6 bg-cream-100 rounded-md overflow-hidden">
              <div
                className="h-full rounded-md transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: stage.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
