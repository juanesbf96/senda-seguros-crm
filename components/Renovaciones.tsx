'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, GestionRenovacion, EstadoGestion, CampanaRenovacion } from '@/types'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import {
  AlertTriangle, Clock, CheckCircle, Phone, ChevronDown, ChevronUp,
  MessageSquare, Check, Plus, Pencil, Trash2, X, ArchiveX,
  RefreshCw, Target, TrendingUp, Calendar, Filter,
} from 'lucide-react'
import Link from 'next/link'

/* ── Types ─────────────────────────────────────────────────── */
type PolizaConCliente = Poliza & {
  cliente: { id: string; nombre: string; telefono: string | null } | null
}

type MainTab = 'activas' | 'cerradas' | 'polizas'

/* ── Gestión config ─────────────────────────────────────────── */
const GESTION_CFG: Record<EstadoGestion, { label: string; cls: string }> = {
  pendiente:      { label: 'Pendiente',      cls: 'bg-cream-200 text-ink-500' },
  contactado:     { label: 'Contactado',     cls: 'bg-info/20 text-info' },
  en_negociacion: { label: 'En negociación', cls: 'bg-purple-100 text-purple-700' },
  renovado:       { label: 'Renovado ✓',    cls: 'bg-primary-100 text-primary-700' },
  no_renueva:     { label: 'No renueva',     cls: 'bg-error-soft text-error' },
}
const ESTADO_ORDER: EstadoGestion[] = ['pendiente', 'contactado', 'en_negociacion', 'renovado', 'no_renueva']

/* ── Shared helpers ─────────────────────────────────────────── */
const iCls = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white'

async function loadGestiones(polizaIds: string[]): Promise<Record<string, GestionRenovacion>> {
  if (!polizaIds.length) return {}
  const { data } = await supabase
    .from('gestiones_renovacion')
    .select('*')
    .in('poliza_id', polizaIds)
    .order('fecha', { ascending: false })
  const map: Record<string, GestionRenovacion> = {}
  for (const g of ((data || []) as GestionRenovacion[])) {
    if (!map[g.poliza_id]) map[g.poliza_id] = g
  }
  return map
}

/* ── PolicyRow ──────────────────────────────────────────────── */
function PolicyRow({
  p, gestion, savingId,
  onChangeEstado, onChangeNota, notaDraft,
}: {
  p: PolizaConCliente
  gestion: GestionRenovacion | undefined
  savingId: string | null
  onChangeEstado: (polizaId: string, estado: EstadoGestion) => void
  onChangeNota: (polizaId: string, nota: string) => void
  notaDraft: string
}) {
  const [expanded, setExpanded] = useState(false)
  const days = daysUntil(p.fecha_fin!)
  const isUrgent = days <= 15
  const isWarn   = days > 15 && days <= 30
  const estadoActual = gestion?.estado || 'pendiente'

  return (
    <div className={`bg-white rounded-xl border transition-colors ${
      isUrgent ? 'border-error/50' : isWarn ? 'border-warning/40' : 'border-ink-200'
    }`}>
      <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isUrgent ? 'bg-error-soft' : isWarn ? 'bg-warning-soft' : 'bg-info/20'
          }`}>
            <span className={`text-sm font-bold ${
              isUrgent ? 'text-error' : isWarn ? 'text-ink-700' : 'text-info'
            }`}>{days}d</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {p.cliente
                ? <Link href={`/clientes/${p.cliente.id}`} className="font-semibold text-ink-700 hover:text-primary-500">{p.cliente.nombre}</Link>
                : <span className="font-semibold text-ink-700">—</span>}
              <span className="text-ink-400 text-sm">·</span>
              <span className="text-sm text-ink-500">{p.aseguradora}</span>
              <span className="text-sm text-ink-400">{p.ramo}</span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-ink-400">Vence: {formatDate(p.fecha_fin)}</span>
              {p.prima_neta && <span className="text-xs text-ink-400">Prima neta: {formatCOP(p.prima_neta)}</span>}
              {p.numero_poliza && <span className="text-xs text-ink-400">N°: {p.numero_poliza}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${GESTION_CFG[estadoActual].cls}`}>
            {GESTION_CFG[estadoActual].label}
          </span>
          {p.cliente?.telefono && (
            <a href={`tel:${p.cliente.telefono}`}
              className="flex items-center gap-1 text-xs text-primary-700 bg-primary-50 border border-primary-200 px-2.5 py-1.5 rounded-lg hover:bg-primary-100 transition-colors">
              <Phone className="w-3.5 h-3.5" /> {p.cliente.telefono}
            </a>
          )}
          <button onClick={() => setExpanded(e => !e)}
            className="text-ink-400 hover:text-ink-600 p-1.5 rounded-lg hover:bg-cream-200">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-cream-200 p-4 bg-cream-100/50 rounded-b-xl">
          <p className="text-xs font-medium text-ink-400 mb-3">Actualizar gestión</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {ESTADO_ORDER.map(estado => (
              <button key={estado}
                disabled={savingId === p.id || estadoActual === estado}
                onClick={() => onChangeEstado(p.id, estado)}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  estadoActual === estado
                    ? `${GESTION_CFG[estado].cls} border-transparent cursor-default`
                    : 'bg-white border-ink-200 text-ink-500 hover:border-primary-400 hover:text-primary-700',
                ].join(' ')}>
                {estadoActual === estado && <Check className="w-3 h-3" />}
                {GESTION_CFG[estado].label}
              </button>
            ))}
          </div>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-2.5 w-3.5 h-3.5 text-ink-400" />
            <input
              value={notaDraft}
              onChange={e => onChangeNota(p.id, e.target.value)}
              placeholder="Nota sobre la gestión (opcional)..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
            />
          </div>
          {gestion?.notas && (
            <p className="text-xs text-ink-400 mt-2 italic">Última nota: {gestion.notas}</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── CampanaModal ───────────────────────────────────────────── */
interface CampanaForm {
  nombre: string
  descripcion: string
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  aseguradora: string
  ramo: string
  notas: string
}

const EMPTY_FORM: CampanaForm = {
  nombre: '', descripcion: '', fecha_inicio_periodo: '', fecha_fin_periodo: '',
  aseguradora: '', ramo: '', notas: '',
}

function CampanaModal({ editing, onSave, onClose }: {
  editing: CampanaRenovacion | null
  onSave: (data: CampanaForm) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<CampanaForm>(
    editing
      ? {
          nombre: editing.nombre,
          descripcion: editing.descripcion || '',
          fecha_inicio_periodo: editing.fecha_inicio_periodo,
          fecha_fin_periodo: editing.fecha_fin_periodo,
          aseguradora: editing.aseguradora || '',
          ramo: editing.ramo || '',
          notas: editing.notas || '',
        }
      : EMPTY_FORM
  )
  const [saving, setSaving] = useState(false)

  function set(k: keyof CampanaForm, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function submit() {
    if (!form.nombre.trim() || !form.fecha_inicio_periodo || !form.fecha_fin_periodo) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const valid = !!form.nombre.trim() && !!form.fecha_inicio_periodo && !!form.fecha_fin_periodo

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-cream-200">
          <div>
            <h2 className="font-bold text-ink-700">{editing ? 'Editar campaña' : 'Nueva campaña'}</h2>
            <p className="text-xs text-ink-400 mt-0.5">Define el período de vencimiento que cubre esta campaña</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500 p-1.5 rounded-lg hover:bg-cream-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">Nombre de la campaña *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              className={iCls} placeholder="Ej: Renovaciones Q2 2025, Vida - Junio..." autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">Inicio del período *</label>
              <input type="date" value={form.fecha_inicio_periodo}
                onChange={e => set('fecha_inicio_periodo', e.target.value)} className={iCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">Fin del período *</label>
              <input type="date" value={form.fecha_fin_periodo}
                onChange={e => set('fecha_fin_periodo', e.target.value)} className={iCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">Aseguradora (filtro opcional)</label>
              <input value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)}
                className={iCls} placeholder="Todas" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">Ramo (filtro opcional)</label>
              <input value={form.ramo} onChange={e => set('ramo', e.target.value)}
                className={iCls} placeholder="Todos" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">Descripción</label>
            <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              className={iCls} placeholder="Descripción opcional de la campaña..." />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">Notas internas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2}
              className={iCls + ' resize-none'} placeholder="Notas de seguimiento o instrucciones para el equipo..." />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 pb-5">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-ink-500 border border-ink-200 rounded-lg hover:bg-cream-100">
            Cancelar
          </button>
          <button onClick={submit} disabled={!valid || saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-500 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 font-medium">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {editing ? 'Guardar cambios' : 'Crear campaña'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── CampanaCard ────────────────────────────────────────────── */
function CampanaCard({
  campana, onEdit, onCerrar, onReactivar, onDelete,
}: {
  campana: CampanaRenovacion
  onEdit: (c: CampanaRenovacion) => void
  onCerrar: (id: string) => void
  onReactivar: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { currentWorkspace } = useWorkspace()
  const [expanded, setExpanded]   = useState(false)
  const [polizas, setPolizas]     = useState<PolizaConCliente[]>([])
  const [gestiones, setGestiones] = useState<Record<string, GestionRenovacion>>({})
  const [loadingP, setLoadingP]   = useState(false)
  const [savingId, setSavingId]   = useState<string | null>(null)
  const [notas, setNotas]         = useState<Record<string, string>>({})
  const loaded = polizas.length > 0 || loadingP

  async function toggleExpand() {
    if (!expanded && !loaded) {
      setLoadingP(true)
      let q = supabase
        .from('polizas')
        .select('*, cliente:clientes(id, nombre, telefono)')
        .eq('estado', 'activa')
        .eq('eliminada', false)
        .gte('fecha_fin', campana.fecha_inicio_periodo)
        .lte('fecha_fin', campana.fecha_fin_periodo)
        .order('fecha_fin', { ascending: true })
      if (campana.aseguradora) q = q.ilike('aseguradora', `%${campana.aseguradora}%`)
      if (campana.ramo)        q = q.ilike('ramo', `%${campana.ramo}%`)
      const { data } = await q
      const pols = (data || []) as PolizaConCliente[]
      const gest = await loadGestiones(pols.map(p => p.id))
      setPolizas(pols)
      setGestiones(gest)
      setLoadingP(false)
    }
    setExpanded(e => !e)
  }

  async function changeEstado(polizaId: string, estado: EstadoGestion) {
    setSavingId(polizaId)
    const nota = notas[polizaId]?.trim() || null
    await supabase.from('gestiones_renovacion').insert({ poliza_id: polizaId, estado, notas: nota, workspace_id: currentWorkspace?.id })
    setGestiones(prev => ({
      ...prev,
      [polizaId]: { id: '', poliza_id: polizaId, estado, notas: nota, fecha: new Date().toISOString() },
    }))
    setNotas(prev => ({ ...prev, [polizaId]: '' }))
    setSavingId(null)
  }

  // Stats
  const total    = polizas.length
  const prima    = polizas.reduce((s, p) => s + (p.prima_neta || p.prima || 0), 0)
  const renovadas = polizas.filter(p => gestiones[p.id]?.estado === 'renovado').length
  const noRen    = polizas.filter(p => gestiones[p.id]?.estado === 'no_renueva').length
  const pct      = total > 0 ? Math.round((renovadas / total) * 100) : 0
  const isActiva = campana.estado === 'activa'

  const urgente  = polizas.filter(p => daysUntil(p.fecha_fin!) <= 15).length
  const diasLeft = daysUntil(campana.fecha_fin_periodo)

  return (
    <div className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
      isActiva ? 'border-primary-200' : 'border-ink-200 opacity-80'
    }`}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                isActiva
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-cream-200 text-ink-400 border-ink-200'
              }`}>
                {isActiva ? 'Activa' : 'Cerrada'}
              </span>
              <h3 className="font-bold text-ink-700">{campana.nombre}</h3>
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-ink-400">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(campana.fecha_inicio_periodo)} → {formatDate(campana.fecha_fin_periodo)}
              </span>
              {campana.aseguradora && (
                <span className="text-xs text-ink-400 bg-cream-200 px-2 py-0.5 rounded">
                  {campana.aseguradora}
                </span>
              )}
              {campana.ramo && (
                <span className="text-xs text-ink-400 bg-cream-200 px-2 py-0.5 rounded">
                  {campana.ramo}
                </span>
              )}
              {isActiva && diasLeft >= 0 && (
                <span className={`text-xs font-medium ${diasLeft <= 10 ? 'text-error' : 'text-ink-400'}`}>
                  {diasLeft === 0 ? 'Vence hoy' : `Período cierra en ${diasLeft}d`}
                </span>
              )}
            </div>

            {campana.descripcion && (
              <p className="text-xs text-ink-400 mt-1.5">{campana.descripcion}</p>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onEdit(campana)}
              className="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-cream-200 rounded-lg">
              <Pencil className="w-4 h-4" />
            </button>
            {isActiva
              ? <button onClick={() => onCerrar(campana.id)}
                  title="Cerrar campaña"
                  className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-warning-soft rounded-lg">
                  <ArchiveX className="w-4 h-4" />
                </button>
              : <button onClick={() => onReactivar(campana.id)}
                  title="Reactivar campaña"
                  className="p-1.5 text-ink-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </button>
            }
            <button onClick={() => onDelete(campana.id)}
              className="p-1.5 text-ink-400 hover:text-error hover:bg-error-soft rounded-lg">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats row (only when loaded) */}
        {loaded && !loadingP && (
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="bg-cream-100 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-ink-700">{total}</p>
              <p className="text-xs text-ink-400">Pólizas</p>
            </div>
            <div className="bg-cream-100 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-primary-700">{renovadas}</p>
              <p className="text-xs text-ink-400">Renovadas</p>
            </div>
            <div className="bg-cream-100 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-error">{noRen}</p>
              <p className="text-xs text-ink-400">No renuevan</p>
            </div>
            {urgente > 0 && (
              <div className="bg-error-soft rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold text-error">{urgente}</p>
                <p className="text-xs text-error">≤15 días</p>
              </div>
            )}
            {urgente === 0 && (
              <div className="bg-cream-100 rounded-lg p-2.5 text-center">
                <p className="text-xs font-bold text-ink-600">{formatCOP(prima)}</p>
                <p className="text-xs text-ink-400">Prima neta</p>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {loaded && !loadingP && total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-ink-400 mb-1">
              <span>{pct}% renovadas</span>
              <span>{formatCOP(prima)} prima total</span>
            </div>
            <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Toggle policies */}
      <div className="border-t border-cream-200">
        <button onClick={toggleExpand}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-ink-400 hover:text-primary-500 hover:bg-primary-50 transition-colors">
          {loadingP
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cargando pólizas...</>
            : expanded
            ? <><ChevronUp className="w-3.5 h-3.5" /> Ocultar pólizas</>
            : <><ChevronDown className="w-3.5 h-3.5" /> Ver pólizas ({total > 0 ? total : '…'})</>
          }
        </button>
      </div>

      {expanded && !loadingP && (
        <div className="border-t border-cream-200 bg-cream-100/50 p-4">
          {polizas.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-8 h-8 text-ink-300 mx-auto mb-2" />
              <p className="text-sm text-ink-400">No hay pólizas activas que venzan en este período</p>
              {(campana.aseguradora || campana.ramo) && (
                <p className="text-xs text-ink-400 mt-1">Filtros aplicados: {[campana.aseguradora, campana.ramo].filter(Boolean).join(' · ')}</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {polizas.map(p => (
                <PolicyRow
                  key={p.id}
                  p={p}
                  gestion={gestiones[p.id]}
                  savingId={savingId}
                  onChangeEstado={changeEstado}
                  onChangeNota={(id, nota) => setNotas(prev => ({ ...prev, [id]: nota }))}
                  notaDraft={notas[p.id] || ''}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Polizas60View ──────────────────────────────────────────── */
function Polizas60View() {
  const { currentWorkspace } = useWorkspace()
  const [polizas, setPolizas]     = useState<PolizaConCliente[]>([])
  const [gestiones, setGestiones] = useState<Record<string, GestionRenovacion>>({})
  const [loading, setLoading]     = useState(true)
  const [savingId, setSavingId]   = useState<string | null>(null)
  const [notas, setNotas]         = useState<Record<string, string>>({})
  const [filterEstado, setFilter] = useState<EstadoGestion | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const in60  = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data } = await supabase
      .from('polizas')
      .select('*, cliente:clientes(id, nombre, telefono)')
      .eq('estado', 'activa')
      .eq('eliminada', false)
      .gte('fecha_fin', today)
      .lte('fecha_fin', in60)
      .order('fecha_fin', { ascending: true })
    const pols = (data || []) as PolizaConCliente[]
    const gest = await loadGestiones(pols.map(p => p.id))
    setPolizas(pols)
    setGestiones(gest)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function changeEstado(polizaId: string, estado: EstadoGestion) {
    setSavingId(polizaId)
    const nota = notas[polizaId]?.trim() || null
    await supabase.from('gestiones_renovacion').insert({ poliza_id: polizaId, estado, notas: nota, workspace_id: currentWorkspace?.id })
    setGestiones(prev => ({
      ...prev,
      [polizaId]: { id: '', poliza_id: polizaId, estado, notas: nota, fecha: new Date().toISOString() },
    }))
    setNotas(prev => ({ ...prev, [polizaId]: '' }))
    setSavingId(null)
  }

  const urgente   = polizas.filter(p => daysUntil(p.fecha_fin!) <= 15).length
  const prox30    = polizas.filter(p => { const d = daysUntil(p.fecha_fin!); return d > 15 && d <= 30 }).length
  const prox60    = polizas.filter(p => daysUntil(p.fecha_fin!) > 30).length
  const filtered  = polizas.filter(p => filterEstado === 'all' || (gestiones[p.id]?.estado || 'pendiente') === filterEstado)

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-error-soft border border-error/30 rounded-xl p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-error mx-auto mb-1" />
          <p className="text-2xl font-bold text-error">{urgente}</p>
          <p className="text-xs text-error">0 – 15 días</p>
        </div>
        <div className="bg-warning-soft border border-warning/30 rounded-xl p-4 text-center">
          <Clock className="w-6 h-6 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-ink-700">{prox30}</p>
          <p className="text-xs text-ink-700">16 – 30 días</p>
        </div>
        <div className="bg-info/10 border border-info/30 rounded-xl p-4 text-center">
          <CheckCircle className="w-6 h-6 text-info mx-auto mb-1" />
          <p className="text-2xl font-bold text-info">{prox60}</p>
          <p className="text-xs text-info">31 – 60 días</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-ink-400" />
        <select value={filterEstado} onChange={e => setFilter(e.target.value as EstadoGestion | 'all')}
          className="px-3 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
          <option value="all">Todos los estados</option>
          {ESTADO_ORDER.map(e => <option key={e} value={e}>{GESTION_CFG[e].label}</option>)}
        </select>
        <span className="text-xs text-ink-400 ml-1">{filtered.length} de {polizas.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-ink-300">
          <CheckCircle className="w-12 h-12 text-primary-400 mx-auto mb-3" />
          <p className="font-medium text-ink-500">No hay renovaciones próximas</p>
          <p className="text-sm text-ink-400 mt-1">Todas las pólizas activas vencen después de 60 días</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <PolicyRow
              key={p.id}
              p={p}
              gestion={gestiones[p.id]}
              savingId={savingId}
              onChangeEstado={changeEstado}
              onChangeNota={(id, nota) => setNotas(prev => ({ ...prev, [id]: nota }))}
              notaDraft={notas[p.id] || ''}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main Component ─────────────────────────────────────────── */
export default function Renovaciones() {
  const { currentWorkspace } = useWorkspace()
  const [tab, setTab]               = useState<MainTab>('activas')
  const [campanas, setCampanas]     = useState<CampanaRenovacion[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editingC, setEditingC]     = useState<CampanaRenovacion | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('campanas_renovacion')
      .select('*')
      .order('created_at', { ascending: false })
    setCampanas((data || []) as CampanaRenovacion[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function saveCampana(form: CampanaForm) {
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha_inicio_periodo: form.fecha_inicio_periodo,
      fecha_fin_periodo: form.fecha_fin_periodo,
      aseguradora: form.aseguradora.trim() || null,
      ramo: form.ramo.trim() || null,
      notas: form.notas.trim() || null,
    }
    if (editingC) {
      await supabase.from('campanas_renovacion').update(payload).eq('id', editingC.id)
    } else {
      await supabase.from('campanas_renovacion').insert({ ...payload, estado: 'activa', workspace_id: currentWorkspace?.id })
    }
    setShowModal(false)
    setEditingC(null)
    load()
  }

  async function cerrarCampana(id: string) {
    if (!confirm('¿Cerrar esta campaña? Podrás reactivarla luego.')) return
    await supabase.from('campanas_renovacion').update({ estado: 'cerrada' }).eq('id', id)
    setCampanas(prev => prev.map(c => c.id === id ? { ...c, estado: 'cerrada' } : c))
  }

  async function reactivarCampana(id: string) {
    await supabase.from('campanas_renovacion').update({ estado: 'activa' }).eq('id', id)
    setCampanas(prev => prev.map(c => c.id === id ? { ...c, estado: 'activa' } : c))
  }

  async function deleteCampana(id: string) {
    if (!confirm('¿Eliminar esta campaña permanentemente? No se eliminarán las pólizas ni gestiones.')) return
    await supabase.from('campanas_renovacion').delete().eq('id', id)
    setCampanas(prev => prev.filter(c => c.id !== id))
  }

  const activas  = campanas.filter(c => c.estado === 'activa')
  const cerradas = campanas.filter(c => c.estado === 'cerrada')

  const TABS = [
    { key: 'activas'  as MainTab, label: 'Activas',           count: activas.length  },
    { key: 'cerradas' as MainTab, label: 'Cerradas',          count: cerradas.length },
    { key: 'polizas'  as MainTab, label: 'Pólizas por vencer', count: null            },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ink-700 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary-500" /> Renovaciones
          </h1>
          <p className="text-ink-400 text-sm mt-1">
            Gestión de campañas y seguimiento de pólizas próximas a vencer
          </p>
        </div>
        <button
          onClick={() => { setEditingC(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nueva campaña
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-ink-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}>
            {t.label}
            {t.count !== null && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                tab === t.key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && tab !== 'polizas' ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : tab === 'polizas' ? (
        <Polizas60View />
      ) : (
        <>
          {(tab === 'activas' ? activas : cerradas).length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-ink-300">
              <Target className="w-12 h-12 text-ink-300 mx-auto mb-3" />
              <p className="font-medium text-ink-500">
                {tab === 'activas' ? 'No hay campañas activas' : 'No hay campañas cerradas'}
              </p>
              {tab === 'activas' && (
                <p className="text-sm text-ink-400 mt-1">
                  Crea una campaña para organizar y hacer seguimiento de las renovaciones por período
                </p>
              )}
              {tab === 'activas' && (
                <button onClick={() => { setEditingC(null); setShowModal(true) }}
                  className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-primary-500 hover:bg-primary-700 text-white rounded-lg text-sm font-medium">
                  <Plus className="w-4 h-4" /> Nueva campaña
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {(tab === 'activas' ? activas : cerradas).map(c => (
                <CampanaCard
                  key={c.id}
                  campana={c}
                  onEdit={(camp) => { setEditingC(camp); setShowModal(true) }}
                  onCerrar={cerrarCampana}
                  onReactivar={reactivarCampana}
                  onDelete={deleteCampana}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <CampanaModal
          editing={editingC}
          onSave={saveCampana}
          onClose={() => { setShowModal(false); setEditingC(null) }}
        />
      )}
    </div>
  )
}
