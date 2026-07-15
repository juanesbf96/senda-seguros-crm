'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { Cliente, Etapa } from '@/types'
import { formatCOP, cn } from '@/lib/utils'
import Link from 'next/link'
import {
  ArrowUpRight, Cake, ShieldAlert, CheckSquare,
  RefreshCw, FileText, Banknote, Percent, Loader2, TrendingUp, TrendingDown,
  ClipboardList, Users, Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import {
  Sparkline, Donut, DonutLegend, TrendChart, BarsChart,
  type DonutSlice, type TrendDatum, type BarsDatum,
} from '@/components/ui/charts'

const ETAPA_LABELS: Record<Etapa, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizacion: 'Cotización', cerrado: 'Cerrado',
}

const ETAPA_COLORS: Record<Etapa, 'primary' | 'warning' | 'neutral' | 'outline'> = {
  nuevo: 'neutral', contactado: 'warning', cotizacion: 'outline', cerrado: 'primary',
}

const MONTH_LABELS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Paleta para slices de donut */
const RAMO_COLORS = [
  'var(--color-primary-500)',
  'var(--color-primary-300)',
  'var(--color-warning)',
  'var(--color-info)',
  'var(--color-ink-400)',
  'var(--color-primary-700)',
  'var(--color-cream-400)',
]

const ASEG_COLORS = [
  'var(--color-info)',
  'var(--color-primary-500)',
  'var(--color-warning)',
  'var(--color-primary-300)',
  'var(--color-ink-500)',
  'var(--color-error)',
  'var(--color-cream-400)',
]

/** Estados de póliza para distribución dentro de "Pólizas activas" */
const ESTADO_COLOR: Record<string, string> = {
  activa:     'bg-primary-500',
  pendiente:  'bg-info',
  vencida:    'bg-error',
  cancelada:  'bg-ink-300',
}

const ESTADO_LABEL: Record<string, string> = {
  activa:    'Activas',
  pendiente: 'En expedición',
  vencida:   'Vencidas',
  cancelada: 'Canceladas',
}

export default function Dashboard() {
  const { currentWorkspace, currentUserId, isAdmin, isSupervisor, loading: wsLoading } = useWorkspace()
  const { can } = usePermissions()
  const isGlobal = isAdmin || isSupervisor
  const [userName, setUserName] = useState('')

  // Métricas agregadas del RPC get_dashboard_metrics — reemplaza las ~20
  // queries que traían filas al navegador solo para contar/sumar en JS.
  interface DashMetrics {
    clientes_total: number
    clientes_por_etapa: Record<string, number>
    clientes_recientes: Pick<Cliente, 'id' | 'nombre' | 'ciudad' | 'etapa' | 'categoria' | 'telefono'>[]
    cumpleanos: { id: string; nombre: string; fecha_nacimiento: string }[]
    polizas_activas: number
    polizas_total: number
    polizas_por_estado: Record<string, number>
    prima_total: number
    comision_total: number
    renov_30: number
    renov_60: number
    renov_buckets: number[]
    cartera_ramo: { label: string; value: number }[]
    cartera_aseguradora: { label: string; value: number }[]
    trend: { mes: number; prima: number; comision: number }[]
    spark_clientes: number[]
    spark_polizas: number[]
    mes: { polizas: number; prima: number; comision: number }
    mes_pasado: { polizas: number; prima: number; comision: number }
    clientes_mes: number
    clientes_mes_pasado: number
    produccion_asesores: { id: string; nombre: string; count: number; prima: number; comision: number }[]
  }
  const [m, setM] = useState<DashMetrics | null>(null)
  const [siniestrosPendientes, setSiniestrosPendientes] = useState(0)
  const [tareasHoy,     setTareasHoy]     = useState(0)
  const [tareasVencidas,setTareasVencidas]= useState(0)
  const [tareasMañana,  setTareasMañana]  = useState(0)
  const [cobrosPendiente, setCobrosPendiente] = useState(0)
  const [cobrosVencido,   setCobrosVencido]   = useState(0)
  const [liqPendiente,    setLiqPendiente]    = useState(0)
  const [solNuevas,    setSolNuevas]    = useState(0)
  const [solUrgentes,  setSolUrgentes]  = useState(0)
  const [solActivas,   setSolActivas]   = useState(0)
  const [solPorVencer, setSolPorVencer] = useState(0)
  const [metasActivas,  setMetasActivas]  = useState(0)
  const [metasProgress, setMetasProgress] = useState(0)
  const [metasCumplidas,setMetasCumplidas]= useState(0)
  const [loading, setLoading] = useState(true)

  // Datos para charts
  const [trendData,        setTrendData]        = useState<TrendDatum[]>([])
  const [renovacionesData, setRenovacionesData] = useState<BarsDatum[]>([])
  const [clientesSpark,    setClientesSpark]    = useState<number[]>([])
  const [polizasSpark,     setPolizasSpark]     = useState<number[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata || {}
      const name = meta.nombre || meta.full_name || meta.name || ''
      setUserName(name)
    })
  }, [])

  useEffect(() => {
    if (!currentWorkspace) return
    setLoading(true)
    async function load() {
      const wsId = currentWorkspace!.id
      const uid  = currentUserId

      // Un solo RPC con todos los agregados calculados en Postgres
      // (ver supabase/migration_dashboard_metrics.sql)
      const { data, error } = await supabase.rpc('get_dashboard_metrics', {
        p_ws:  wsId,
        p_uid: !isGlobal && uid ? uid : null,
      })
      if (error || !data) {
        console.error('Dashboard: error cargando métricas', error)
        setLoading(false)
        return
      }

      const dm = data as DashMetrics & { tareas_vencidas: number; tareas_hoy: number; tareas_manana: number;
        siniestros_pendientes: number; cobros_pendiente: number; cobros_vencido: number; liq_pendiente: number;
        sol_nuevas: number; sol_urgentes: number; sol_activas: number; sol_por_vencer: number;
        metas_activas: number; metas_progreso: number; metas_cumplidas: number }

      setM(dm)
      setSiniestrosPendientes(dm.siniestros_pendientes)
      setTareasVencidas(dm.tareas_vencidas)
      setTareasHoy(dm.tareas_hoy)
      setTareasMañana(dm.tareas_manana)
      setCobrosPendiente(dm.cobros_pendiente)
      setCobrosVencido(dm.cobros_vencido)
      setLiqPendiente(dm.liq_pendiente)
      setSolNuevas(dm.sol_nuevas)
      setSolUrgentes(dm.sol_urgentes)
      setSolActivas(dm.sol_activas)
      setSolPorVencer(dm.sol_por_vencer)
      setMetasActivas(dm.metas_activas)
      setMetasProgress(dm.metas_progreso)
      setMetasCumplidas(dm.metas_cumplidas)

      // Tendencia 12 meses
      setTrendData(dm.trend.map(t => ({
        label: MONTH_LABELS_ES[t.mes - 1],
        value: t.prima,
        secondary: t.comision,
      })))

      // Renovaciones por bloque de 15 días
      const bucketLabels = ['0-15d', '16-30d', '31-45d', '46-60d', '61-75d', '76-90d']
      setRenovacionesData(bucketLabels.map((label, i) => ({
        label,
        value: dm.renov_buckets[i] ?? 0,
        tone: i === 0 ? 'error' : i === 1 ? 'warning' : 'primary',
      })))

      // Sparklines últimos 30 días
      setClientesSpark(dm.spark_clientes)
      setPolizasSpark(dm.spark_polizas)

      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id])

  
  // ── Valores derivados de las métricas del RPC ────────────────────
  const carteraRamo: DonutSlice[] = useMemo(() =>
    (m?.cartera_ramo ?? []).map((s, i) => ({
      label: s.label, value: s.value, color: RAMO_COLORS[i % RAMO_COLORS.length],
    })), [m])

  const carteraAseguradora: DonutSlice[] = useMemo(() =>
    (m?.cartera_aseguradora ?? []).map((s, i) => ({
      label: s.label, value: s.value, color: ASEG_COLORS[i % ASEG_COLORS.length],
    })), [m])

  const estadosDist = useMemo(() => {
    const porEstado = m?.polizas_por_estado ?? {}
    return ['activa', 'pendiente', 'vencida', 'cancelada']
      .map(estado => ({ estado, count: porEstado[estado] || 0 }))
      .filter(s => s.count > 0)
  }, [m])

  const mesPolizas        = m?.mes.polizas ?? 0
  const mesComision       = m?.mes.comision ?? 0
  const mesPasadoPolizas  = m?.mes_pasado.polizas ?? 0
  const primaMes          = m?.mes.prima ?? 0
  const primaMesPasado    = m?.mes_pasado.prima ?? 0
  const clientesMes       = m?.clientes_mes ?? 0
  const clientesMesPasado = m?.clientes_mes_pasado ?? 0

  const produccionAsesores = isGlobal ? (m?.produccion_asesores ?? []) : []

  const porEtapa = (e: Etapa) => m?.clientes_por_etapa[e] ?? 0
  const polizasActivas    = m?.polizas_activas ?? 0
  const primaTotal        = m?.prima_total ?? 0
  const comisionTotal     = m?.comision_total ?? 0
  const renovaciones30    = m?.renov_30 ?? 0
  const renovaciones60    = m?.renov_60 ?? 0
  const totalRenovaciones90 = renovaciones30 + renovaciones60
  const totalPolizas      = m?.polizas_total ?? 0
  const cumpleaños        = m?.cumpleanos ?? []
  const clientesRecientes = m?.clientes_recientes ?? []

  if (wsLoading || loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
    </div>
  )

  if (!currentWorkspace) return (
    <div className="flex items-center justify-center h-full text-ink-400 text-sm">
      No se encontró un workspace.
    </div>
  )

  const displayName = userName || 'Bienvenido'
  const firstName = displayName.split(' ')[0]
  const pctActivas = totalPolizas > 0 ? Math.round((polizasActivas / totalPolizas) * 100) : 0
  const totalLeads = m?.clientes_total ?? 0

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 max-w-[1400px] mx-auto space-y-4">

      {/* ── Header con greeting + indicador de metas ──────────── */}
      <div className="flex items-center justify-between gap-6 flex-wrap mb-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-ink-400 mb-1.5">Hola</p>
          <h1 className="text-4xl lg:text-5xl font-semibold text-ink-700 tracking-tight">{firstName}</h1>
          <p className="text-sm text-ink-400 mt-1.5 flex items-center gap-2">
            <span>Resumen de <span className="font-medium text-ink-500">{currentWorkspace.name}</span></span>
            {!isGlobal && (
              <span className="text-[10px] uppercase tracking-widest font-semibold bg-info/15 text-info px-2 py-0.5 rounded-pill">
                Vista de agente
              </span>
            )}
          </p>
        </div>

        <MetasIndicator
          progress={metasProgress}
          activas={metasActivas}
          cumplidas={metasCumplidas}
        />
      </div>

      {/* ── Hero · 3 KPIs compactos (Pólizas + Producción + Clientes) ── */}
      {can('dashboard_ver_global') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <ClickCard href="/polizas" className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary-700" />
                </div>
                <div>
                  <p className="text-[11px] text-ink-400 leading-tight">Cartera</p>
                  <p className="text-sm font-semibold text-ink-700 leading-tight mt-0.5">Pólizas activas</p>
                </div>
              </div>
              <Sparkline data={polizasSpark} tone="primary" width={60} height={22} />
            </div>

            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="text-3xl font-semibold text-ink-700 tracking-tight tabular-nums">{polizasActivas}</span>
              <span className="text-base text-ink-300 tabular-nums">/ {totalPolizas}</span>
              <Badge variant="success" size="sm" dot className="ml-auto">{pctActivas}%</Badge>
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs text-ink-400 tabular-nums">{mesPolizas} nuevas este mes</span>
              <ChgBadge current={mesPolizas} previous={mesPasadoPolizas} />
            </div>

            {totalPolizas > 0 && (
              <>
                <div className="h-2 bg-cream-100 rounded-pill overflow-hidden flex">
                  {estadosDist.map(({ estado, count }) => (
                    <div
                      key={estado}
                      className={cn('h-full transition-all duration-700', ESTADO_COLOR[estado] || 'bg-ink-300')}
                      style={{ width: `${(count / totalPolizas) * 100}%` }}
                      title={`${ESTADO_LABEL[estado] || estado}: ${count}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5">
                  {estadosDist.map(({ estado, count }) => (
                    <div key={estado} className="flex items-center gap-1.5 text-[11px]">
                      <span className={cn('w-1.5 h-1.5 rounded-full', ESTADO_COLOR[estado] || 'bg-ink-300')} />
                      <span className="text-ink-500">{ESTADO_LABEL[estado] || estado}</span>
                      <span className="text-ink-700 font-semibold tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </ClickCard>

          <ClickCard href="/polizas" className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary-700" />
                </div>
                <div>
                  <p className="text-[11px] text-ink-400 leading-tight">Producción</p>
                  <p className="text-sm font-semibold text-ink-700 leading-tight mt-0.5">Prima neta activa</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-ink-400" />
            </div>

            <p className="text-2xl font-semibold text-ink-700 tracking-tight tabular-nums">{formatCOP(primaTotal)}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-ink-400">Emitida este mes:</span>
              <span className="text-xs font-semibold text-ink-700 tabular-nums">{formatCOP(primaMes)}</span>
              <ChgBadge current={primaMes} previous={primaMesPasado} />
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-cream-100">
              <Percent className="w-3 h-3 text-primary-700" />
              <span className="text-xs text-ink-400">Comisión:</span>
              <span className="text-xs font-semibold text-primary-700 ml-auto tabular-nums">{formatCOP(comisionTotal)}</span>
            </div>
          </ClickCard>

          <ClickCard href="/clientes" className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-primary-700" />
                </div>
                <div>
                  <p className="text-[11px] text-ink-400 leading-tight">Total cartera</p>
                  <p className="text-sm font-semibold text-ink-700 leading-tight mt-0.5">Clientes</p>
                </div>
              </div>
              <Sparkline data={clientesSpark} tone="primary" width={60} height={22} />
            </div>

            <p className="text-3xl font-semibold text-ink-700 tracking-tight tabular-nums">{totalLeads}</p>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-cream-100 text-xs text-ink-500 flex-wrap">
              <span><span className="font-semibold text-ink-700 tabular-nums">{clientesMes}</span> este mes</span>
              <ChgBadge current={clientesMes} previous={clientesMesPasado} />
              <span className="text-ink-200 ml-auto">·</span>
              <span><span className="font-semibold text-ink-700 tabular-nums">{porEtapa('cotizacion')}</span> cotizando</span>
            </div>
          </ClickCard>
        </div>
      )}

      {/* ── Renovaciones compact + Pipeline + Solicitudes (1 línea) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        <ClickCard href="/renovaciones" className="lg:col-span-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-warning-soft flex items-center justify-center">
                <RefreshCw className="w-4 h-4 text-ink-700" />
              </div>
              <div>
                <p className="text-[11px] text-ink-400 leading-tight">90 días</p>
                <p className="text-sm font-semibold text-ink-700 mt-0.5">Renovaciones</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>

          <div className="flex items-baseline gap-3 mb-3">
            <p className={cn(
              'text-3xl font-semibold tracking-tight tabular-nums',
              totalRenovaciones90 > 0 ? 'text-ink-700' : 'text-ink-200'
            )}>{totalRenovaciones90}</p>
            <p className="text-xs text-ink-400">
              <span className="font-semibold text-ink-700 tabular-nums">{renovaciones30}</span> próximos 30d
            </p>
          </div>

          {totalRenovaciones90 === 0 ? (
            <p className="text-xs text-ink-400 py-2">Sin renovaciones en los siguientes 90 días</p>
          ) : (
            <BarsChart data={renovacionesData} height={120} valueLabel="Pólizas" />
          )}
        </ClickCard>

        <ClickCard href="/leads" className="lg:col-span-5 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary-700" />
              </div>
              <div>
                <p className="text-[11px] text-ink-400 leading-tight">Distribución por etapa</p>
                <p className="text-sm font-semibold text-ink-700 mt-0.5">Pipeline de leads</p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>

          <div className="space-y-3">
            {(['nuevo','contactado','cotizacion','cerrado'] as Etapa[]).map(etapa => {
              const count = porEtapa(etapa)
              const pct   = totalLeads ? (count / totalLeads) * 100 : 0
              return (
                <div key={etapa}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge variant={ETAPA_COLORS[etapa]} size="sm">{ETAPA_LABELS[etapa]}</Badge>
                    <span className="text-sm font-semibold text-ink-700 tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 bg-cream-100 rounded-pill overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-pill transition-all duration-700',
                        etapa === 'cerrado'      ? 'bg-primary-500'
                        : etapa === 'cotizacion' ? 'bg-primary-300'
                        : etapa === 'contactado' ? 'bg-warning'
                        : 'bg-ink-300'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </ClickCard>

        {/* Solicitudes — PRESERVADA */}
        <ClickCard href="/solicitudes" className="lg:col-span-3 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-ink-400 leading-tight">Bandeja</p>
              <p className="text-sm font-semibold text-ink-700 mt-0.5">Solicitudes</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <MiniStat label="Nuevas"     value={solNuevas}    tone={solNuevas > 0 ? 'primary' : 'muted'} />
            <MiniStat label="Urgentes"   value={solUrgentes}  tone={solUrgentes > 0 ? 'error' : 'muted'} />
            <MiniStat label="Activas"    value={solActivas}   tone="neutral" />
            <MiniStat label="Por vencer" value={solPorVencer} tone={solPorVencer > 0 ? 'warning' : 'muted'} />
          </div>
        </ClickCard>
      </div>

      {/* ── Quick stats · Cobros + Comisiones + Tareas + Siniestros ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <ClickCard href="/cobros" className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-ink-700" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>
          <p className="text-[11px] text-ink-400">Por cobrar</p>
          <p className="text-xl font-semibold text-ink-700 tracking-tight tabular-nums mt-0.5">{formatCOP(cobrosPendiente)}</p>
          {cobrosVencido > 0 ? (
            <Badge variant="error" size="sm" dot className="mt-2.5">
              {formatCOP(cobrosVencido)} vencido
            </Badge>
          ) : (
            <Badge variant="success" size="sm" dot className="mt-2.5">Al día</Badge>
          )}
        </ClickCard>

        <ClickCard href="/liquidaciones" className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-cream-200 flex items-center justify-center">
              <Percent className="w-4 h-4 text-ink-700" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>
          <p className="text-[11px] text-ink-400">Comisiones</p>
          <p className="text-xl font-semibold text-ink-700 tracking-tight tabular-nums mt-0.5">{formatCOP(liqPendiente)}</p>
          <p className="text-xs text-ink-400 mt-2.5">Pendientes de liquidar</p>
        </ClickCard>

        {/* Tareas — PRESERVADA (3 mini-cells) */}
        {can('dashboard_ver_propias') && (
          <ClickCard href="/tareas" className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary-700"/>
                <p className="text-sm font-semibold text-ink-700">Tareas</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-ink-400" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <TareaCell value={tareasVencidas} label="Vencidas" tone={tareasVencidas > 0 ? 'error' : 'muted'} />
              <TareaCell value={tareasHoy}      label="Hoy"      tone={tareasHoy > 0 ? 'warning' : 'muted'} />
              <TareaCell value={tareasMañana}   label="Mañana"   tone={tareasMañana > 0 ? 'primary' : 'muted'} />
            </div>
          </ClickCard>
        )}

        <ClickCard href="/siniestros" className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              siniestrosPendientes > 0 ? 'bg-error-soft' : 'bg-cream-200'
            )}>
              <ShieldAlert className={cn(
                'w-4 h-4',
                siniestrosPendientes > 0 ? 'text-error' : 'text-ink-700'
              )} />
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>
          <p className="text-[11px] text-ink-400">Siniestros</p>
          <p className={cn(
            'text-xl font-semibold tracking-tight tabular-nums mt-0.5',
            siniestrosPendientes > 0 ? 'text-error' : 'text-ink-700'
          )}>{siniestrosPendientes}</p>
          <p className="text-xs text-ink-400 mt-2.5">
            {siniestrosPendientes === 0
              ? 'Todo al día'
              : siniestrosPendientes === 1 ? 'Sin finalizar' : 'Sin finalizar'}
          </p>
        </ClickCard>
      </div>

      {/* ── Producción por asesor (solo admin/supervisor) ──────── */}
      {isGlobal && produccionAsesores.length > 0 && (
        <div className="bg-white rounded-2xl border border-cream-200 shadow-soft p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
                <Target className="w-4 h-4 text-primary-700" />
              </div>
              <div>
                <p className="text-[11px] text-ink-400 leading-tight">Mes actual</p>
                <p className="text-sm font-semibold text-ink-700 mt-0.5">Producción por asesor</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span className="font-semibold text-ink-700 tabular-nums">{mesPolizas}</span>
              <span>pólizas nuevas</span>
              <ChgBadge current={mesPolizas} previous={mesPasadoPolizas} />
            </div>
          </div>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-ink-400 border-b border-cream-200">
                  <th className="pb-2.5 font-medium">Asesor</th>
                  <th className="pb-2.5 font-medium text-right">Pólizas</th>
                  <th className="pb-2.5 font-medium text-right">Prima emitida</th>
                  <th className="pb-2.5 font-medium text-right hidden sm:table-cell">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {produccionAsesores.map(a => (
                  <tr key={a.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/60 transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar fallback={a.nombre} size="sm" />
                        <span className="font-medium text-ink-700">{a.nombre}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-ink-700 tabular-nums">{a.count}</td>
                    <td className="py-2.5 text-right font-semibold text-ink-700 tabular-nums">{formatCOP(a.prima)}</td>
                    <td className="py-2.5 text-right text-ink-500 tabular-nums hidden sm:table-cell">{formatCOP(a.comision)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-cream-200">
                  <td className="pt-2.5 text-[11px] text-ink-400 font-semibold uppercase tracking-widest">Total</td>
                  <td className="pt-2.5 text-right font-semibold text-ink-700 tabular-nums">{mesPolizas}</td>
                  <td className="pt-2.5 text-right font-semibold text-ink-700 tabular-nums">{formatCOP(primaMes)}</td>
                  <td className="pt-2.5 text-right font-semibold text-ink-500 tabular-nums hidden sm:table-cell">
                    {formatCOP(mesComision)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Distribuciones · Ramo + Aseguradora ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <ClickCard href="/polizas" className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] text-ink-400">Cartera activa</p>
              <p className="text-sm font-semibold text-ink-700 mt-0.5">Distribución por ramo</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>

          {carteraRamo.length === 0 ? (
            <p className="text-sm text-ink-400 py-8 text-center">Sin pólizas activas</p>
          ) : (
            <div className="flex items-center gap-6">
              <Donut data={carteraRamo} size={150} thickness={18} />
              <DonutLegend data={carteraRamo} className="flex-1" />
            </div>
          )}
        </ClickCard>

        <ClickCard href="/polizas" className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] text-ink-400">Cartera activa</p>
              <p className="text-sm font-semibold text-ink-700 mt-0.5">Distribución por aseguradora</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-ink-400" />
          </div>

          {carteraAseguradora.length === 0 ? (
            <p className="text-sm text-ink-400 py-8 text-center">Sin pólizas activas</p>
          ) : (
            <div className="flex items-center gap-6">
              <Donut data={carteraAseguradora} size={150} thickness={18} />
              <DonutLegend data={carteraAseguradora} className="flex-1" />
            </div>
          )}
        </ClickCard>
      </div>

      {/* ── Tendencia (movido más abajo) ───────────────────────── */}
      {can('dashboard_ver_global') && (
        <ClickCard href="/polizas" className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[11px] text-ink-400">Últimos 12 meses</p>
              <p className="text-sm font-semibold text-ink-700 mt-0.5">Tendencia de producción</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-primary-500" />
                <span className="text-ink-500">Prima neta</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-info" />
                <span className="text-ink-500">Comisión</span>
              </span>
            </div>
          </div>

          <TrendChart
            data={trendData}
            height={200}
            formatValue={(n) => {
              if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
              if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
              return `$${n}`
            }}
            primaryLabel="Prima neta"
            secondaryLabel="Comisión"
          />
        </ClickCard>
      )}

      {/* ── Cumpleaños (full width) ─────────────────────────────── */}
      <ClickCard href="/clientes" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-warning-soft flex items-center justify-center">
              <Cake className="w-4 h-4 text-ink-700" />
            </div>
            <div>
              <p className="text-[11px] text-ink-400 leading-tight">Próximos 5 días</p>
              <p className="text-sm font-semibold text-ink-700 mt-0.5">Cumpleaños</p>
            </div>
          </div>
          <Badge variant={cumpleaños.length > 0 ? 'warning' : 'neutral'} size="sm">{cumpleaños.length}</Badge>
        </div>

        {cumpleaños.length === 0 ? (
          <p className="text-sm text-ink-400 py-2">Sin cumpleaños próximos</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
            {cumpleaños.slice(0, 9).map(c => {
              const fn = new Date(c.fecha_nacimiento!)
              const hoy = new Date()
              const esteAño = new Date(hoy.getFullYear(), fn.getMonth(), fn.getDate())
              if (esteAño < hoy) esteAño.setFullYear(hoy.getFullYear() + 1)
              const diff = Math.ceil((esteAño.getTime() - hoy.getTime()) / 86400000)
              return (
                <div key={c.id} className="flex items-center gap-2.5">
                  <Avatar fallback={c.nombre} size="sm" />
                  <span className="flex-1 text-sm text-ink-700 truncate">{c.nombre}</span>
                  <Badge variant={diff === 0 ? 'warning' : 'neutral'} size="sm">
                    {diff === 0 ? '¡Hoy!' : `${diff}d`}
                  </Badge>
                </div>
              )
            })}
          </div>
        )}
      </ClickCard>

      {/* ── Últimos clientes ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-cream-200 shadow-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cream-200 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-ink-700" />
            </div>
            <div>
              <p className="text-[11px] text-ink-400 leading-tight">Recientes</p>
              <p className="text-sm font-semibold text-ink-700 mt-0.5">Últimos clientes</p>
            </div>
          </div>
          <Link href="/clientes" className="text-xs text-primary-700 hover:text-primary-800 font-medium">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-widest text-ink-400 border-b border-cream-200">
                <th className="pb-2.5 font-medium w-1/2">Nombre</th>
                <th className="pb-2.5 font-medium hidden sm:table-cell">Ciudad</th>
                <th className="pb-2.5 font-medium">Etapa</th>
                <th className="pb-2.5 font-medium hidden md:table-cell">Categoría</th>
                <th className="pb-2.5 font-medium hidden sm:table-cell">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {clientesRecientes.map(c => (
                <tr key={c.id} className="border-b border-cream-100 last:border-0 hover:bg-cream-50/60 transition-colors">
                  <td className="py-2.5">
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 group">
                      <Avatar fallback={c.nombre} size="sm" />
                      <span className="font-medium text-ink-700 group-hover:text-primary-700 transition-colors">{c.nombre}</span>
                    </Link>
                  </td>
                  <td className="py-2.5 text-ink-500 hidden sm:table-cell">{c.ciudad || '—'}</td>
                  <td className="py-2.5">
                    <Badge variant={ETAPA_COLORS[c.etapa]} size="sm">{ETAPA_LABELS[c.etapa]}</Badge>
                  </td>
                  <td className="py-2.5 hidden md:table-cell">
                    {c.categoria
                      ? <Badge variant="outline" size="sm">{c.categoria}</Badge>
                      : <span className="text-ink-300 text-xs">—</span>}
                  </td>
                  <td className="py-2.5 text-ink-500 hidden sm:table-cell">{c.telefono || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────── */

function ClickCard({ href, className, children }: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'block bg-white rounded-2xl border border-cream-200/80 shadow-soft',
        'hover:shadow-card hover:-translate-y-0.5 transition-all duration-200',
        className,
      )}
    >
      {children}
    </Link>
  )
}

function ChgBadge({ current, previous }: { current: number; previous: number }) {
  if (current === 0 && previous === 0) return null
  const pct = previous === 0
    ? (current > 0 ? 100 : 0)
    : Math.round(((current - previous) / Math.abs(previous)) * 100)
  const up = pct >= 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums rounded-full px-1.5 py-0.5',
      up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
    )}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

function MiniStat({ label, value, tone }: {
  label: string
  value: number
  tone: 'primary' | 'neutral' | 'error' | 'warning' | 'muted'
}) {
  const styles = {
    primary: 'bg-primary-100 text-primary-800',
    neutral: 'bg-white border border-cream-200 text-ink-700',
    error:   'bg-error-soft text-error',
    warning: 'bg-warning-soft text-ink-700',
    muted:   'bg-cream-100 text-ink-400',
  }
  return (
    <div className={cn('rounded-md px-4 py-3', styles[tone])}>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-widest mt-1 opacity-75">{label}</p>
    </div>
  )
}

function TareaCell({ value, label, tone }: {
  value: number
  label: string
  tone: 'error' | 'warning' | 'primary' | 'muted'
}) {
  const styles = {
    error:   'bg-error-soft text-error',
    warning: 'bg-warning-soft text-ink-700',
    primary: 'bg-primary-100 text-primary-800',
    muted:   'bg-cream-100 text-ink-400',
  }
  return (
    <div className={cn('rounded-md px-2 py-3 text-center', styles[tone])}>
      <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-widest mt-0.5 opacity-75">{label}</p>
    </div>
  )
}

function MetasIndicator({ progress, activas, cumplidas }: {
  progress: number
  activas: number
  cumplidas: number
}) {
  const size = 88
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(progress, 100) / 100)

  return (
    <Link
      href="/metas"
      className="flex items-center gap-4 bg-white rounded-2xl border border-cream-200/80 shadow-soft px-5 py-4 hover:shadow-card hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-cream-200)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-primary-500)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.7s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold text-ink-700 tabular-nums leading-none">{progress}%</span>
        </div>
      </div>

      <div className="text-right">
        <div className="flex items-center gap-1.5 justify-end mb-1">
          <Target className="w-3.5 h-3.5 text-primary-700" />
          <p className="text-[11px] uppercase tracking-widest text-ink-400 leading-none">Metas</p>
        </div>
        {activas === 0 ? (
          <>
            <p className="text-sm font-semibold text-ink-700">Sin metas</p>
            <p className="text-xs text-primary-700 hover:underline mt-0.5">Configurar →</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink-700 tabular-nums">
              {cumplidas} <span className="text-ink-400 font-normal">/ {activas}</span>
            </p>
            <p className="text-xs text-ink-400 mt-0.5">
              {cumplidas === activas ? '¡Todas cumplidas!' : `${activas - cumplidas} en curso`}
            </p>
          </>
        )}
      </div>
    </Link>
  )
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function bucketByDay<T extends Record<string, unknown>>(items: T[], dateKey: keyof T, days: number): number[] {
  const buckets = new Array(days).fill(0)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  items.forEach(item => {
    const raw = item[dateKey]
    if (typeof raw !== 'string') return
    const d = new Date(raw)
    const diff = Math.floor((todayStart.getTime() - d.getTime()) / 86400000)
    const idx = days - 1 - diff
    if (idx >= 0 && idx < days) buckets[idx]++
  })
  return buckets
}
