'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Etapa, TipoCliente } from '@/types'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'

interface Member { user_id: string; nombre: string; email: string; role: string }
import {
  Plus, Search, Phone, MapPin, Pencil, Trash2, Upload, Users, UserSquare2,
  SlidersHorizontal, X, Download, Eye, MoreHorizontal, Wallet, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import ClienteModal from './ClienteModal'
import ImportModal from './ImportModal'
import ContactosTab from './ContactosTab'
import CRMComercialView from './CRMComercialView'

const ETAPA_LABELS: Record<Etapa, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizacion: 'Cotización', cerrado: 'Cerrado',
}
const ETAPA_COLORS: Record<Etapa, string> = {
  nuevo: 'bg-blue-100 text-blue-700',
  contactado: 'bg-amber-100 text-amber-700',
  cotizacion: 'bg-purple-100 text-purple-700',
  cerrado: 'bg-emerald-100 text-emerald-700',
}
const TIPO_LABELS: Record<TipoCliente, string> = {
  persona_natural: 'Persona Natural', empresa: 'Empresa', consorcio: 'Consorcio',
}
const TIPO_COLORS: Record<TipoCliente, string> = {
  persona_natural: 'bg-slate-100 text-slate-600',
  empresa:  'bg-indigo-100 text-indigo-700',
  consorcio:'bg-teal-100 text-teal-700',
}
const CATEGORIAS = ['VIP','Preferencial','Estándar','Nuevo','Inactivo']
const DEPARTAMENTOS = [
  'Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas','Caquetá',
  'Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare',
  'Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo',
  'Quindío','Risaralda','San Andrés y Providencia','Santander','Sucre','Tolima',
  'Valle del Cauca','Vaupés','Vichada',
]

type Tab = 'clientes' | 'contactos' | 'crm'

interface Filters {
  etapa:       Etapa | 'all'
  tipo:        TipoCliente | 'all'
  categoria:   string
  departamento:string
  genero:      string
  vehiculo:    string   // 'all' | 'si' | 'no'
  autoriza:    string   // 'all' | 'si' | 'no'
  assignedTo:  string   // '' = todos, uuid = filtrar por asesor
}

const defaultFilters: Filters = {
  etapa: 'all', tipo: 'all', categoria: '', departamento: '', genero: '', vehiculo: 'all', autoriza: 'all', assignedTo: '',
}

function countActiveFilters(f: Filters) {
  return [
    f.etapa !== 'all',
    f.tipo  !== 'all',
    !!f.categoria,
    !!f.departamento,
    !!f.genero,
    f.vehiculo !== 'all',
    f.autoriza !== 'all',
    !!f.assignedTo,
  ].filter(Boolean).length
}

/* ── CSV helpers ── */
function clientesToCSV(rows: Cliente[]): string {
  const headers = ['Nombre','Alias','Tipo','Cédula/NIT','Teléfono','Email','Ciudad','Departamento','Etapa','Categoría']
  const escape = (v: string | null | undefined) => {
    if (v == null) return ''
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = rows.map(c => [
    c.nombre,
    c.sobrenombre,
    TIPO_LABELS[c.tipo_cliente],
    c.tipo_cliente === 'persona_natural' ? c.cedula : c.nit,
    c.telefono,
    c.email,
    c.ciudad,
    c.departamento,
    ETAPA_LABELS[c.etapa],
    c.categoria,
  ].map(escape).join(','))
  return '﻿' + [headers.join(','), ...lines].join('\r\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ClientesList() {
  const { currentWorkspace, currentUserId } = useWorkspace()
  const { can } = usePermissions()
  const [members, setMembers] = useState<Member[]>([])
  const [clientes,      setClientes]      = useState<Cliente[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [filters,       setFilters]       = useState<Filters>(defaultFilters)
  const [showFilters,   setShowFilters]   = useState(false)
  const [showModal,     setShowModal]     = useState(false)
  const [showImport,    setShowImport]    = useState(false)
  const [editing,       setEditing]       = useState<Cliente | undefined>()
  const [activeTab,     setActiveTab]     = useState<Tab>('clientes')
  const [contactCount,  setContactCount]  = useState(0)

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)

  // Row dropdown
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  async function load() {
    const { data } = await supabase.from('clientes').select('*').eq('workspace_id', currentWorkspace?.id || '').order('created_at', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }

  async function loadContactCount() {
    const { count } = await supabase.from('contactos').select('*', { count: 'exact', head: true })
    setContactCount(count || 0)
  }

  useEffect(() => {
    load()
    loadContactCount()
    // Cargar miembros para filtro y visualización
    if (currentWorkspace) {
      supabase.rpc('get_workspace_members', { p_workspace_id: currentWorkspace.id })
        .then(({ data }) => { if (data) setMembers(data as Member[]) })
    }
  }, [currentWorkspace?.id])

  // Close dropdown on outside click
  useEffect(() => {
    if (!openMenuId) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openMenuId])

  async function deleteCliente(id: string) {
    if (!confirm('¿Eliminar este cliente y todos sus datos?')) return
    await supabase.from('clientes').delete().eq('id', id)
    setClientes(prev => prev.filter(c => c.id !== id))
  }

  function setF<K extends keyof Filters>(k: K, v: Filters[K]) {
    setFilters(f => ({ ...f, [k]: v }))
  }

  function clearFilters() { setFilters(defaultFilters); setSearch('') }

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      c.nombre.toLowerCase().includes(q) ||
      c.telefono?.includes(search) ||
      c.email?.toLowerCase().includes(q) ||
      c.cedula?.includes(search) ||
      c.nit?.includes(search) ||
      c.sobrenombre?.toLowerCase().includes(q)

    const matchEtapa       = filters.etapa === 'all'     || c.etapa === filters.etapa
    const matchTipo        = filters.tipo  === 'all'     || c.tipo_cliente === filters.tipo
    const matchCategoria   = !filters.categoria          || c.categoria === filters.categoria
    const matchDepto       = !filters.departamento       || c.departamento === filters.departamento
    const matchGenero      = !filters.genero             || c.genero === filters.genero
    const matchVehiculo    = filters.vehiculo === 'all'  ||
      (filters.vehiculo === 'si' ? c.tiene_vehiculo : !c.tiene_vehiculo)
    const matchAutoriza    = filters.autoriza === 'all'  ||
      (filters.autoriza === 'si' ? c.autoriza_datos : !c.autoriza_datos)
    const matchAssigned    = !filters.assignedTo || c.assigned_to === filters.assignedTo

    return matchSearch && matchEtapa && matchTipo && matchCategoria && matchDepto && matchGenero && matchVehiculo && matchAutoriza && matchAssigned
  })

  const activeFilterCount = countActiveFilters(filters)

  /* ── Selection helpers ── */
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(c => c.id)))
    }
  }

  /* ── Bulk actions ── */
  async function bulkChangeEtapa(etapa: Etapa) {
    const ids = Array.from(selected)
    await supabase.from('clientes').update({ etapa }).in('id', ids)
    setClientes(prev => prev.map(c => ids.includes(c.id) ? { ...c, etapa } : c))
    setSelected(new Set())
  }

  async function bulkDelete() {
    const ids = Array.from(selected)
    await supabase.from('clientes').delete().in('id', ids)
    setClientes(prev => prev.filter(c => !ids.includes(c.id)))
    setSelected(new Set())
    setConfirmingBulkDelete(false)
  }

  /* ── CSV exports ── */
  function exportCSV() {
    const filename = `clientes_${new Date().toISOString().split('T')[0]}.csv`
    downloadCSV(clientesToCSV(filtered), filename)
  }

  function exportSelected() {
    const rows = clientes.filter(c => selected.has(c.id))
    const filename = `clientes_seleccion_${new Date().toISOString().split('T')[0]}.csv`
    downloadCSV(clientesToCSV(rows), filename)
  }

  function exportOne(c: Cliente) {
    const filename = `cliente_${c.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    downloadCSV(clientesToCSV([c]), filename)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  const allFilteredSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeTab === 'clientes'
              ? `${filtered.length} de ${clientes.length} registros`
              : activeTab === 'contactos'
              ? `${contactCount} contactos vinculados`
              : 'Pipeline comercial y oportunidades'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'clientes' && (
            <>
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" /> Importar CSV
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
              {can('clientes_crear') && (
                <button onClick={() => { setEditing(undefined); setShowModal(true) }}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Nuevo cliente
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        <button onClick={() => setActiveTab('clientes')}
          className={[
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'clientes' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700',
          ].join(' ')}>
          <Users className="w-4 h-4" />
          Clientes
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === 'clientes' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {clientes.length}
          </span>
        </button>
        <button onClick={() => setActiveTab('contactos')}
          className={[
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'contactos' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700',
          ].join(' ')}>
          <UserSquare2 className="w-4 h-4" />
          Contactos
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === 'contactos' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {contactCount}
          </span>
        </button>
        <button onClick={() => setActiveTab('crm')}
          className={[
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'crm' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700',
          ].join(' ')}>
          <TrendingUp className="w-4 h-4" />
          CRM Comercial
        </button>
      </div>

      {activeTab === 'contactos' ? (
        <ContactosTab onCountChange={setContactCount} />
      ) : activeTab === 'crm' ? (
        <CRMComercialView />
      ) : (
        <>
          {/* ── Toolbar ── */}
          <div className="flex gap-3 mb-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, teléfono, cédula, NIT..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>

            {/* Filtros rápidos inline */}
            <select value={filters.tipo} onChange={e => setF('tipo', e.target.value as TipoCliente | 'all')}
              className={selCls(filters.tipo !== 'all')}>
              <option value="all">Todos los tipos</option>
              <option value="persona_natural">Persona Natural</option>
              <option value="empresa">Empresa</option>
              <option value="consorcio">Consorcio</option>
            </select>

            <select value={filters.etapa} onChange={e => setF('etapa', e.target.value as Etapa | 'all')}
              className={selCls(filters.etapa !== 'all')}>
              <option value="all">Todas las etapas</option>
              <option value="nuevo">Nuevo</option>
              <option value="contactado">Contactado</option>
              <option value="cotizacion">Cotización</option>
              <option value="cerrado">Cerrado</option>
            </select>

            {/* Más filtros */}
            <button onClick={() => setShowFilters(v => !v)}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                showFilters || activeFilterCount > 2
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
              ].join(' ')}>
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {(activeFilterCount > 0 || search) && (
              <button onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors px-2">
                <X className="w-3.5 h-3.5" /> Limpiar
              </button>
            )}
          </div>

          {/* ── Panel de filtros avanzados ── */}
          {showFilters && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <FilterSelect label="Categoría" value={filters.categoria} onChange={v => setF('categoria', v)}>
                <option value="">Todas</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </FilterSelect>

              <FilterSelect label="Departamento" value={filters.departamento} onChange={v => setF('departamento', v)}>
                <option value="">Todos</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </FilterSelect>

              <FilterSelect label="Género" value={filters.genero} onChange={v => setF('genero', v)}>
                <option value="">Todos</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </FilterSelect>

              <FilterSelect label="Vehículo" value={filters.vehiculo} onChange={v => setF('vehiculo', v)}>
                <option value="all">Todos</option>
                <option value="si">Con vehículo</option>
                <option value="no">Sin vehículo</option>
              </FilterSelect>

              <FilterSelect label="Autoriza datos" value={filters.autoriza} onChange={v => setF('autoriza', v)}>
                <option value="all">Todos</option>
                <option value="si">Autoriza</option>
                <option value="no">No autoriza</option>
              </FilterSelect>

              {members.length > 1 && (
                <FilterSelect label="Asesor asignado" value={filters.assignedTo} onChange={v => setF('assignedTo', v)}>
                  <option value="">Todos los asesores</option>
                  <option value={currentUserId || ''}>Mis clientes</option>
                  {members.filter(m => m.user_id !== currentUserId).map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.nombre}</option>
                  ))}
                </FilterSelect>
              )}
            </div>
          )}

          {/* ── Tabla ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium w-8">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Cédula / NIT</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Ciudad</th>
                  <th className="px-4 py-3 font-medium">Etapa</th>
                  <th className="px-4 py-3 font-medium hidden xl:table-cell">Categoría</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Asesor</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selected.has(c.id) ? 'bg-emerald-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${c.id}`} className="font-medium text-slate-800 hover:text-emerald-600 transition-colors">
                        {c.nombre}
                      </Link>
                      {c.sobrenombre && <div className="text-xs text-slate-400">{c.sobrenombre}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[c.tipo_cliente]}`}>
                        {TIPO_LABELS[c.tipo_cliente]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {c.tipo_cliente === 'persona_natural' ? (c.cedula || '—') : (c.nit || '—')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {c.telefono && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Phone className="w-3 h-3" />{c.telefono}
                          </div>
                        )}
                        {c.email && (
                          <div className="text-slate-400 text-xs truncate max-w-[160px]">{c.email}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {c.ciudad && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3 h-3" />{c.ciudad}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLORS[c.etapa]}`}>
                        {ETAPA_LABELS[c.etapa]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {c.categoria
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{c.categoria}</span>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    {/* Asesor asignado */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {(() => {
                        const m = members.find(m => m.user_id === c.assigned_to)
                        if (!m) return <span className="text-slate-300 text-xs">—</span>
                        const isMe = c.assigned_to === currentUserId
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isMe ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {isMe ? 'Yo' : m.nombre.split(' ')[0]}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Ver */}
                        <Link href={`/clientes/${c.id}`}
                          className="text-slate-400 hover:text-emerald-600 transition-colors p-0.5">
                          <Eye className="w-4 h-4" />
                        </Link>
                        {/* Editar */}
                        <button onClick={() => { setEditing(c); setShowModal(true) }}
                          className="text-slate-400 hover:text-slate-700 transition-colors p-0.5">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Eliminar */}
                        {can('clientes_eliminar') && (
                          <button onClick={() => deleteCliente(c.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-0.5">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {/* Más opciones */}
                        <div className="relative" ref={openMenuId === c.id ? menuRef : null}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                            className="text-slate-400 hover:text-slate-700 transition-colors p-0.5">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenuId === c.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 min-w-[170px] py-1 text-sm">
                              {c.telefono && (
                                <a
                                  href={`https://wa.me/57${c.telefono.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={() => setOpenMenuId(null)}
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700">
                                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                                  WhatsApp
                                </a>
                              )}
                              {c.telefono && (
                                <a
                                  href={`tel:${c.telefono}`}
                                  onClick={() => setOpenMenuId(null)}
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700">
                                  <Phone className="w-3.5 h-3.5 text-blue-500" />
                                  Llamar
                                </a>
                              )}
                              {c.email && (
                                <a
                                  href={`mailto:${c.email}`}
                                  onClick={() => setOpenMenuId(null)}
                                  className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700">
                                  <MapPin className="w-3.5 h-3.5 text-purple-500" />
                                  Enviar email
                                </a>
                              )}
                              {(c.telefono || c.email) && (
                                <div className="border-t border-slate-100 my-1" />
                              )}
                              <button
                                onClick={() => { exportOne(c); setOpenMenuId(null) }}
                                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700 w-full text-left">
                                <Download className="w-3.5 h-3.5 text-slate-400" />
                                Exportar este cliente
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No se encontraron clientes</p>
                {(activeFilterCount > 0 || search) && (
                  <button onClick={clearFilters} className="mt-2 text-xs text-emerald-600 hover:underline">
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Floating bulk action bar ── */}
          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl">
              <span className="text-sm font-medium whitespace-nowrap">{selected.size} seleccionados</span>

              <div className="w-px h-5 bg-slate-600" />

              {/* Cambiar etapa */}
              <select
                onChange={e => { if (e.target.value) bulkChangeEtapa(e.target.value as Etapa) }}
                defaultValue=""
                className="bg-slate-800 text-white text-xs rounded-lg px-2 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="" disabled>Cambiar etapa...</option>
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="cotizacion">Cotización</option>
                <option value="cerrado">Cerrado</option>
              </select>

              {/* Exportar selección */}
              <button
                onClick={exportSelected}
                className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                <Download className="w-3.5 h-3.5" /> Exportar selección
              </button>

              {/* Eliminar con confirm inline */}
              {can('clientes_eliminar') && (
                confirmingBulkDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-300">¿Eliminar {selected.size} clientes?</span>
                    <button onClick={bulkDelete}
                      className="text-xs bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors">
                      Sí, eliminar
                    </button>
                    <button onClick={() => setConfirmingBulkDelete(false)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg transition-colors">
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingBulkDelete(true)}
                    className="flex items-center gap-1.5 text-xs bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                )
              )}

              {/* Deselect all */}
              <button onClick={() => { setSelected(new Set()); setConfirmingBulkDelete(false) }}
                className="text-slate-400 hover:text-white transition-colors ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {showModal && (
        <ClienteModal
          cliente={editing}
          members={members}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}

/* ── helpers ── */
function selCls(active: boolean) {
  return [
    'px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-colors',
    active ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600',
  ].join(' ')
}

function FilterSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white">
        {children}
      </select>
    </div>
  )
}
