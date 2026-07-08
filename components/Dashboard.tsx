'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { Cliente, Poliza, Etapa } from '@/types'
import { formatCOP, daysUntil, cn } from '@/lib/utils'
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

  const [clientes,   setClientes]   = useState<Cliente[]>([])
  const [polizas,    setPolizas]    = useState<Poliza[]>([])
  const [todasPolizas, setTodasPolizas] = useState<{ estado: string }[]>([])
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

  // Comparaciones mensuales
  const [polizasMes,        setPolizasMes]        = useState<{ prima_neta: number | null; comision_agencia: number | null; vendedor_id: string | null }[]>([])
  const [polizasMesPasado,  setPolizasMesPasado]  = useState<{ prima_neta: number | null; comision_agencia: number | null }[]>([])
  const [clientesMes,       setClientesMes]       = useState(0)
  const [clientesMesPasado, setClientesMesPasado] = useState(0)
  const [vendedores,        setVendedores]        = useState<{ id: string; nombre: string }[]>([])

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
      const wsId     = currentWorkspace!.id
      const uid      = currentUserId
      const today    = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const in7days  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      const year12Ago = new Date()
      year12Ago.setMonth(year12Ago.getMonth() - 11)
      year12Ago.setDate(1)
      const trendStart = year12Ago.toISOString().split('T')[0]
      const days30Ago = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
      const in90days = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]

      const ahora          = new Date()
      const mesActualStart = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0]
      const mesPasadoStart = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).toISOString().split('T')[0]
      const mesPasadoEnd   = new Date(ahora.getFullYear(), ahora.getMonth(), 0).toISOString().split('T')[0]

      // Base queries — global vs per-agent
      let qClientes = supabase.from('clientes').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false })
      let qPolizas  = supabase.from('polizas').select('*, cliente:clientes(nombre)').eq('workspace_id', wsId).eq('estado', 'activa').eq('eliminada', false)
      let qAllP     = supabase.from('polizas').select('estado').eq('workspace_id', wsId).eq('eliminada', false)
      let qSin      = supabase.from('siniestros').select('id').eq('workspace_id', wsId).not('estado', 'in', '("cerrado","rechazado")')
      let qTV       = supabase.from('tareas').select('id').eq('workspace_id', wsId).eq('completada', false).lt('fecha_vencimiento', today)
      let qTH       = supabase.from('tareas').select('id').eq('workspace_id', wsId).eq('completada', false).eq('fecha_vencimiento', today)
      let qTM       = supabase.from('tareas').select('id').eq('workspace_id', wsId).eq('completada', false).eq('fecha_vencimiento', tomorrow)
      let qCobros   = supabase.from('cobros').select('valor, estado, tipo').eq('workspace_id', wsId).neq('estado', 'anulado')
      let qLiqs     = supabase.from('liquidaciones').select('total_comision, estado').eq('workspace_id', wsId).eq('estado', 'pendiente')
      let qSols     = supabase.from('solicitudes').select('id, estado, prioridad, fecha_limite').eq('workspace_id', wsId)

      if (!isGlobal && uid) {
        qClientes = qClientes.eq('assigned_to', uid)
        qPolizas  = qPolizas.eq('vendedor_id', uid)
        qAllP     = qAllP.eq('vendedor_id', uid)
        qTV       = qTV.eq('asignado_a', uid)
        qTH       = qTH.eq('asignado_a', uid)
        qTM       = qTM.eq('asignado_a', uid)
        qSols     = qSols.eq('asignado_a', uid)
      }

      const [
        { data: c }, { data: p }, { data: allP }, { data: sin },
        { data: tareasV }, { data: tareasH }, { data: tareasM },
        { data: cobros }, { data: liqs }, { data: sols },
        { data: polizasTrend }, { data: renovs90 },
        { data: clientesNew }, { data: polizasNew },
        { data: metas },
      ] = await Promise.all([
        qClientes,
        qPolizas,
        qAllP,
        qSin,
        qTV, qTH, qTM,
        qCobros,
        qLiqs,
        qSols,
        // Tendencia 12 meses (global, no per-agent)
        supabase.from('polizas')
          .select('fecha_inicio, prima_neta, comision_agencia')
          .eq('workspace_id', wsId).eq('eliminada', false).gte('fecha_inicio', trendStart),
        // Renovaciones próximos 90 días (respeta per-agent si aplica)
        (isGlobal || !uid
          ? supabase.from('polizas').select('fecha_fin').eq('workspace_id', wsId).eq('estado', 'activa').eq('eliminada', false)
          : supabase.from('polizas').select('fecha_fin').eq('workspace_id', wsId).eq('estado', 'activa').eq('eliminada', false).eq('vendedor_id', uid)
        ).gte('fecha_fin', today).lte('fecha_fin', in90days),
        // Sparklines últimos 30 días
        (isGlobal || !uid
          ? supabase.from('clientes').select('created_at').eq('workspace_id', wsId)
          : supabase.from('clientes').select('created_at').eq('workspace_id', wsId).eq('assigned_to', uid)
        ).gte('created_at', days30Ago),
        (isGlobal || !uid
          ? supabase.from('polizas').select('fecha_inicio').eq('workspace_id', wsId).eq('eliminada', false)
          : supabase.from('polizas').select('fecha_inicio').eq('workspace_id', wsId).eq('eliminada', false).eq('vendedor_id', uid)
        ).gte('fecha_inicio', days30Ago),
        // Metas activas (workspace-level)
        supabase.from('metas')
          .select('valor_meta, valor_actual')
          .eq('workspace_id', wsId)
          .lte('fecha_inicio', today)
          .gte('fecha_fin', today),
      ])

      setClientes(c || [])
      setPolizas(p || [])
      setTodasPolizas(allP || [])
      setSiniestrosPendientes((sin || []).length)
      setTareasVencidas((tareasV || []).length)
      setTareasHoy((tareasH || []).length)
      setTareasMañana((tareasM || []).length)

      const cList = (cobros || []) as { valor: number; estado: string; tipo: string }[]
      setCobrosPendiente(
        cList.filter(c => c.estado === 'pendiente' && (c.tipo === 'por_cobrar' || c.tipo === 'comision_por_cobrar'))
          .reduce((s, c) => s + c.valor, 0)
      )
      setCobrosVencido(cList.filter(c => c.estado === 'vencido').reduce((s, c) => s + c.valor, 0))
      setLiqPendiente((liqs || []).reduce((s, l) => s + (l.total_comision || 0), 0))

      const sList = (sols || []) as { id: string; estado: string; prioridad: string; fecha_limite: string | null }[]
      const activas = sList.filter(s => s.estado === 'nueva' || s.estado === 'en_proceso')
      setSolNuevas(sList.filter(s => s.estado === 'nueva').length)
      setSolUrgentes(activas.filter(s => s.prioridad === 'urgente').length)
      setSolActivas(activas.length)
      setSolPorVencer(activas.filter(s => s.fecha_limite && s.fecha_limite <= in7days).length)

      // Tendencia mensual
      const monthMap = new Map<string, { prima: number; comision: number }>()
      for (let i = 11; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        d.setDate(1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthMap.set(key, { prima: 0, comision: 0 })
      }
      ;(polizasTrend || []).forEach((p: { fecha_inicio: string; prima_neta?: number; comision_agencia?: number }) => {
        if (!p.fecha_inicio) return
        const d = new Date(p.fecha_inicio + 'T00:00:00')
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const slot = monthMap.get(key)
        if (slot) {
          slot.prima    += p.prima_neta || 0
          slot.comision += p.comision_agencia || 0
        }
      })
      const trend: TrendDatum[] = Array.from(monthMap.entries()).map(([key, v]) => {
        const monthIdx = parseInt(key.split('-')[1], 10) - 1
        return { label: MONTH_LABELS_ES[monthIdx], value: v.prima, secondary: v.comision }
      })
      setTrendData(trend)

      // Renovaciones por bloque de 15 días
      const buckets = ['0-15d', '16-30d', '31-45d', '46-60d', '61-75d', '76-90d']
      const renovMap = new Map<string, number>(buckets.map(b => [b, 0]))
      ;(renovs90 || []).forEach((r: { fecha_fin: string }) => {
        const d = daysUntil(r.fecha_fin)
        let bucket = '76-90d'
        if (d <= 15) bucket = '0-15d'
        else if (d <= 30) bucket = '16-30d'
        else if (d <= 45) bucket = '31-45d'
        else if (d <= 60) bucket = '46-60d'
        else if (d <= 75) bucket = '61-75d'
        renovMap.set(bucket, (renovMap.get(bucket) || 0) + 1)
      })
      const renovData: BarsDatum[] = buckets.map((b, i) => ({
        label: b,
        value: renovMap.get(b) || 0,
        tone: i === 0 ? 'error' : i === 1 ? 'warning' : 'primary',
      }))
      setRenovacionesData(renovData)

      // Sparklines
      const sparkClientes = bucketByDay(clientesNew as { created_at: string }[] || [], 'created_at', 30)
      const sparkPolizas  = bucketByDay(polizasNew  as { fecha_inicio: string }[]  || [], 'fecha_inicio', 30)
      setClientesSpark(sparkClientes)
      setPolizasSpark(sparkPolizas)

      // Metas — progreso promedio
      const mList = (metas || []) as { valor_meta: number; valor_actual: number }[]
      setMetasActivas(mList.length)
      if (mList.length > 0) {
        const progresos = mList.map(m =>
          m.valor_meta > 0 ? Math.min((m.valor_actual / m.valor_meta) * 100, 100) : 0
        )
        const promedio = progresos.reduce((a, b) => a + b, 0) / mList.length
        setMetasProgress(Math.round(promedio))
        setMetasCumplidas(progresos.filter(p => p >= 100).length)
      } else {
        setMetasProgress(0)
        setMetasCumplidas(0)
      }

      // ── Comparaciones mensuales + producción por asesor ─────────────
      let qPMes  = supabase.from('polizas').select('prima_neta, comision_agencia, vendedor_id')
        .eq('workspace_id', wsId).eq('eliminada', false).gte('fecha_inicio', mesActualStart)
      let qPMesP = supabase.from('polizas').select('prima_neta, comision_agencia')
        .eq('workspace_id', wsId).eq('eliminada', false)
        .gte('fecha_inicio', mesPasadoStart).lte('fecha_inicio', mesPasadoEnd)
      if (!isGlobal && uid) {
        qPMes  = qPMes.eq('vendedor_id', uid)
        qPMesP = qPMesP.eq('vendedor_id', uid)
      }
      const [
        { data: pMes }, { data: pMesP }, { data: cMes }, { data: cMesP }, { data: vends },
      ] = await Promise.all([
        qPMes,
        qPMesP,
        (isGlobal || !uid
          ? supabase.from('clientes').select('id').eq('workspace_id', wsId).gte('created_at', mesActualStart + 'T00:00:00')
          : supabase.from('clientes').select('id').eq('workspace_id', wsId).gte('created_at', mesActualStart + 'T00:00:00').eq('assigned_to', uid)
        ),
        (isGlobal || !uid
          ? supabase.from('clientes').select('id').eq('workspace_id', wsId).gte('created_at', mesPasadoStart + 'T00:00:00').lte('created_at', mesPasadoEnd + 'T23:59:59')
          : supabase.from('clientes').select('id').eq('workspace_id', wsId).gte('created_at', mesPasadoStart + 'T00:00:00').lte('created_at', mesPasadoEnd + 'T23:59:59').eq('assigned_to', uid)
        ),
        supabase.from('vendedores').select('id, nombre').eq('workspace_id', wsId).order('nombre'),
      ])
      type PMesRow = { prima_neta: number | null; comision_agencia: number | null; vendedor_id: string | null }
      setPolizasMes((pMes ?? []) as PMesRow[])
      setPolizasMesPasado((pMesP ?? []) as { prima_neta: number | null; comision_agencia: number | null }[])
      setClientesMes((cMes ?? []).length)
      setClientesMesPasado((cMesP ?? []).length)
      setVendedores((vends ?? []) as { id: string; nombre: string }[])

      setLoading(false)
    }
    load()
  }, [currentWorkspace?.id])

  // Distribución por ramo (de pólizas activas)
  const carteraRamo: DonutSlice[] = useMemo(() => {
    const map = new Map<string, number>()
    polizas.forEach(p => {
      const ramo = p.ramo || 'Sin ramo'
      map.set(ramo, (map.get(ramo) || 0) + 1)
    })
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    return entries.slice(0, 6).map(([label, value], i) => ({
      label, value, color: RAMO_COLORS[i % RAMO_COLORS.length],
    }))
  }, [polizas])

  // Distribución por aseguradora (de pólizas activas)
  const carteraAseguradora: DonutSlice[] = useMemo(() => {
    const map = new Map<string, number>()
    polizas.forEach(p => {
      const aseg = p.aseguradora || 'Sin asignar'
      map.set(aseg, (map.get(aseg) || 0) + 1)
    })
    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
    return entries.slice(0, 6).map(([label, value], i) => ({
      label, value, color: ASEG_COLORS[i % ASEG_COLORS.length],
    }))
  }, [polizas])

  // Distribución por estado (todas las pólizas)
  const estadosDist = useMemo(() => {
    const map = new Map<string, number>()
    todasPolizas.forEach(p => {
      const e = p.estado || 'otro'
      map.set(e, (map.get(e) || 0) + 1)
    })
    const order = ['activa', 'pendiente', 'vencida', 'cancelada']
    return order
      .map(estado => ({ estado, count: map.get(estado) || 0 }))
      .filter(s => s.count > 0)
  }, [todasPolizas])

  const primaMes       = useMemo(() => polizasMes.reduce((s, p) => s + (p.prima_neta || 0), 0), [polizasMes])
  const primaMesPasado = useMemo(() => polizasMesPasado.reduce((s, p) => s + (p.prima_neta || 0), 0), [polizasMesPasado])

  // Producción por asesor del mes actual (solo admin/supervisor)
  const produccionAsesores = useMemo(() => {
    if (!isGlobal || polizasMes.length === 0) return []
    const map = new Map<string, { nombre: string; count: number; prima: number; comision: number }>()
    polizasMes.forEach(p => {
      const vid = p.vendedor_id || '__sin_asignar__'
      const slot = map.get(vid) || { nombre: '', count: 0, prima: 0, comision: 0 }
      map.set(vid, { nombre: slot.nombre, count: slot.count + 1, prima: slot.prima + (p.prima_neta || 0), comision: slot.comision + (p.comision_agencia || 0) })
    })
    vendedores.forEach(v => { const s = map.get(v.id); if (s) s.nombre = v.nombre })
    return Array.from(map.entries())
      .map(([id, d]) => ({ id, nombre: d.nombre || (id === '__sin_asignar__' ? 'Sin asignar' : '—'), count: d.count, prima: d.prima, comision: d.comision }))
      .sort((a, b) => b.prima - a.prima)
  }, [polizasMes, vendedores, isGlobal])

  const porEtapa = (e: Etapa) => clientes.filter(c => c.etapa === e).length
  const primaTotal    = polizas.reduce((s, p) => s + (p.prima_neta || p.prima || 0), 0)
  const comisionTotal = polizas.reduce((s, p) => s + (p.comision_agencia || 0), 0)
  const renovaciones30 = polizas.filter(p => { if (!p.fecha_fin) return false; const d = daysUntil(p.fecha_fin); return d >= 0 && d <= 30 })
  const renovaciones60 = polizas.filter(p => { if (!p.fecha_fin) return false; const d = daysUntil(p.fecha_fin); return d > 30 && d <= 60 })
  const totalRenovaciones90 = renovaciones30.length + renovaciones60.length
  const totalPolizas = todasPolizas.length
  const cumpleaños = clientes.filter(c => {
    if (!c.fecha_nacimiento) return false
    const hoy = new Date()
    const fn  = new Date(c.fecha_nacimiento)
    const esteAño = new Date(hoy.getFullYear(), fn.getMonth(), fn.getDate())
    if (esteAño < hoy) esteAño.setFullYear(hoy.getFullYear() + 1)
    return Math.ceil((esteAño.getTime() - hoy.getTime()) / 86400000) <= 5
  })

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
  const pctActivas = totalPolizas > 0 ? Math.round((polizas.length / totalPolizas) * 100) : 0
  const totalLeads = clientes.length

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
              <span className="text-3xl font-semibold text-ink-700 tracking-tight tabular-nums">{polizas.length}</span>
              <span className="text-base text-ink-300 tabular-nums">/ {totalPolizas}</span>
              <Badge variant="success" size="sm" dot className="ml-auto">{pctActivas}%</Badge>
            </div>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-xs text-ink-400 tabular-nums">{polizasMes.length} nuevas este mes</span>
              <ChgBadge current={polizasMes.length} previous={polizasMesPasado.length} />
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
              <span className="font-semibold text-ink-700 tabular-nums">{renovaciones30.length}</span> próximos 30d
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
              <span className="font-semibold text-ink-700 tabular-nums">{polizasMes.length}</span>
              <span>pólizas nuevas</span>
              <ChgBadge current={polizasMes.length} previous={polizasMesPasado.length} />
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
                  <td className="pt-2.5 text-right font-semibold text-ink-700 tabular-nums">{polizasMes.length}</td>
                  <td className="pt-2.5 text-right font-semibold text-ink-700 tabular-nums">{formatCOP(primaMes)}</td>
                  <td className="pt-2.5 text-right font-semibold text-ink-500 tabular-nums hidden sm:table-cell">
                    {formatCOP(polizasMes.reduce((s, p) => s + (p.comision_agencia || 0), 0))}
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
              {clientes.slice(0,5).map(c => (
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
