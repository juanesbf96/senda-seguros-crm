'use client'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

export interface TrendDatum {
  label: string
  value: number
  /** Opcional: segundo valor para comparativa (ej: comisión vs prima). */
  secondary?: number
}

export interface TrendChartProps {
  data: TrendDatum[]
  height?: number
  /** Formatea el valor para tooltip y axis (ej: formatCOP). */
  formatValue?: (n: number) => string
  /** Label del valor primario en tooltip. */
  primaryLabel?: string
  /** Label del valor secundario en tooltip. */
  secondaryLabel?: string
}

export function TrendChart({
  data,
  height = 200,
  formatValue,
  primaryLabel = 'Valor',
  secondaryLabel = 'Comisión',
}: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6FCF97" stopOpacity={0.30} />
            <stop offset="100%" stopColor="#6FCF97" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="trendSecondary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#56A8E0" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#56A8E0" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="#F4F1EA" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#7C7C8A', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fill: '#7C7C8A', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={50}
          tickFormatter={formatValue ?? ((n: number) => n.toString())}
        />
        <Tooltip
          cursor={{ stroke: '#D8D8DE', strokeWidth: 1, strokeDasharray: '3 3' }}
          contentStyle={{
            background: 'white',
            border: '1px solid #ECECEF',
            borderRadius: 14,
            boxShadow: '0 8px 24px rgba(20,20,30,0.08)',
            fontSize: 12,
            padding: '8px 12px',
          }}
          labelStyle={{ color: '#1F1F26', fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number, name: string) => [
            formatValue ? formatValue(value) : value,
            name,
          ]}
        />

        {data.some(d => d.secondary !== undefined) && (
          <Area
            type="monotone"
            dataKey="secondary"
            name={secondaryLabel}
            stroke="#56A8E0"
            strokeWidth={2}
            fill="url(#trendSecondary)"
            dot={false}
            activeDot={{ r: 4, fill: '#56A8E0', stroke: 'white', strokeWidth: 2 }}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          name={primaryLabel}
          stroke="#6FCF97"
          strokeWidth={2.5}
          fill="url(#trendPrimary)"
          dot={false}
          activeDot={{ r: 5, fill: '#6FCF97', stroke: 'white', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
