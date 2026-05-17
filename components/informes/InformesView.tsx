'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from 'recharts'
import {
  DollarSign, FileText, Users, TrendingUp,
  AlertTriangle, CheckCircle, Clock,
} from 'lucide-react'

type Periodo = '30d' | '3m' | '6m' | '1a'

const PERIODO_LABELS: Record<Periodo, string> = {
  '30d': 'Últimos 30 días',
  '3m':  'Últimos 3 meses',
  '6m':  'Últimos 6 meses',
  '1a':  'Este año',
}

const RAMO_COLORS = ['#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444','#14b8a6','#ec4899','#64748b']

function MetricCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string; icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white border border-ink-200 rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-400 mb-1">{label}</p>
          <p className="text-2xl font-bold text-ink-700">{value}</p>
          {sub && <p className="text-xs text-ink-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

export default function InformesView() {
  const [periodo, setPeriodo] = useState<Periodo>('3m')
  const [loading, setLoading] = useState(true)

  // Data states
  const [metricas, setMetricas] = useState({
    totalPrimas: 0, totalComision: 0, polizasActivas: 0, cobrosPendientes: 0,
    cobrosVencidos: 0, totalClientes: 0, prospectosPipeline: 0,
  })
  const [primasPorMes, setPrimasPorMes]       = useState<{ mes: string; primas: number }[]>([])
  const [cobrosPorEstado, setCobrosPorEstado] = useState<{ name: string; value: number; color: string }[]>([])
  const [polizasPorRamo, setPolizasPorRamo]   = useState<{ ramo: string; total: number }[]>([])
  const [prospectosPorEtapa, setProspectosPorEtapa] = useState<{ etapa: string; total: number }[]>([])
  const [comisionesPorVendedor, setComisionesPorVendedor] = useState<{ nombre: string; comision: number }[]>([])

  function getDateFrom(p: Periodo): Date {
    const now = new Date()
    if (p === '30d') return new Date(now.getTime() - 30 * 86400000)
    if (p === '3m')  return new Date(now.getFullYear(), now.getMonth() - 3, 1)
    if (p === '6m')  return new Date(now.getFullYear(), now.getMonth() - 6, 1)
    return new Date(now.getFullYear(), 0, 1) // inicio del año
  }

  async function load() {
    setLoading(true)
    const from = getDateFrom(periodo).toISOString()

    const [polizasRes, cobrosRes, clientesRes, prospectosRes, liquidacionesRes] = await Promise.all([
      supabase.from('polizas')
        .select('id, prima, prima_neta, comision_agencia, comision_vendedor, ramo, estado, fecha_inicio, created_at, vendedor:vendedores(nombre)')
        .eq('eliminada', false),
      supabase.from('cobros').select('id, valor, estado, created_at'),
      supabase.from('clientes').select('id, created_at'),
      supabase.from('prospectos').select('id, etapa'),
      supabase.from('liquidaciones')
        .select('total_primas, total_comision, periodo, vendedor:vendedores(nombre)')
        .gte('created_at', from),
    ])

    const polizas    = polizasRes.data    || []
    const cobros     = cobrosRes.data     || []
    const clientes   = clientesRes.data   || []
    const prospectos = prospectosRes.data || []
    const liquidaciones = liquidacionesRes.data || []

    // ── Métricas generales ─────────────────────────────────────
    const polizasActivas = polizas.filter(p => p.estado === 'activa')
    setMetricas({
      totalPrimas:       polizasActivas.reduce((s, p) => s + ((p as any).prima_neta || p.prima || 0), 0),
      totalComision:     polizasActivas.reduce((s, p) => s + ((p as any).comision_agencia || 0), 0),
      polizasActivas:    polizasActivas.length,
      cobrosPendientes:  cobros.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.valor, 0),
      cobrosVencidos:    cobros.filter(c => c.estado === 'vencido').reduce((s, c) => s + c.valor, 0),
      totalClientes:     clientes.length,
      prospectosPipeline: prospectos.filter(p => !['cerrado_ganado','cerrado_perdido'].includes(p.etapa)).length,
    })

    // ── Primas por mes (últimos 6 meses) ─────────────────────────
    const meses: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      meses[key] = 0
    }
    polizas.forEach(p => {
      const valor = p.prima_neta || p.prima
      if (!p.fecha_inicio || !valor) return
      const key = p.fecha_inicio.slice(0, 7)
      if (key in meses) meses[key] += valor
    })
    setPrimasPorMes(Object.entries(meses).map(([mes, primas]) => ({
      mes: new Date(mes + '-01').toLocaleString('es-CO', { month: 'short', year: '2-digit' }),
      primas,
    })))

    // ── Cobros por estado ─────────────────────────────────────────
    setCobrosPorEstado([
      { name: 'Pendiente', value: cobros.filter(c => c.estado === 'pendiente').reduce((s,c) => s+c.valor,0), color: '#f59e0b' },
      { name: 'Pagado',    value: cobros.filter(c => c.estado === 'pagado').reduce((s,c) => s+c.valor,0),    color: '#10b981' },
      { name: 'Vencido',   value: cobros.filter(c => c.estado === 'vencido').reduce((s,c) => s+c.valor,0),   color: '#ef4444' },
      { name: 'Anulado',   value: cobros.filter(c => c.estado === 'anulado').reduce((s,c) => s+c.valor,0),   color: '#94a3b8' },
    ].filter(c => c.value > 0))

    // ── Pólizas por ramo ──────────────────────────────────────────
    const byRamo: Record<string, number> = {}
    polizas.forEach(p => { byRamo[p.ramo] = (byRamo[p.ramo] || 0) + 1 })
    setPolizasPorRamo(
      Object.entries(byRamo)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([ramo, total]) => ({ ramo, total }))
    )

    // ── Prospectos por etapa ──────────────────────────────────────
    const ETAPA_LABELS: Record<string, string> = {
      nuevo: 'Nuevo', contactado: 'Contactado', calificado: 'Calificado',
      propuesta: 'Propuesta', cerrado_ganado: 'Ganado', cerrado_perdido: 'Perdido',
    }
    const byEtapa: Record<string, number> = {}
    prospectos.forEach(p => { byEtapa[p.etapa] = (byEtapa[p.etapa] || 0) + 1 })
    setProspectosPorEtapa(
      Object.entries(byEtapa).map(([etapa, total]) => ({ etapa: ETAPA_LABELS[etapa] || etapa, total }))
    )

    // ── Comisiones por vendedor (desde pólizas activas + liquidaciones) ──
    const byVendedor: Record<string, number> = {}
    // Primero desde polizas.comision_vendedor (Sprint A data)
    polizas.filter((p: any) => p.estado === 'activa' && p.comision_vendedor && p.vendedor?.nombre)
      .forEach((p: any) => {
        const nombre = p.vendedor.nombre
        byVendedor[nombre] = (byVendedor[nombre] || 0) + (p.comision_vendedor || 0)
      })
    // Si no hay datos en pólizas, usar liquidaciones históricas
    if (Object.keys(byVendedor).length === 0) {
      liquidaciones.forEach((l: any) => {
        const nombre = l.vendedor?.nombre || 'Sin nombre'
        byVendedor[nombre] = (byVendedor[nombre] || 0) + (l.total_comision || 0)
      })
    }
    setComisionesPorVendedor(
      Object.entries(byVendedor)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, comision]) => ({ nombre, comision }))
    )

    setLoading(false)
  }

  useEffect(() => { load() }, [periodo])

  const formatTooltipCOP = (v: unknown) => formatCOP(Number(v) || 0)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Informes</h1>
          <p className="text-ink-400 text-sm mt-1">Resumen de actividad y métricas clave</p>
        </div>
        <div className="flex border border-ink-200 rounded-lg overflow-hidden">
          {(Object.entries(PERIODO_LABELS) as [Periodo, string][]).map(([k, v]) => (
            <button key={k} onClick={() => setPeriodo(k)}
              className={`px-3 py-1.5 text-sm transition-colors ${periodo === k ? 'bg-primary-500 text-white' : 'text-ink-400 hover:bg-cream-100'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Prima neta activa" value={formatCOP(metricas.totalPrimas)}
          icon={DollarSign} color="bg-primary-100 text-primary-500" />
        <MetricCard label="Comisión agencia" value={formatCOP(metricas.totalComision)}
          icon={TrendingUp} color="bg-info/20 text-info" />
        <MetricCard label="Pólizas activas" value={String(metricas.polizasActivas)}
          icon={FileText} color="bg-violet-100 text-violet-600" />
        <MetricCard label="Cobros pendientes" value={formatCOP(metricas.cobrosPendientes)}
          icon={Clock} color="bg-warning-soft text-ink-700" />
        <MetricCard label="Cobros vencidos" value={formatCOP(metricas.cobrosVencidos)}
          icon={AlertTriangle} color="bg-error-soft text-error" />
        <MetricCard label="Clientes" value={String(metricas.totalClientes)}
          icon={Users} color="bg-teal-100 text-teal-600" />
      </div>

      {/* Gráficas fila 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Primas por mes */}
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <h3 className="font-semibold text-ink-700 mb-4">Primas por mes</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={primasPorMes} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v/1000000).toFixed(0)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={formatTooltipCOP} />
              <Bar dataKey="primas" fill="#10b981" radius={[4,4,0,0]} name="Prima" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cobros por estado */}
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <h3 className="font-semibold text-ink-700 mb-4">Cobros por estado</h3>
          {cobrosPorEstado.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={cobrosPorEstado} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: any) => `${name ?? ''} ${(((percent as number)||0)*100).toFixed(0)}%`}
                  labelLine={false}>
                  {cobrosPorEstado.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={formatTooltipCOP} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-ink-400 text-sm">Sin datos</div>
          )}
        </div>
      </div>

      {/* Gráficas fila 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pólizas por ramo */}
        <div className="bg-white border border-ink-200 rounded-xl p-5 lg:col-span-2">
          <h3 className="font-semibold text-ink-700 mb-4">Pólizas por ramo</h3>
          {polizasPorRamo.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={polizasPorRamo} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="ramo" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="total" radius={[0,4,4,0]} name="Pólizas">
                  {polizasPorRamo.map((_, i) => (
                    <Cell key={i} fill={RAMO_COLORS[i % RAMO_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-ink-400 text-sm">Sin datos</div>
          )}
        </div>

        {/* Prospectos por etapa */}
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <h3 className="font-semibold text-ink-700 mb-4">Prospectos por etapa</h3>
          {prospectosPorEtapa.length > 0 ? (
            <div className="space-y-2">
              {prospectosPorEtapa.map((p, i) => (
                <div key={p.etapa} className="flex items-center gap-2">
                  <span className="text-xs text-ink-400 w-20 truncate">{p.etapa}</span>
                  <div className="flex-1 bg-cream-200 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all"
                      style={{
                        width: `${(p.total / Math.max(...prospectosPorEtapa.map(x => x.total))) * 100}%`,
                        background: RAMO_COLORS[i % RAMO_COLORS.length],
                      }} />
                  </div>
                  <span className="text-xs font-semibold text-ink-600 w-4 text-right">{p.total}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[180px] text-ink-400 text-sm">Sin datos</div>
          )}
        </div>
      </div>

      {/* Comisiones por vendedor */}
      {comisionesPorVendedor.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-xl p-5">
          <h3 className="font-semibold text-ink-700 mb-4">Comisiones por vendedor</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={comisionesPorVendedor} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={formatTooltipCOP} />
              <Bar dataKey="comision" fill="#8b5cf6" radius={[4,4,0,0]} name="Comisión" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  )
}
