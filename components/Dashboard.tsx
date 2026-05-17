'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { Cliente, Poliza, Etapa } from '@/types'
import { formatCOP, daysUntil } from '@/lib/utils'
import Link from 'next/link'
import {
  Users, AlertTriangle, TrendingUp, ChevronRight,
  Clock, Cake, ShieldAlert, CheckSquare, RefreshCw, Send,
  ClipboardList, Activity, DollarSign, BarChart3,
  Banknote, Percent,
} from 'lucide-react'

const ETAPA_LABELS: Record<Etapa, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizacion: 'Cotización', cerrado: 'Cerrado',
}
const ETAPA_COLORS: Record<Etapa, string> = {
  nuevo: 'bg-blue-100 text-blue-700',
  contactado: 'bg-amber-100 text-amber-700',
  cotizacion: 'bg-purple-100 text-purple-700',
  cerrado: 'bg-emerald-100 text-emerald-700',
}

export default function Dashboard() {
  const { currentWorkspace, currentUserId, isAdmin, isSupervisor, loading: wsLoading } = useWorkspace()
  const { can } = usePermissions()
  const isGlobal = isAdmin || isSupervisor  // Can see all-workspace metrics
  const [clientes,   setClientes]   = useState<Cliente[]>([])
  const [polizas,    setPolizas]    = useState<Poliza[]>([])
  const [todasPolizas, setTodasPolizas] = useState<{ estado: string }[]>([])
  const [siniestrosPendientes, setSiniestrosPendientes] = useState(0)
  const [tareasHoy,     setTareasHoy]     = useState(0)
  const [tareasVencidas,setTareasVencidas]= useState(0)
  const [tareasMañana,  setTareasMañana]  = useState(0)
  // Financial metrics
  const [cobrosPendiente,  setCobrosPendiente]  = useState(0)
  const [cobrosVencido,    setCobrosVencido]    = useState(0)
  const [liqPendiente,     setLiqPendiente]     = useState(0)
  // Solicitudes
  const [solNuevas,     setSolNuevas]     = useState(0)
  const [solUrgentes,   setSolUrgentes]   = useState(0)
  const [solActivas,    setSolActivas]    = useState(0)
  const [solPorVencer,  setSolPorVencer]  = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentWorkspace) return
    setLoading(true)
    async function load() {
      const wsId     = currentWorkspace!.id
      const uid      = currentUserId
      const today    = new Date().toISOString().split('T')[0]
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
      const in7days  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

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
        { data: c },
        { data: p },
        { data: allP },
        { data: sin },
        { data: tareasV },
        { data: tareasH },
        { data: tareasM },
        { data: cobros },
        { data: liqs },
        { data: sols },
      ] = await Promise.all([
        qClientes,
        qPolizas,
        qAllP,
        qSin,
        qTV, qTH, qTM,
        qCobros,
        qLiqs,
        qSols,
      ])

      setClientes(c || [])
      setPolizas(p || [])
      setTodasPolizas(allP || [])
      setSiniestrosPendientes((sin || []).length)
      setTareasVencidas((tareasV || []).length)
      setTareasHoy((tareasH || []).length)
      setTareasMañana((tareasM || []).length)

      // Cobros financials (solo por_cobrar + comision_por_cobrar)
      const cList = (cobros || []) as { valor: number; estado: string; tipo: string }[]
      setCobrosPendiente(
        cList.filter(c => c.estado === 'pendiente' && (c.tipo === 'por_cobrar' || c.tipo === 'comision_por_cobrar'))
          .reduce((s, c) => s + c.valor, 0)
      )
      setCobrosVencido(
        cList.filter(c => c.estado === 'vencido')
          .reduce((s, c) => s + c.valor, 0)
      )
      setLiqPendiente((liqs || []).reduce((s, l) => s + (l.total_comision || 0), 0))

      // Solicitudes
      const sList = (sols || []) as { id: string; estado: string; prioridad: string; fecha_limite: string | null }[]
      const activas = sList.filter(s => s.estado === 'nueva' || s.estado === 'en_proceso')
      setSolNuevas(sList.filter(s => s.estado === 'nueva').length)
      setSolUrgentes(activas.filter(s => s.prioridad === 'urgente').length)
      setSolActivas(activas.length)
      setSolPorVencer(activas.filter(s => s.fecha_limite && s.fecha_limite <= in7days).length)

      setLoading(false)
    }
    load()
  }, [currentWorkspace?.id])

  const porEtapa = (e: Etapa) => clientes.filter(c => c.etapa === e).length

  // Use prima_neta if available, fallback to prima for legacy records
  const primaTotal = polizas.reduce((s, p) => s + (p.prima_neta || p.prima || 0), 0)
  const comisionTotal = polizas.reduce((s, p) => s + (p.comision_agencia || 0), 0)

  const renovaciones30 = polizas.filter(p => { if (!p.fecha_fin) return false; const d = daysUntil(p.fecha_fin); return d >= 0 && d <= 30 })
  const renovaciones60 = polizas.filter(p => { if (!p.fecha_fin) return false; const d = daysUntil(p.fecha_fin); return d > 30 && d <= 60 })
  const polizasVencidas   = todasPolizas.filter(p => p.estado === 'vencida').length
  const polizasPendientes = todasPolizas.filter(p => p.estado === 'pendiente').length

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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  if (!currentWorkspace) return (
    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
      No se encontró un workspace. Recarga la página.
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {isGlobal ? 'Resumen de Senda Seguros' : 'Tus métricas personales'}
          {!isGlobal && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Vista de agente</span>
          )}
        </p>
      </div>

      {/* ── Fila 0: KPIs financieros ──────────────────────────────────── */}
      {isGlobal && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <FinCard
            icon={<DollarSign className="w-5 h-5 text-emerald-600"/>}
            label="Prima neta activa"
            value={formatCOP(primaTotal)}
            sub={`${polizas.length} pólizas activas`}
            bg="bg-emerald-50" href="/polizas" color="text-emerald-800"
          />
          <FinCard
            icon={<Percent className="w-5 h-5 text-blue-600"/>}
            label="Comisión agencia"
            value={formatCOP(comisionTotal)}
            sub="Total pólizas activas"
            bg="bg-blue-50" href="/polizas" color="text-blue-800"
          />
          <FinCard
            icon={<Banknote className="w-5 h-5 text-amber-600"/>}
            label="Por cobrar"
            value={formatCOP(cobrosPendiente)}
            sub={cobrosVencido > 0 ? `⚠ ${formatCOP(cobrosVencido)} vencido` : 'Al día'}
            bg={cobrosVencido > 0 ? 'bg-amber-50' : 'bg-slate-50'}
            href="/cobros" color="text-amber-800"
            urgent={cobrosVencido > 0}
          />
          <FinCard
            icon={<BarChart3 className="w-5 h-5 text-violet-600"/>}
            label="Comisiones pendientes"
            value={formatCOP(liqPendiente)}
            sub="A liquidar vendedores"
            bg="bg-violet-50" href="/liquidaciones" color="text-violet-800"
          />
        </div>
      )}

      {/* ── Fila 1: 4 métricas estado pólizas ─────────────────────────── */}
      {isGlobal && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={<RefreshCw className="w-5 h-5 text-purple-600"/>} label="Cotizaciones" value={porEtapa('cotizacion')} bg="bg-purple-50" href="/leads" color="text-purple-700"/>
          <MetricCard icon={<Send className="w-5 h-5 text-blue-600"/>} label="En expedición" value={polizasPendientes} bg="bg-blue-50" href="/polizas" color="text-blue-700"/>
          <MetricCard icon={<AlertTriangle className="w-5 h-5 text-amber-600"/>} label="Por renovar (30d)" value={renovaciones30.length} bg="bg-amber-50" href="/renovaciones" color="text-amber-700" urgent={renovaciones30.length > 0}/>
          <MetricCard icon={<ShieldAlert className="w-5 h-5 text-red-500"/>} label="Pólizas vencidas" value={polizasVencidas} bg="bg-red-50" href="/polizas" color="text-red-700"/>
        </div>
      )}

      {/* ── Fila 2: Solicitudes + Clientes + Producción ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Solicitudes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-600"/> Solicitudes
            </h2>
            <Link href="/solicitudes" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3"/>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Nuevas',     value: solNuevas,    color: 'bg-blue-50 text-blue-700'     },
              { label: 'Urgentes',   value: solUrgentes,  color: solUrgentes>0?'bg-red-50 text-red-700':'bg-slate-50 text-slate-500' },
              { label: 'Activas',    value: solActivas,   color: 'bg-emerald-50 text-emerald-700'},
              { label: 'Por vencer', value: solPorVencer, color: solPorVencer>0?'bg-amber-50 text-amber-700':'bg-slate-50 text-slate-500' },
            ].map(b => (
              <div key={b.label} className={`${b.color} rounded-lg px-3 py-2.5 text-center`}>
                <p className="text-2xl font-bold">{b.value}</p>
                <p className="text-xs font-medium mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Clientes */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600"/> Clientes activos
            </h2>
            <Link href="/clientes" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="w-3 h-3"/>
            </Link>
          </div>
          <p className="text-3xl font-bold text-slate-900 mb-3">{clientes.length}</p>
          <div className="space-y-1.5">
            {(['nuevo','contactado','cotizacion','cerrado'] as Etapa[]).map(etapa => {
              const count = porEtapa(etapa)
              const pct   = clientes.length ? Math.round((count / clientes.length) * 100) : 0
              return (
                <div key={etapa}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${ETAPA_COLORS[etapa]}`}>{ETAPA_LABELS[etapa]}</span>
                    <span className="text-slate-500 font-medium">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${etapa==='nuevo'?'bg-blue-400':etapa==='contactado'?'bg-amber-400':etapa==='cotizacion'?'bg-purple-400':'bg-emerald-400'}`}
                      style={{width:`${pct}%`}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Producción */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600"/> Producción
            </h2>
            <Link href="/polizas" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver pólizas <ChevronRight className="w-3 h-3"/>
            </Link>
          </div>
          <p className="text-xs text-slate-500 mb-0.5">Prima neta total activa</p>
          <p className="text-2xl font-bold text-emerald-700 mb-1">{formatCOP(primaTotal)}</p>
          {comisionTotal > 0 && (
            <p className="text-xs text-blue-600 font-medium mb-3">
              Comisión agencia: {formatCOP(comisionTotal)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div className="text-center">
              <p className="text-xl font-bold text-slate-800">{polizas.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Activas</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-amber-600">{renovaciones30.length + renovaciones60.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Por renovar</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fila 3: Pipeline + Renovaciones ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Pipeline de leads</h2>
            <Link href="/leads" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver pipeline <ChevronRight className="w-3 h-3"/>
            </Link>
          </div>
          <div className="space-y-3">
            {(['nuevo','contactado','cotizacion','cerrado'] as Etapa[]).map(etapa => {
              const count = porEtapa(etapa)
              const pct   = clientes.length ? Math.round((count / clientes.length) * 100) : 0
              return (
                <div key={etapa} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium w-24 text-center flex-shrink-0 ${ETAPA_COLORS[etapa]}`}>{ETAPA_LABELS[etapa]}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${etapa==='nuevo'?'bg-blue-400':etapa==='contactado'?'bg-amber-400':etapa==='cotizacion'?'bg-purple-400':'bg-emerald-400'}`}
                      style={{width:`${pct}%`}}/>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-8 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Próximas renovaciones</h2>
            <Link href="/renovaciones" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3"/>
            </Link>
          </div>
          {[...renovaciones30, ...renovaciones60].length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 opacity-30"/>
              <p className="text-sm">Sin renovaciones próximas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...renovaciones30, ...renovaciones60].slice(0,5).map(p => {
                const days = daysUntil(p.fecha_fin!)
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{(p as any).cliente?.nombre || '—'}</p>
                      <p className="text-xs text-slate-500">{p.aseguradora} · {p.ramo}</p>
                    </div>
                    <div className="flex flex-col items-end ml-3">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${days<=15?'bg-red-100 text-red-700':days<=30?'bg-amber-100 text-amber-700':'bg-blue-100 text-blue-700'}`}>
                        <Clock className="w-3 h-3"/>{days}d
                      </span>
                      {p.prima_neta && <span className="text-xs text-slate-400 mt-1">{formatCOP(p.prima_neta)}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Fila 4: Cumpleaños + Siniestros + Tareas ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
            <Cake className="w-4 h-4 text-pink-500"/> Cumpleaños
            <span className="text-xs text-slate-400 font-normal ml-1">próximos 5 días</span>
          </h2>
          {cumpleaños.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <Cake className="w-8 h-8 mx-auto mb-2 opacity-20"/>
              <p className="text-xs">Sin cumpleaños próximos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cumpleaños.map(c => {
                const fn = new Date(c.fecha_nacimiento!)
                const hoy = new Date()
                const esteAño = new Date(hoy.getFullYear(), fn.getMonth(), fn.getDate())
                if (esteAño < hoy) esteAño.setFullYear(hoy.getFullYear() + 1)
                const diff = Math.ceil((esteAño.getTime() - hoy.getTime()) / 86400000)
                return (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                    <Link href={`/clientes/${c.id}`} className="text-sm font-medium text-slate-800 hover:text-emerald-600 truncate">{c.nombre}</Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${diff===0?'bg-pink-100 text-pink-700':'bg-slate-100 text-slate-600'}`}>
                      {diff===0 ? '¡Hoy!' : `en ${diff}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-500"/> Siniestros pendientes
            </h2>
            <Link href="/siniestros" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver <ChevronRight className="w-3 h-3"/>
            </Link>
          </div>
          <div className="text-center py-4">
            <p className={`text-5xl font-bold ${siniestrosPendientes > 0 ? 'text-orange-500' : 'text-slate-200'}`}>
              {siniestrosPendientes}
            </p>
            <p className="text-sm text-slate-400 mt-2">sin finalizar</p>
          </div>
        </div>

        {can('dashboard_ver_propias') && (
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-blue-500"/> Tareas
              </h2>
              <Link href="/tareas" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                Ver <ChevronRight className="w-3 h-3"/>
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Vencidas', value: tareasVencidas, cls: tareasVencidas>0?'bg-red-50 border border-red-200 text-red-700':'bg-slate-50 border border-slate-200 text-slate-400' },
                { label: 'Hoy',      value: tareasHoy,      cls: tareasHoy>0    ?'bg-amber-50 border border-amber-200 text-amber-700':'bg-slate-50 border border-slate-200 text-slate-400' },
                { label: 'Mañana',   value: tareasMañana,   cls: 'bg-slate-50 border border-slate-200 text-slate-600' },
              ].map(t => (
                <div key={t.label} className={`${t.cls} rounded-lg p-2 text-center`}>
                  <p className="text-2xl font-bold">{t.value}</p>
                  <p className="text-xs font-medium mt-0.5">{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Fila 5: Últimos clientes ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Últimos clientes registrados</h2>
          <Link href="/clientes" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
            Ver todos <ChevronRight className="w-3 h-3"/>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Ciudad</th>
                <th className="pb-2 font-medium">Etapa</th>
                <th className="pb-2 font-medium hidden md:table-cell">Categoría</th>
                <th className="pb-2 font-medium hidden sm:table-cell">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {clientes.slice(0,5).map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-slate-800 hover:text-emerald-600">{c.nombre}</Link>
                  </td>
                  <td className="py-2.5 text-slate-500 hidden sm:table-cell">{c.ciudad || '—'}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLORS[c.etapa]}`}>{ETAPA_LABELS[c.etapa]}</span>
                  </td>
                  <td className="py-2.5 hidden md:table-cell">
                    {c.categoria
                      ? <span className="text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{c.categoria}</span>
                      : <span className="text-slate-300 text-xs">—</span>
                    }
                  </td>
                  <td className="py-2.5 text-slate-500 hidden sm:table-cell">{c.telefono || '—'}</td>
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

function MetricCard({ icon, label, value, bg, href, color, urgent }: {
  icon: React.ReactNode; label: string; value: number
  bg: string; href: string; color: string; urgent?: boolean
}) {
  return (
    <Link href={href} className={`${bg} rounded-xl p-4 border ${urgent?'border-amber-300':'border-transparent'} hover:shadow-sm transition-shadow block`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1 font-medium">{label}</p>
    </Link>
  )
}

function FinCard({ icon, label, value, sub, bg, href, color, urgent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string
  bg: string; href: string; color: string; urgent?: boolean
}) {
  return (
    <Link href={href} className={`${bg} rounded-xl p-4 border ${urgent?'border-amber-300 bg-amber-50':'border-transparent'} hover:shadow-sm transition-shadow block`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className={`text-lg font-bold ${color} leading-tight`}>{value}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
      {sub && <p className={`text-xs mt-1 ${urgent?'text-amber-600 font-medium':'text-slate-400'}`}>{sub}</p>}
    </Link>
  )
}
