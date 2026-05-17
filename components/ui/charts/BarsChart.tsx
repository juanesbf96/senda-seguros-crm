'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'

export interface BarsDatum {
  label: string
  value: number
  /** Tono opcional para destacar barras específicas. */
  tone?: 'primary' | 'warning' | 'error' | 'muted'
}

export interface BarsChartProps {
  data: BarsDatum[]
  height?: number
  /** Formatea el valor para tooltip. */
  formatValue?: (n: number) => string
  /** Label del valor en tooltip. */
  valueLabel?: string
}

const TONE_COLOR = {
  primary: '#6FCF97',
  warning: '#F2C94C',
  error:   '#EB5757',
  muted:   '#D8D8DE',
} as const

export function BarsChart({
  data,
  height = 180,
  formatValue,
  valueLabel = 'Valor',
}: BarsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
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
          width={36}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(244, 241, 234, 0.6)' }}
          contentStyle={{
            background: 'white',
            border: '1px solid #ECECEF',
            borderRadius: 14,
            boxShadow: '0 8px 24px rgba(20,20,30,0.08)',
            fontSize: 12,
            padding: '8px 12px',
          }}
          labelStyle={{ color: '#1F1F26', fontWeight: 600, marginBottom: 4 }}
          formatter={(value) => [
            formatValue ? formatValue(Number(value)) : value,
            valueLabel,
          ]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {data.map((entry, i) => (
            <Cell key={i} fill={TONE_COLOR[entry.tone ?? 'primary']} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
