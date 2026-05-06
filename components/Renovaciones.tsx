'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, GestionRenovacion, EstadoGestion } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import { AlertTriangle, Clock, CheckCircle, Phone, ChevronDown, ChevronUp, MessageSquare, Check } from 'lucide-react'
import Link from 'next/link'

type PolizaConCliente = Poliza & {
  cliente: { id: string; nombre: string; telefono: string | null } | null
}

const GESTION_CONFIG: Record<EstadoGestion, { label: string; cls: string }> = {
  pendiente:       { label: 'Pendiente',       cls: 'bg-slate-100 text-slate-600' },
  contactado:      { label: 'Contactado',      cls: 'bg-blue-100 text-blue-700' },
  en_negociacion:  { label: 'En negociación',  cls: 'bg-purple-100 text-purple-700' },
  renovado:        { label: 'Renovado ✓',      cls: 'bg-emerald-100 text-emerald-700' },
  no_renueva:      { label: 'No renueva',      cls: 'bg-red-100 text-red-600' },
}

const ESTADO_ORDER: EstadoGestion[] = ['pendiente', 'contactado', 'en_negociacion', 'renovado', 'no_renueva']

export default function Renovaciones() {
  const [polizas, setPolizas] = useState<PolizaConCliente[]>([])
  const [gestiones, setGestiones] = useState<Record<string, GestionRenovacion>>({}) // poliza_id → latest
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notasDraft, setNotasDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [filterEstado, setFilterEstado] = useState<EstadoGestion | 'all'>('all')

  const load = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const [{ data: pols }, { data: gest }] = await Promise.all([
      supabase
        .from('polizas')
        .select('*, cliente:clientes(id, nombre, telefono)')
        .eq('estado', 'activa')
        .eq('eliminada', false)
        .gte('fecha_fin', today)
        .lte('fecha_fin', in60)
        .order('fecha_fin', { ascending: true }),
      supabase
        .from('gestiones_renovacion')
        .select('*')
        .order('fecha', { ascending: false }),
    ])
    setPolizas((pols as PolizaConCliente[]) || [])
    // Keep only latest gestion per poliza
    const map: Record<string, GestionRenovacion> = {}
    for (const g of ((gest || []) as GestionRenovacion[])) {
      if (!map[g.poliza_id]) map[g.poliza_id] = g
    }
    setGestiones(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function setEstado(polizaId: string, estado: EstadoGestion) {
    setSaving(polizaId)
    const notas = notasDraft[polizaId]?.trim() || null
    await supabase.from('gestiones_renovacion').insert({ poliza_id: polizaId, estado, notas })
    setGestiones(prev => ({
      ...prev,
      [polizaId]: { id: '', poliza_id: polizaId, estado, notas, fecha: new Date().toISOString() },
    }))
    setNotasDraft(prev => ({ ...prev, [polizaId]: '' }))
    setSaving(null)
    setExpanded(null)
  }

  const urgente  = polizas.filter(p => daysUntil(p.fecha_fin!) <= 15)
  const proximo30 = polizas.filter(p => { const d = daysUntil(p.fecha_fin!); return d > 15 && d <= 30 })
  const proximo60 = polizas.filter(p => daysUntil(p.fecha_fin!) > 30)

  const filtered = polizas.filter(p => {
    const gestion = gestiones[p.id]?.estado || 'pendiente'
    return filterEstado === 'all' || gestion === filterEstado
  })

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestor de Renovaciones</h1>
          <p className="text-slate-500 text-sm mt-1">Pólizas activas que vencen en los próximos 60 días</p>
        </div>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as EstadoGestion | 'all')}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="all">Todos los estados</option>
          {ESTADO_ORDER.map(e => <option key={e} value={e}>{GESTION_CONFIG[e].label}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-700">{urgente.length}</p>
          <p className="text-xs text-red-600">0 – 15 días</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{proximo30.length}</p>
          <p className="text-xs text-amber-600">16 – 30 días</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <CheckCircle className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-700">{proximo60.length}</p>
          <p className="text-xs text-blue-600">31 – 60 días</p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="font-medium text-slate-600">No hay renovaciones próximas</p>
          <p className="text-sm text-slate-400 mt-1">Todas las pólizas activas vencen después de 60 días</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const days = daysUntil(p.fecha_fin!)
            const isUrgent = days <= 15
            const isWarn = days > 15 && days <= 30
            const gestion = gestiones[p.id]
            const estadoActual = gestion?.estado || 'pendiente'
            const isExpanded = expanded === p.id
            const isSaving = saving === p.id

            return (
              <div key={p.id} className={`bg-white rounded-xl border transition-colors ${
                isUrgent ? 'border-red-300' : isWarn ? 'border-amber-300' : 'border-slate-200'
              }`}>
                {/* Main row */}
                <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isUrgent ? 'bg-red-100' : isWarn ? 'bg-amber-100' : 'bg-blue-100'
                    }`}>
                      <span className={`text-sm font-bold ${isUrgent ? 'text-red-700' : isWarn ? 'text-amber-700' : 'text-blue-700'}`}>
                        {days}d
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {p.cliente
                          ? <Link href={`/clientes/${p.cliente.id}`} className="font-semibold text-slate-800 hover:text-emerald-600">{p.cliente.nombre}</Link>
                          : <span className="font-semibold text-slate-800">—</span>}
                        <span className="text-slate-400 text-sm">·</span>
                        <span className="text-sm text-slate-600">{p.aseguradora}</span>
                        <span className="text-sm text-slate-400">{p.ramo}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">Vence: {formatDate(p.fecha_fin)}</span>
                        {p.prima && <span className="text-xs text-slate-500">Prima: {formatCOP(p.prima)}</span>}
                        {p.numero_poliza && <span className="text-xs text-slate-400">N°: {p.numero_poliza}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${GESTION_CONFIG[estadoActual].cls}`}>
                      {GESTION_CONFIG[estadoActual].label}
                    </span>
                    {p.cliente?.telefono && (
                      <a href={`tel:${p.cliente.telefono}`}
                        className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                        <Phone className="w-3.5 h-3.5" />
                        {p.cliente.telefono}
                      </a>
                    )}
                    <button onClick={() => setExpanded(isExpanded ? null : p.id)}
                      className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-lg hover:bg-slate-100">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded: gestión panel */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-xl">
                    <p className="text-xs font-medium text-slate-500 mb-3">Actualizar gestión</p>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {ESTADO_ORDER.map(estado => (
                        <button key={estado} disabled={isSaving || estadoActual === estado}
                          onClick={() => setEstado(p.id, estado)}
                          className={[
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                            estadoActual === estado
                              ? `${GESTION_CONFIG[estado].cls} border-transparent cursor-default`
                              : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700',
                          ].join(' ')}>
                          {estadoActual === estado && <Check className="w-3 h-3" />}
                          {GESTION_CONFIG[estado].label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <MessageSquare className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                          value={notasDraft[p.id] || ''}
                          onChange={e => setNotasDraft(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Nota sobre la gestión (opcional)..."
                          className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                        />
                      </div>
                    </div>
                    {gestion?.notas && (
                      <p className="text-xs text-slate-400 mt-2 italic">Última nota: {gestion.notas}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
