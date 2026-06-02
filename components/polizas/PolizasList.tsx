'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, EstadoPoliza, PolizaAnexo, PolizaVinculado } from '@/types'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import {
  Search, AlertTriangle, Plus, Pencil, Trash2,
  FileText, ShieldCheck, Paperclip, Users, Archive, RefreshCw,
  SlidersHorizontal, X, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import Link from 'next/link'
import PolizaModal from './PolizaModal'
import PolizaAnexoModal from './PolizaAnexoModal'
import PolizaVinculadoModal from './PolizaVinculadoModal'
import ImportPolizasModal from './ImportPolizasModal'

const ESTADO_COLORS: Record<EstadoPoliza, string> = {
  activa:    'bg-primary-100 text-primary-700',
  vencida:   'bg-error-soft text-error',
  cancelada: 'bg-cream-200 text-ink-500',
  pendiente: 'bg-warning-soft text-ink-700',
}
const ESTADO_LABELS: Record<EstadoPoliza, string> = {
  activa: 'Activa', vencida: 'Vencida', cancelada: 'Cancelada', pendiente: 'Pendiente',
}

const RAMOS_CUMPLIMIENTO = ['Fianzas', 'Cumplimiento']
const ASEGURADORAS = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado','Otro',
]
const RAMOS_SEGUROS = [
  'Vida Individual','Vida Grupo','SOAT','Todo Riesgo Vehículo','Responsabilidad Civil',
  'Hogar','Incendio','Empresarial','Salud','ARL','Transportes','Agrícola','Otros',
]

type Tab = 'polizas' | 'anexos' | 'vinculados' | 'eliminadas' | 'cumplimiento'
type PolizaConCliente = Poliza & { cliente: { id: string; nombre: string } | null }

interface ExtraFilters {
  aseguradora: string
  ramo:        string
  modalidad:   string
  vencimiento: string   // 'all' | '30' | '60'
}
const defaultExtra: ExtraFilters = { aseguradora: '', ramo: '', modalidad: '', vencimiento: 'all' }

function countExtra(f: ExtraFilters) {
  return [!!f.aseguradora, !!f.ramo, !!f.modalidad, f.vencimiento !== 'all'].filter(Boolean).length
}

export default function PolizasList() {
  const { currentWorkspace } = useWorkspace()
  const [polizas, setPolizas]       = useState<PolizaConCliente[]>([])
  const [eliminadas, setEliminadas] = useState<PolizaConCliente[]>([])
  const [anexos, setAnexos]         = useState<PolizaAnexo[]>([])
  const [vinculados, setVinculados] = useState<PolizaVinculado[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoPoliza | 'all'>('all')
  const [extra, setExtra]           = useState<ExtraFilters>(defaultExtra)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab]   = useState<Tab>('polizas')

  // Modals
  const [showPolizaModal, setShowPolizaModal]           = useState(false)
  const [editingPoliza, setEditingPoliza]               = useState<PolizaConCliente | undefined>()
  const [showAnexoModal, setShowAnexoModal]             = useState(false)
  const [editingAnexo, setEditingAnexo]                 = useState<PolizaAnexo | undefined>()
  const [showVinculadoModal, setShowVinculadoModal]     = useState(false)
  const [editingVinculado, setEditingVinculado]         = useState<PolizaVinculado | undefined>()
  const [showImportModal, setShowImportModal]           = useState(false)
  const [aseguradorasDB, setAseguradorasDB]             = useState<string[]>([])

  async function loadAseguradoras() {
    const { data } = await supabase
      .from('polizas')
      .select('aseguradora')
      .eq('workspace_id', currentWorkspace?.id || '')
      .eq('eliminada', false)
    if (data) {
      const unique = [...new Set(data.map(r => r.aseguradora).filter(Boolean))].sort()
      setAseguradorasDB(unique)
    }
  }

  async function loadPolizas() {
    const { data } = await supabase
      .from('polizas')
      .select('*, cliente:clientes(id, nombre)')
      .eq('eliminada', false)
      .eq('workspace_id', currentWorkspace?.id || '')
      .order('fecha_fin', { ascending: true, nullsFirst: false })
    setPolizas((data as PolizaConCliente[]) || [])
  }

  async function loadEliminadas() {
    const { data } = await supabase
      .from('polizas')
      .select('*, cliente:clientes(id, nombre)')
      .eq('eliminada', true)
      .eq('workspace_id', currentWorkspace?.id || '')
      .order('created_at', { ascending: false })
    setEliminadas((data as PolizaConCliente[]) || [])
  }

  async function loadAnexos() {
    const { data } = await supabase
      .from('poliza_anexos')
      .select('*, poliza:polizas(id, numero_poliza, aseguradora, ramo), cliente:clientes(id, nombre)')
      .eq('workspace_id', currentWorkspace?.id || '')
      .order('created_at', { ascending: false })
    setAnexos((data || []) as PolizaAnexo[])
  }

  async function loadVinculados() {
    const { data } = await supabase
      .from('poliza_vinculados')
      .select('*, poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .eq('workspace_id', currentWorkspace?.id || '')
      .order('created_at', { ascending: false })
    setVinculados((data || []) as PolizaVinculado[])
  }

  async function load() {
    setLoading(true)
    await Promise.all([loadPolizas(), loadEliminadas(), loadAnexos(), loadVinculados(), loadAseguradoras()])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentWorkspace?.id])

  async function softDelete(id: string) {
    if (!confirm('¿Mover esta póliza a Eliminadas?')) return
    await supabase.from('polizas').update({ eliminada: true }).eq('id', id).eq('workspace_id', currentWorkspace?.id || '')
    setPolizas(prev => prev.filter(p => p.id !== id))
    await loadEliminadas()
  }

  async function restorePoliza(id: string) {
    await supabase.from('polizas').update({ eliminada: false }).eq('id', id).eq('workspace_id', currentWorkspace?.id || '')
    setEliminadas(prev => prev.filter(p => p.id !== id))
    await loadPolizas()
  }

  async function deleteAnexo(id: string) {
    if (!confirm('¿Eliminar este anexo?')) return
    await supabase.from('poliza_anexos').delete().eq('id', id)
    setAnexos(prev => prev.filter(a => a.id !== id))
  }

  async function deleteVinculado(id: string) {
    if (!confirm('¿Eliminar este vinculado?')) return
    await supabase.from('poliza_vinculados').delete().eq('id', id)
    setVinculados(prev => prev.filter(v => v.id !== id))
  }

  // Splits
  const polizasNormales    = polizas.filter(p => !RAMOS_CUMPLIMIENTO.includes(p.ramo))
  const polizasCumplimiento = polizas.filter(p => RAMOS_CUMPLIMIENTO.includes(p.ramo))

  const q = search.toLowerCase()

  function filterPolizas(list: PolizaConCliente[]) {
    const today = new Date()
    return list.filter(p => {
      const matchSearch = !search ||
        p.cliente?.nombre?.toLowerCase().includes(q) ||
        p.aseguradora.toLowerCase().includes(q) ||
        p.ramo.toLowerCase().includes(q) ||
        p.numero_poliza?.includes(search) ||
        p.riesgo?.toLowerCase().includes(q) ||
        p.nombre_tomador?.toLowerCase().includes(q) ||
        p.asegurado_nombre?.toLowerCase().includes(q)
      const matchEstado    = filterEstado === 'all' || p.estado === filterEstado
      const matchAseg      = !extra.aseguradora || p.aseguradora === extra.aseguradora
      const matchRamo      = !extra.ramo        || p.ramo === extra.ramo
      const matchModalidad = !extra.modalidad   || p.tipo_modalidad === extra.modalidad
      let matchVenc = true
      if (extra.vencimiento !== 'all' && p.fecha_fin) {
        const days = Math.ceil((new Date(p.fecha_fin).getTime() - today.getTime()) / 86400000)
        const limit = parseInt(extra.vencimiento)
        matchVenc = days >= 0 && days <= limit
      }
      return matchSearch && matchEstado && matchAseg && matchRamo && matchModalidad && matchVenc
    })
  }

  const filteredPolizas    = filterPolizas(polizasNormales)
  const filteredCumplimiento = filterPolizas(polizasCumplimiento)
  const filteredEliminadas = eliminadas.filter(p =>
    !search ||
    p.cliente?.nombre?.toLowerCase().includes(q) ||
    p.aseguradora.toLowerCase().includes(q) ||
    p.numero_poliza?.includes(search)
  )
  const filteredAnexos = anexos.filter(a =>
    !search ||
    a.cliente?.nombre?.toLowerCase().includes(q) ||
    a.poliza?.numero_poliza?.includes(search) ||
    a.numero_anexo?.toLowerCase().includes(q)
  )
  const filteredVinculados = vinculados.filter(v =>
    !search ||
    v.poliza?.numero_poliza?.includes(search) ||
    v.numero_anexo_pago?.toLowerCase().includes(q) ||
    v.beneficiario?.toLowerCase().includes(q)
  )

  const TABS: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'polizas',     label: 'Pólizas',      icon: FileText,    count: polizasNormales.length      },
    { key: 'anexos',      label: 'Anexos',        icon: Paperclip,   count: anexos.length               },
    { key: 'vinculados',  label: 'Vinculados',    icon: Users,       count: vinculados.length           },
    { key: 'eliminadas',  label: 'Eliminadas',    icon: Archive,     count: eliminadas.length           },
    { key: 'cumplimiento',label: 'Cumplimiento',  icon: ShieldCheck, count: polizasCumplimiento.length  },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Pólizas</h1>
          <p className="text-ink-400 text-sm mt-1">
            {polizasNormales.filter(p => p.fecha_fin ? p.fecha_fin >= new Date().toISOString().split('T')[0] : p.estado === 'activa').length} activas ·{' '}
            Prima: {formatCOP(polizasNormales.filter(p => p.fecha_fin ? p.fecha_fin >= new Date().toISOString().split('T')[0] : p.estado === 'activa').reduce((s, p) => s + (p.prima_neta || p.prima || 0), 0))}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'polizas' || activeTab === 'cumplimiento' ? (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 border border-ink-200 text-ink-500 hover:bg-cream-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Archive className="w-4 h-4" /> Importar Excel
              </button>
              <button
                onClick={() => { setEditingPoliza(undefined); setShowPolizaModal(true) }}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Nueva póliza
              </button>
            </>
          ) : activeTab === 'anexos' ? (
            <button
              onClick={() => { setEditingAnexo(undefined); setShowAnexoModal(true) }}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Nuevo anexo
            </button>
          ) : activeTab === 'vinculados' ? (
            <button
              onClick={() => { setEditingVinculado(undefined); setShowVinculadoModal(true) }}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Nuevo vinculado
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-200 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => { setActiveTab(key); setSearch('') }}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              activeTab === key
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-ink-400 hover:text-ink-600',
            ].join(' ')}>
            <Icon className="w-4 h-4" />
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex gap-3 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, aseguradora, N° póliza..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>

        {(activeTab === 'polizas' || activeTab === 'cumplimiento') && (
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as EstadoPoliza | 'all')}
            className={selCls(filterEstado !== 'all')}>
            <option value="all">Todos los estados</option>
            {(Object.entries(ESTADO_LABELS) as [EstadoPoliza, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}

        {(activeTab === 'polizas' || activeTab === 'cumplimiento') && (
          <button onClick={() => setShowFilters(v => !v)}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
              showFilters || countExtra(extra) > 0
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-ink-200 text-ink-500 hover:bg-cream-100',
            ].join(' ')}>
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {countExtra(extra) > 0 && (
              <span className="bg-primary-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {countExtra(extra)}
              </span>
            )}
          </button>
        )}

        {(countExtra(extra) > 0 || filterEstado !== 'all' || search) && (
          <button onClick={() => { setExtra(defaultExtra); setFilterEstado('all'); setSearch('') }}
            className="flex items-center gap-1 text-xs text-ink-400 hover:text-error transition-colors px-2">
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>

      {/* ── Panel filtros avanzados ── */}
      {showFilters && (activeTab === 'polizas' || activeTab === 'cumplimiento') && (
        <div className="bg-cream-100 border border-ink-200 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FiltroSelect label="Aseguradora" value={extra.aseguradora} onChange={v => setExtra(e => ({ ...e, aseguradora: v }))}>
            <option value="">Todas</option>
            {(aseguradorasDB.length > 0 ? aseguradorasDB : ASEGURADORAS).map(a => <option key={a} value={a}>{a}</option>)}
          </FiltroSelect>
          <FiltroSelect label="Ramo" value={extra.ramo} onChange={v => setExtra(e => ({ ...e, ramo: v }))}>
            <option value="">Todos</option>
            <optgroup label="Seguros">
              {RAMOS_SEGUROS.map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>
            <optgroup label="Cumplimiento">
              {RAMOS_CUMPLIMIENTO.map(r => <option key={r} value={r}>{r}</option>)}
            </optgroup>
          </FiltroSelect>
          <FiltroSelect label="Modalidad" value={extra.modalidad} onChange={v => setExtra(e => ({ ...e, modalidad: v }))}>
            <option value="">Todas</option>
            <option value="individual">Individual</option>
            <option value="colectiva">Colectiva</option>
            <option value="agrupadora">Agrupadora</option>
          </FiltroSelect>
          <FiltroSelect label="Vencimiento" value={extra.vencimiento} onChange={v => setExtra(e => ({ ...e, vencimiento: v }))}>
            <option value="all">Cualquier fecha</option>
            <option value="30">Próximos 30 días</option>
            <option value="60">Próximos 60 días</option>
            <option value="90">Próximos 90 días</option>
          </FiltroSelect>
        </div>
      )}

      {/* ── Tab: Pólizas ── */}
      {activeTab === 'polizas' && (
        <PolizasTable
          polizas={filteredPolizas}
          onEdit={p => { setEditingPoliza(p); setShowPolizaModal(true) }}
          onDelete={softDelete}
          showRiesgo={false}
        />
      )}

      {/* ── Tab: Anexos ── */}
      {activeTab === 'anexos' && (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-ink-200">
              <tr className="text-left text-xs text-ink-400">
                <th className="px-4 py-3 font-medium">N° Póliza</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Cliente</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Documento</th>
                <th className="px-4 py-3 font-medium">N° Anexo</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnexos.map(a => (
                <tr key={a.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                  <td className="px-4 py-3 text-ink-600 text-xs font-mono">{a.poliza?.numero_poliza || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.estado === 'activo' ? 'bg-primary-100 text-primary-700' :
                      a.estado === 'cancelado' ? 'bg-error-soft text-error' :
                      'bg-cream-200 text-ink-400'
                    }`}>
                      {a.estado.charAt(0).toUpperCase() + a.estado.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {a.client_id
                      ? <Link href={`/clientes/${a.client_id}`} className="text-ink-600 hover:text-primary-500">{a.cliente?.nombre || '—'}</Link>
                      : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{a.documento || '—'}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{a.numero_anexo || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditingAnexo(a); setShowAnexoModal(true) }}
                        className="text-ink-400 hover:text-ink-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteAnexo(a.id)}
                        className="text-ink-400 hover:text-error transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAnexos.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay anexos registrados</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Vinculados ── */}
      {activeTab === 'vinculados' && (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-ink-200">
              <tr className="text-left text-xs text-ink-400">
                <th className="px-4 py-3 font-medium">Póliza</th>
                <th className="px-4 py-3 font-medium">N° Anexo / Pago</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">N° Afiliado / Objeto</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Fecha inicio</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Beneficiario</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredVinculados.map(v => (
                <tr key={v.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-ink-600 text-xs font-mono">{v.poliza?.numero_poliza || '—'}</p>
                    <p className="text-ink-400 text-xs">{v.poliza?.aseguradora}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{v.numero_anexo_pago || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-500 text-xs">{v.numero_afiliado_objeto || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{formatDate(v.fecha_inicio)}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-500 text-xs">{v.beneficiario || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditingVinculado(v); setShowVinculadoModal(true) }}
                        className="text-ink-400 hover:text-ink-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteVinculado(v.id)}
                        className="text-ink-400 hover:text-error transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVinculados.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay vinculados registrados</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Eliminadas ── */}
      {activeTab === 'eliminadas' && (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          {filteredEliminadas.length > 0 && (
            <div className="px-4 py-3 bg-warning-soft border-b border-warning/30 flex items-center justify-between">
              <span className="text-xs text-ink-700">{filteredEliminadas.length} póliza{filteredEliminadas.length !== 1 ? 's' : ''} eliminada{filteredEliminadas.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-ink-200">
              <tr className="text-left text-xs text-ink-400">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Aseg. / Ramo</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">N° Póliza</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Prima</th>
                <th className="px-4 py-3 font-medium text-right">Restaurar</th>
              </tr>
            </thead>
            <tbody>
              {filteredEliminadas.map(p => (
                <tr key={p.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors opacity-70">
                  <td className="px-4 py-3">
                    {p.client_id
                      ? <Link href={`/clientes/${p.client_id}`} className="font-medium text-ink-600 hover:text-primary-500">{p.cliente?.nombre || '—'}</Link>
                      : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-ink-600">{p.aseguradora}</p>
                    <p className="text-xs text-ink-400">{p.ramo}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{p.numero_poliza || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-500">{p.prima ? formatCOP(p.prima) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => restorePoliza(p.id)}
                      title="Restaurar póliza"
                      className="inline-flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 font-medium">
                      <RefreshCw className="w-3.5 h-3.5" /> Restaurar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredEliminadas.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay pólizas eliminadas</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Cumplimiento ── */}
      {activeTab === 'cumplimiento' && (
        <div className="space-y-4">
          {/* Stats */}
          {polizasCumplimiento.length > 0 && (() => {
            const hoy = new Date().toISOString().split('T')[0]
            const activas = polizasCumplimiento.filter(p => p.fecha_fin ? p.fecha_fin >= hoy : p.estado === 'activa')
            const primaNeta   = activas.reduce((s, p) => s + (p.prima_neta || p.prima || 0), 0)
            const totalPrima  = activas.reduce((s, p) => s + (p.total_prima || 0), 0)
            const comision    = activas.reduce((s, p) => s + (p.comision_agencia || 0), 0)
            const recOficina  = activas.reduce((s, p) => s + (p.recaudado_oficina || 0), 0)
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Activas',       val: `${activas.length} pólizas`, color: 'text-primary-700' },
                  { label: 'Prima neta',    val: formatCOP(primaNeta),        color: 'text-ink-700'   },
                  { label: 'Total prima',   val: formatCOP(totalPrima),       color: 'text-ink-700'   },
                  { label: 'Comisión',      val: formatCOP(comision),         color: 'text-indigo-700'  },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-white rounded-xl border border-ink-200 px-4 py-3">
                    <p className="text-xs text-ink-400 mb-0.5">{label}</p>
                    <p className={`font-bold text-sm ${color}`}>{val}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Table */}
          <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 border-b border-ink-200">
                <tr className="text-left text-xs text-ink-400">
                  <th className="px-4 py-3 font-medium">N° Póliza</th>
                  <th className="px-4 py-3 font-medium">Asegurado / Cliente</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Tomador</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Estado</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Vencimiento</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Prima neta</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Total</th>
                  <th className="px-4 py-3 font-medium hidden xl:table-cell">Comisión</th>
                  <th className="px-4 py-3 font-medium hidden xl:table-cell">Rec. Ofic.</th>
                  <th className="px-4 py-3 font-medium hidden xl:table-cell">Rec. Aseg.</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCumplimiento.map(p => {
                  const hoyStr = new Date().toISOString().split('T')[0]
                  const esActiva = p.fecha_fin ? p.fecha_fin >= hoyStr : p.estado === 'activa'
                  const days   = p.fecha_fin ? daysUntil(p.fecha_fin) : null
                  const urgent = esActiva && days !== null && days >= 0 && days <= 30
                  const warn   = esActiva && days !== null && days > 30 && days <= 60
                  return (
                    <tr key={p.id} className={`border-b border-cream-200 hover:bg-cream-100 transition-colors ${urgent ? 'bg-warning-soft/30' : ''}`}>
                      <td className="px-4 py-3 text-xs font-mono text-ink-500">{p.numero_poliza || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink-600 text-sm">
                          {p.asegurado_nombre || (p.client_id
                            ? <Link href={`/clientes/${p.client_id}`} className="hover:text-primary-500">{p.cliente?.nombre}</Link>
                            : '—')}
                        </p>
                        {p.asegurado_nombre && p.client_id && (
                          <Link href={`/clientes/${p.client_id}`} className="text-xs text-ink-400 hover:text-primary-500">
                            {p.cliente?.nombre}
                          </Link>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-ink-500 text-xs">{p.nombre_tomador || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${esActiva ? ESTADO_COLORS['activa'] : ESTADO_COLORS['vencida']}`}>
                          {esActiva ? 'Activa' : 'Vencida'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className={urgent ? 'text-ink-700 font-medium text-xs' : warn ? 'text-ink-700 text-xs' : 'text-ink-500 text-xs'}>
                            {formatDate(p.fecha_fin)}
                          </span>
                          {urgent && <AlertTriangle className="w-3.5 h-3.5 text-ink-700 flex-shrink-0" />}
                          {(urgent || warn) && days !== null && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${urgent ? 'bg-error-soft text-error' : 'bg-warning-soft text-ink-700'}`}>
                              {days}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell font-medium text-ink-700 text-sm">
                        {p.prima_neta ? formatCOP(p.prima_neta) : p.prima ? formatCOP(p.prima) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-ink-500 text-sm">
                        {p.total_prima ? formatCOP(p.total_prima) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-ink-500 text-sm">
                        {p.comision_agencia ? formatCOP(p.comision_agencia) : p.comision ? formatCOP(p.comision) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-ink-500 text-sm">
                        {p.recaudado_oficina ? formatCOP(p.recaudado_oficina) : '—'}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-ink-500 text-sm">
                        {p.recaudado_aseguradora ? formatCOP(p.recaudado_aseguradora) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingPoliza(p); setShowPolizaModal(true) }}
                            className="text-ink-400 hover:text-ink-600 transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => softDelete(p.id)}
                            className="text-ink-400 hover:text-error transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredCumplimiento.length === 0 && (
              <div className="text-center py-14 text-ink-400">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-25" />
                <p className="text-sm font-medium">No hay pólizas de cumplimiento</p>
                <p className="text-xs mt-1 text-ink-400">Las pólizas de ramo Fianzas y Cumplimiento aparecen aquí automáticamente</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showPolizaModal && (
        <PolizaModal
          poliza={editingPoliza}
          clientId={editingPoliza?.client_id || ''}
          isCumplimiento={activeTab === 'cumplimiento'}
          onClose={() => setShowPolizaModal(false)}
          onSaved={() => { setShowPolizaModal(false); load() }}
        />
      )}
      {showAnexoModal && (
        <PolizaAnexoModal
          anexo={editingAnexo}
          onClose={() => setShowAnexoModal(false)}
          onSaved={() => { setShowAnexoModal(false); loadAnexos() }}
        />
      )}
      {showVinculadoModal && (
        <PolizaVinculadoModal
          vinculado={editingVinculado}
          onClose={() => setShowVinculadoModal(false)}
          onSaved={() => { setShowVinculadoModal(false); loadVinculados() }}
        />
      )}
      {showImportModal && (
        <ImportPolizasModal
          onClose={() => setShowImportModal(false)}
          onImported={() => { setShowImportModal(false); load() }}
        />
      )}
    </div>
  )
}

/* ── helpers ── */
function selCls(active: boolean) {
  return [
    'px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors',
    active ? 'border-primary-400 bg-primary-50 text-primary-800' : 'border-ink-200 bg-white text-ink-500',
  ].join(' ')
}

function FiltroSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-ink-400 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white">
        {children}
      </select>
    </div>
  )
}

// ── Shared pólizas table ────────────────────────────────────────────────────
type SortKey = 'tipo_poliza' | 'numero_poliza' | 'aseguradora' | 'ramo' | 'cliente' | 'fecha_fin' | 'estado'

function sortList(list: PolizaConCliente[], key: SortKey, dir: 'asc' | 'desc') {
  return [...list].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    if (key === 'cliente') {
      va = a.cliente?.nombre?.toLowerCase() ?? ''
      vb = b.cliente?.nombre?.toLowerCase() ?? ''
    } else if (key === 'fecha_fin') {
      va = a.fecha_fin ?? ''
      vb = b.fecha_fin ?? ''
    } else {
      va = ((a[key] as string | null) ?? '').toLowerCase()
      vb = ((b[key] as string | null) ?? '').toLowerCase()
    }
    if (va === '' && vb !== '') return 1
    if (vb === '' && va !== '') return -1
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}

function PolizasTable({
  polizas, onEdit, onDelete, showRiesgo,
}: {
  polizas: PolizaConCliente[]
  onEdit: (p: PolizaConCliente) => void
  onDelete: (id: string) => void
  showRiesgo: boolean
}) {
  const [sortKey, setSortKey] = useState<SortKey>('fecha_fin')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = sortList(polizas, sortKey, sortDir)

  function Th({ col, label, className = '' }: { col: SortKey; label: string; className?: string }) {
    const active = sortKey === col
    return (
      <th
        onClick={() => handleSort(col)}
        className={`px-4 py-3 font-medium cursor-pointer select-none transition-colors ${active ? 'text-primary-600' : 'hover:text-ink-600'} ${className}`}>
        <div className="flex items-center gap-1">
          {label}
          {active
            ? sortDir === 'asc'
              ? <ChevronUp   className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              : <ChevronDown className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
            : <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />
          }
        </div>
      </th>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-cream-100 border-b border-ink-200">
          <tr className="text-left text-xs text-ink-400">
            <Th col="tipo_poliza"   label="Tipo póliza" />
            <Th col="numero_poliza" label="N° Póliza" />
            <Th col="aseguradora"   label="Aseguradora" />
            <Th col="ramo"          label="Ramo"        className="hidden md:table-cell" />
            <th className="px-4 py-3 font-medium hidden md:table-cell">Riesgo</th>
            <Th col="cliente"       label="Cliente" />
            <Th col="fecha_fin"     label="Vencimiento"  className="hidden md:table-cell" />
            <th className="px-4 py-3 font-medium text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(p => {
            const hoyStr = new Date().toISOString().split('T')[0]
            const esActiva = p.fecha_fin ? p.fecha_fin >= hoyStr : p.estado === 'activa'
            const days   = p.fecha_fin ? daysUntil(p.fecha_fin) : null
            const urgent = esActiva && days !== null && days >= 0 && days <= 30
            const warn   = esActiva && days !== null && days > 30 && days <= 60
            return (
              <tr key={p.id} className={`border-b border-cream-200 hover:bg-cream-100 transition-colors ${urgent ? 'bg-warning-soft/30' : ''}`}>
                <td className="px-4 py-3 text-ink-500 text-xs">{p.tipo_poliza || p.ramo || '—'}</td>
                <td className="px-4 py-3 text-ink-500 font-mono text-xs">{p.numero_poliza || '—'}</td>
                <td className="px-4 py-3 text-ink-600">{p.aseguradora}</td>
                <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{p.ramo}</td>
                <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs max-w-[140px]">
                  <span className="line-clamp-2">{p.riesgo || '—'}</span>
                </td>
                <td className="px-4 py-3">
                  {p.client_id
                    ? <Link href={`/clientes/${p.client_id}`} className="font-medium text-ink-700 hover:text-primary-500">{p.cliente?.nombre || '—'}</Link>
                    : <span className="text-ink-400">—</span>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-1.5">
                    <span className={urgent ? 'text-ink-700 font-medium' : warn ? 'text-ink-700' : 'text-ink-500'}>
                      {formatDate(p.fecha_fin)}
                    </span>
                    {urgent && <AlertTriangle className="w-3.5 h-3.5 text-ink-700" />}
                    {(urgent || warn) && days !== null && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${urgent ? 'bg-error-soft text-error' : 'bg-warning-soft text-ink-700'}`}>
                        {days}d
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEdit(p)} className="text-ink-400 hover:text-ink-600 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => onDelete(p.id)} className="text-ink-400 hover:text-error transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {polizas.length === 0 && (
        <div className="text-center py-12 text-ink-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No se encontraron pólizas</p>
        </div>
      )}
    </div>
  )
}
