'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Plus, Search, Pencil, Trash2, TrendingUp, Target, X, ChevronDown,
  Users, Briefcase, DollarSign, Clock, Car, Filter,
} from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────────────── */
interface Prospecto {
  id: string
  nombre: string
  empresa: string | null
  email: string | null
  telefono: string | null
  ciudad: string | null
  fuente: string | null
  etapa: string
  ramo_interes: string | null
  valor_estimado: number | null
  asignado_a: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

interface PolizaSOAT {
  id: string
  client_id: string
  numero_poliza: string | null
  aseguradora: string
  ramo: string
  riesgo: string | null
  fecha_fin: string | null
  prima_neta: number | null
  estado: string
  cliente?: { nombre: string } | null
}

type SubTab = 'prospectos' | 'gestion' | 'soat'

/* ── Constants ────────────────────────────────────────────────────────── */
const ETAPA_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  calificado: 'Calificado',
  propuesta: 'Propuesta',
  cerrado_ganado: 'Cerrado ganado',
  cerrado_perdido: 'Cerrado perdido',
}

const ETAPA_COLORS: Record<string, string> = {
  nuevo: 'bg-info/20 text-info',
  contactado: 'bg-sky-100 text-info',
  calificado: 'bg-violet-100 text-violet-700',
  propuesta: 'bg-warning-soft text-ink-700',
  cerrado_ganado: 'bg-primary-100 text-primary-700',
  cerrado_perdido: 'bg-error-soft text-error',
}

const FUENTE_LABELS: Record<string, string> = {
  referido: 'Referido', web: 'Web', llamada: 'Llamada',
  red_social: 'Red social', evento: 'Evento', otro: 'Otro',
}

const PIE_COLORS = ['#3b82f6','#0ea5e9','#8b5cf6','#f59e0b','#10b981','#ef4444']

/* ── ProspectosTab ────────────────────────────────────────────────────── */
function ProspectosTab() {
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEtapa, setFilterEtapa] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Prospecto | null>(null)

  async function load() {
    const { data } = await supabase
      .from('prospectos')
      .select('*')
      .order('created_at', { ascending: false })
    setProspectos(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteProspecto(id: string) {
    if (!confirm('¿Eliminar este prospecto?')) return
    await supabase.from('prospectos').delete().eq('id', id)
    setProspectos(prev => prev.filter(p => p.id !== id))
  }

  const filtered = prospectos.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(q) ||
      p.empresa?.toLowerCase().includes(q) ||
      p.asignado_a?.toLowerCase().includes(q) ||
      p.ramo_interes?.toLowerCase().includes(q)
    const matchEtapa = filterEtapa === 'all' || p.etapa === filterEtapa
    return matchSearch && matchEtapa
  })

  // Stats
  const totalValor = prospectos.reduce((s, p) => s + (p.valor_estimado || 0), 0)
  const ganados = prospectos.filter(p => p.etapa === 'cerrado_ganado')
  const valorGanado = ganados.reduce((s, p) => s + (p.valor_estimado || 0), 0)
  const tasa = prospectos.length ? Math.round((ganados.length / prospectos.length) * 100) : 0

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <Briefcase className="w-4 h-4 text-info"/>, label: 'Total negocios', value: prospectos.length, sub: 'en pipeline', bg: 'bg-info/10' },
          { icon: <DollarSign className="w-4 h-4 text-primary-500"/>, label: 'Valor pipeline', value: formatCOP(totalValor), sub: 'estimado total', bg: 'bg-primary-50' },
          { icon: <Target className="w-4 h-4 text-violet-600"/>, label: 'Ganados', value: ganados.length, sub: `${formatCOP(valorGanado)} ganado`, bg: 'bg-violet-50' },
          { icon: <TrendingUp className="w-4 h-4 text-ink-700"/>, label: 'Tasa cierre', value: `${tasa}%`, sub: 'de conversión', bg: 'bg-warning-soft' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 flex items-start gap-3`}>
            <div className="mt-0.5">{s.icon}</div>
            <div>
              <p className="text-xs text-ink-400 font-medium">{s.label}</p>
              <p className="text-xl font-bold text-ink-700 leading-tight">{s.value}</p>
              <p className="text-xs text-ink-400 mt-0.5">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar negocio, cliente, vendedor..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"/>
        </div>
        <select value={filterEtapa} onChange={e => setFilterEtapa(e.target.value)}
          className="text-sm border border-ink-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">Todas las etapas</option>
          {Object.entries(ETAPA_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4"/> Nuevo negocio
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
              <th className="px-4 py-3 font-medium w-12">N°</th>
              <th className="px-4 py-3 font-medium">Nombre negocio</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Cliente / Empresa</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Vendedor</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Ramo / Riesgo</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Monto est.</th>
              <th className="px-4 py-3 font-medium">Etapa</th>
              <th className="px-4 py-3 font-medium hidden xl:table-cell">Fuente</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, idx) => (
              <tr key={p.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                <td className="px-4 py-3 text-ink-400 font-mono text-xs">#{idx + 1}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-ink-700">{p.nombre}</span>
                  {p.notas && <p className="text-xs text-ink-400 truncate max-w-[180px]">{p.notas}</p>}
                </td>
                <td className="px-4 py-3 text-ink-500 hidden md:table-cell">{p.empresa || '—'}</td>
                <td className="px-4 py-3 text-ink-500 hidden lg:table-cell">{p.asignado_a || '—'}</td>
                <td className="px-4 py-3 text-ink-500 hidden md:table-cell">{p.ramo_interes || '—'}</td>
                <td className="px-4 py-3 text-ink-600 font-medium hidden lg:table-cell">
                  {p.valor_estimado ? formatCOP(p.valor_estimado) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLORS[p.etapa] || 'bg-cream-200 text-ink-500'}`}>
                    {ETAPA_LABELS[p.etapa] || p.etapa}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-400 text-xs hidden xl:table-cell">
                  {p.fuente ? FUENTE_LABELS[p.fuente] || p.fuente : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setEditing(p); setShowModal(true) }}
                      className="text-ink-400 hover:text-ink-600 transition-colors p-0.5">
                      <Pencil className="w-4 h-4"/>
                    </button>
                    <button onClick={() => deleteProspecto(p.id)}
                      className="text-ink-400 hover:text-error transition-colors p-0.5">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30"/>
            <p className="text-sm">No hay negocios registrados</p>
            <button onClick={() => { setEditing(null); setShowModal(true) }}
              className="mt-2 text-xs text-primary-500 hover:underline">
              Crear primer negocio
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <ProspectoModal
          prospecto={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

/* ── ProspectoModal ───────────────────────────────────────────────────── */
function ProspectoModal({ prospecto, onClose, onSaved }: {
  prospecto: Prospecto | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    nombre: prospecto?.nombre || '',
    empresa: prospecto?.empresa || '',
    email: prospecto?.email || '',
    telefono: prospecto?.telefono || '',
    ciudad: prospecto?.ciudad || '',
    fuente: prospecto?.fuente || '',
    etapa: prospecto?.etapa || 'nuevo',
    ramo_interes: prospecto?.ramo_interes || '',
    valor_estimado: prospecto?.valor_estimado ? String(prospecto.valor_estimado) : '',
    asignado_a: prospecto?.asignado_a || '',
    notas: prospecto?.notas || '',
  })
  const [saving, setSaving] = useState(false)

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      empresa: form.empresa || null,
      email: form.email || null,
      telefono: form.telefono || null,
      ciudad: form.ciudad || null,
      fuente: form.fuente || null,
      etapa: form.etapa,
      ramo_interes: form.ramo_interes || null,
      valor_estimado: form.valor_estimado ? Number(form.valor_estimado) : null,
      asignado_a: form.asignado_a || null,
      notas: form.notas || null,
    }
    if (prospecto) {
      await supabase.from('prospectos').update(payload).eq('id', prospecto.id)
    } else {
      await supabase.from('prospectos').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  const inp = 'w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-cream-200">
          <h2 className="font-semibold text-ink-700">{prospecto ? 'Editar negocio' : 'Nuevo negocio'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Nombre del negocio *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)} className={inp} placeholder="Ej: Renovación SOAT Flota XYZ"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Empresa / Cliente</label>
            <input value={form.empresa} onChange={e => set('empresa', e.target.value)} className={inp} placeholder="Nombre empresa"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Asignado a (vendedor)</label>
            <input value={form.asignado_a} onChange={e => set('asignado_a', e.target.value)} className={inp} placeholder="Nombre vendedor"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Ramo / Riesgo</label>
            <input value={form.ramo_interes} onChange={e => set('ramo_interes', e.target.value)} className={inp} placeholder="Ej: SOAT, Vida, ARL"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Monto estimado (COP)</label>
            <input type="number" value={form.valor_estimado} onChange={e => set('valor_estimado', e.target.value)} className={inp} placeholder="0"/>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Etapa</label>
            <select value={form.etapa} onChange={e => set('etapa', e.target.value)} className={inp}>
              {Object.entries(ETAPA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Fuente</label>
            <select value={form.fuente} onChange={e => set('fuente', e.target.value)} className={inp}>
              <option value="">— Seleccionar —</option>
              {Object.entries(FUENTE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Teléfono</label>
            <input value={form.telefono} onChange={e => set('telefono', e.target.value)} className={inp} placeholder="+57..."/>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inp} placeholder="correo@..."/>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Ciudad</label>
            <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)} className={inp} placeholder="Bogotá"/>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-ink-500 mb-1">Notas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={3} className={inp} placeholder="Observaciones..."/>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-500 hover:bg-cream-100 rounded-lg border border-ink-200 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !form.nombre.trim()}
            className="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            {saving ? 'Guardando...' : prospecto ? 'Guardar cambios' : 'Crear negocio'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── GestionTab ───────────────────────────────────────────────────────── */
function GestionTab() {
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('prospectos').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setProspectos(data || []); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"/>
    </div>
  )

  /* ── Chart data builders ── */

  // 1. Negocios por período (últimos 6 meses, ganados vs total)
  const byMonth: Record<string, { total: number; ganados: number; valor: number }> = {}
  prospectos.forEach(p => {
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = { total: 0, ganados: 0, valor: 0 }
    byMonth[key].total++
    if (p.etapa === 'cerrado_ganado') {
      byMonth[key].ganados++
      byMonth[key].valor += p.valor_estimado || 0
    }
  })
  const periodData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, v]) => {
      const [year, month] = key.split('-')
      const d = new Date(Number(year), Number(month) - 1)
      return {
        mes: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
        total: v.total, ganados: v.ganados, valor: v.valor,
      }
    })

  // 2. Promedio días gestión (para cerrados)
  const cerrados = prospectos.filter(p => p.etapa === 'cerrado_ganado' || p.etapa === 'cerrado_perdido')
  const diasGestion: Record<string, { dias: number[]; ganados: number; total: number }> = {}
  cerrados.forEach(p => {
    const mes = new Date(p.created_at).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
    if (!diasGestion[mes]) diasGestion[mes] = { dias: [], ganados: 0, total: 0 }
    const dias = Math.round((new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / 86400000)
    diasGestion[mes].dias.push(dias)
    diasGestion[mes].total++
    if (p.etapa === 'cerrado_ganado') diasGestion[mes].ganados++
  })
  const diasData = Object.entries(diasGestion).map(([mes, v]) => ({
    mes,
    promedio: v.dias.length ? Math.round(v.dias.reduce((a, b) => a + b, 0) / v.dias.length) : 0,
  }))

  // 3. Negocios por estado (pie)
  const byEtapa = Object.entries(ETAPA_LABELS).map(([k, v]) => ({
    name: v,
    value: prospectos.filter(p => p.etapa === k).length,
  })).filter(d => d.value > 0)

  // 4. Embudo de conversión (funnel usando barras horizontales)
  const etapasOrden = ['nuevo', 'contactado', 'calificado', 'propuesta', 'cerrado_ganado']
  const embudo = etapasOrden.map(e => ({
    name: ETAPA_LABELS[e],
    value: prospectos.filter(p => p.etapa === e).length,
  }))
  const maxEmbudo = embudo[0]?.value || 1

  const totalCerrados = prospectos.filter(p => p.etapa === 'cerrado_ganado' || p.etapa === 'cerrado_perdido').length
  const tasaConversion = prospectos.length ? Math.round((prospectos.filter(p => p.etapa === 'cerrado_ganado').length / prospectos.length) * 100) : 0
  const avgDias = diasGestion
    ? Object.values(diasGestion).flatMap(v => v.dias)
    : []
  const promedioDias = avgDias.length ? Math.round(avgDias.reduce((a, b) => a + b, 0) / avgDias.length) : 0

  if (prospectos.length === 0) return (
    <div className="text-center py-16 text-ink-400">
      <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-20"/>
      <p className="font-medium">Sin datos de gestión</p>
      <p className="text-sm mt-1">Crea negocios en la pestaña Prospectos para ver métricas</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total negocios', value: prospectos.length, color: 'text-ink-700', bg: 'bg-cream-100' },
          { label: 'Tasa conversión', value: `${tasaConversion}%`, color: tasaConversion >= 20 ? 'text-primary-700' : 'text-ink-700', bg: 'bg-warning-soft' },
          { label: 'Promedio días gestión', value: promedioDias ? `${promedioDias}d` : '—', color: 'text-info', bg: 'bg-info/10' },
          { label: 'Negocios cerrados', value: totalCerrados, color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className="text-xs text-ink-400 font-medium mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Negocios por período */}
        <div className="bg-white rounded-xl border border-ink-200 p-5">
          <h3 className="text-sm font-semibold text-ink-600 mb-4">Negocios vendidos por período</h3>
          {periodData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-ink-300 text-sm">Sin datos de período</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={periodData} barSize={18} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }}/>
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false}/>
                <Tooltip
                  formatter={(v, name) => [v, name === 'total' ? 'Total' : 'Ganados']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}/>
                <Bar dataKey="total" fill="#cbd5e1" name="total" radius={[3,3,0,0]}/>
                <Bar dataKey="ganados" fill="#10b981" name="ganados" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-ink-400"><span className="w-3 h-3 rounded-sm bg-ink-300 inline-block"/>Total creados</span>
            <span className="flex items-center gap-1.5 text-xs text-ink-400"><span className="w-3 h-3 rounded-sm bg-primary-500 inline-block"/>Ganados</span>
          </div>
        </div>

        {/* Promedio días gestión */}
        <div className="bg-white rounded-xl border border-ink-200 p-5">
          <h3 className="text-sm font-semibold text-ink-600 mb-4">Promedio días gestión comercial</h3>
          {diasData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-ink-300 text-sm">Sin negocios cerrados aún</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={diasData} barSize={22} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }}/>
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false}/>
                <Tooltip
                  formatter={(v) => [`${v} días`, 'Promedio gestión']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}/>
                <Bar dataKey="promedio" fill="#6366f1" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Negocios por estado */}
        <div className="bg-white rounded-xl border border-ink-200 p-5">
          <h3 className="text-sm font-semibold text-ink-600 mb-4">Negocios por estado</h3>
          {byEtapa.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-ink-300 text-sm">Sin datos</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie data={byEtapa} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" paddingAngle={2}>
                    {byEtapa.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]}/>
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 12 }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 min-w-0">
                {byEtapa.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}/>
                    <span className="text-ink-500 truncate flex-1">{d.name}</span>
                    <span className="font-semibold text-ink-700">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Embudo de conversión */}
        <div className="bg-white rounded-xl border border-ink-200 p-5">
          <h3 className="text-sm font-semibold text-ink-600 mb-4">Embudo de conversión</h3>
          <div className="space-y-2.5">
            {embudo.map((e, i) => {
              const pct = maxEmbudo > 0 ? Math.round((e.value / maxEmbudo) * 100) : 0
              const colors = ['bg-info/100', 'bg-info', 'bg-violet-500', 'bg-warning', 'bg-primary-500']
              return (
                <div key={e.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-500 font-medium">{e.name}</span>
                    <span className="text-ink-400">{e.value} <span className="text-ink-300">({pct}%)</span></span>
                  </div>
                  <div className="h-6 bg-cream-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${colors[i]}`}
                      style={{ width: `${pct}%` }}
                    >
                      {pct > 15 && (
                        <span className="text-white text-xs font-semibold pl-2 flex items-center h-full">{e.value}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {prospectos.filter(p => p.etapa === 'cerrado_perdido').length > 0 && (
            <div className="mt-3 pt-3 border-t border-cream-200">
              <div className="flex items-center gap-2 text-xs text-ink-400">
                <span className="w-2.5 h-2.5 rounded-full bg-error flex-shrink-0"/>
                <span>Perdidos:</span>
                <span className="font-semibold text-ink-600">{prospectos.filter(p => p.etapa === 'cerrado_perdido').length}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── SOATTab ──────────────────────────────────────────────────────────── */
function SOATTab() {
  const [polizas, setPolizas] = useState<PolizaSOAT[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDias, setFilterDias] = useState<30 | 60 | 90>(60)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const future = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
      const { data } = await supabase
        .from('polizas')
        .select('*, cliente:clientes(nombre)')
        .eq('eliminada', false)
        .ilike('ramo', '%soat%')
        .gte('fecha_fin', today)
        .lte('fecha_fin', future)
        .order('fecha_fin', { ascending: true })
      setPolizas(data || [])
      setLoading(false)
    }
    load()
  }, [])

  function daysUntilFin(fecha: string) {
    return Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  }

  const filtered = polizas.filter(p => {
    if (!p.fecha_fin) return false
    return daysUntilFin(p.fecha_fin) <= filterDias
  })

  const urgentes = filtered.filter(p => p.fecha_fin && daysUntilFin(p.fecha_fin) <= 15).length
  const proximos = filtered.filter(p => p.fecha_fin && daysUntilFin(p.fecha_fin) > 15 && daysUntilFin(p.fecha_fin) <= 30).length

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"/>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header + filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Car className="w-5 h-5 text-info"/>
          <div>
            <h3 className="font-semibold text-ink-700">Oportunidades SOAT</h3>
            <p className="text-xs text-ink-400">Pólizas SOAT próximas a vencer — contactar para renovar</p>
          </div>
        </div>
        <div className="flex gap-2">
          {[30, 60, 90].map(d => (
            <button key={d}
              onClick={() => setFilterDias(d as 30 | 60 | 90)}
              className={[
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                filterDias === d
                  ? 'bg-info text-white border-blue-600'
                  : 'bg-white text-ink-500 border-ink-200 hover:bg-cream-100',
              ].join(' ')}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-error-soft rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-error">{urgentes}</p>
          <p className="text-xs text-error mt-0.5">Urgentes (≤15d)</p>
        </div>
        <div className="bg-warning-soft rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-ink-700">{proximos}</p>
          <p className="text-xs text-ink-700 mt-0.5">Próximas (16–30d)</p>
        </div>
        <div className="bg-info/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-info">{filtered.length}</p>
          <p className="text-xs text-info mt-0.5">Total ({filterDias}d)</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Placa / Riesgo</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Aseguradora</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Prima</th>
              <th className="px-4 py-3 font-medium">Vence</th>
              <th className="px-4 py-3 font-medium">Urgencia</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const days = p.fecha_fin ? daysUntilFin(p.fecha_fin) : 999
              const urgency = days <= 15
                ? 'bg-error-soft text-error'
                : days <= 30
                  ? 'bg-warning-soft text-ink-700'
                  : 'bg-info/20 text-info'
              return (
                <tr key={p.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink-700">{(p.cliente as any)?.nombre || 'Sin cliente'}</span>
                    {p.numero_poliza && <p className="text-xs text-ink-400">Póliza: {p.numero_poliza}</p>}
                  </td>
                  <td className="px-4 py-3 text-ink-500 hidden md:table-cell">{p.riesgo || '—'}</td>
                  <td className="px-4 py-3 text-ink-500 hidden lg:table-cell">{p.aseguradora}</td>
                  <td className="px-4 py-3 text-ink-600 font-medium hidden md:table-cell">
                    {p.prima_neta ? formatCOP(p.prima_neta) : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-500 text-xs">
                    {p.fecha_fin
                      ? new Date(p.fecha_fin + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${urgency}`}>
                      {days}d
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <Car className="w-8 h-8 mx-auto mb-2 opacity-30"/>
            <p className="text-sm">No hay pólizas SOAT por vencer en los próximos {filterDias} días</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function CRMComercialView() {
  const [subTab, setSubTab] = useState<SubTab>('prospectos')

  const tabs: { key: SubTab; label: string; icon: React.ReactNode }[] = [
    { key: 'prospectos', label: 'Prospectos',        icon: <Briefcase className="w-4 h-4"/> },
    { key: 'gestion',    label: 'Gestión negocios',  icon: <TrendingUp className="w-4 h-4"/> },
    { key: 'soat',       label: 'Oportunidades SOAT', icon: <Car className="w-4 h-4"/>  },
  ]

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              subTab === t.key
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-ink-400 hover:text-ink-600',
            ].join(' ')}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'prospectos' && <ProspectosTab/>}
      {subTab === 'gestion'    && <GestionTab/>}
      {subTab === 'soat'       && <SOATTab/>}
    </div>
  )
}
