'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Etapa, TipoCliente } from '@/types'
import { Plus, Search, Phone, MapPin, Pencil, Trash2, Upload, Users, UserSquare2, SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import ClienteModal from './ClienteModal'
import ImportModal from './ImportModal'
import ContactosTab from './ContactosTab'

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

type Tab = 'clientes' | 'contactos'

interface Filters {
  etapa:       Etapa | 'all'
  tipo:        TipoCliente | 'all'
  categoria:   string
  departamento:string
  genero:      string
  vehiculo:    string   // 'all' | 'si' | 'no'
  autoriza:    string   // 'all' | 'si' | 'no'
}

const defaultFilters: Filters = {
  etapa: 'all', tipo: 'all', categoria: '', departamento: '', genero: '', vehiculo: 'all', autoriza: 'all',
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
  ].filter(Boolean).length
}

export default function ClientesList() {
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

  async function load() {
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }

  async function loadContactCount() {
    const { count } = await supabase.from('contactos').select('*', { count: 'exact', head: true })
    setContactCount(count || 0)
  }

  useEffect(() => { load(); loadContactCount() }, [])

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

    return matchSearch && matchEtapa && matchTipo && matchCategoria && matchDepto && matchGenero && matchVehiculo && matchAutoriza
  })

  const activeFilterCount = countActiveFilters(filters)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activeTab === 'clientes'
              ? `${filtered.length} de ${clientes.length} registros`
              : `${contactCount} contactos vinculados`}
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'clientes' && (
            <>
              <button onClick={() => setShowImport(true)}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" /> Importar CSV
              </button>
              <button onClick={() => { setEditing(undefined); setShowModal(true) }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Nuevo cliente
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {[
          { key: 'clientes' as Tab, label: 'Clientes', icon: Users, count: clientes.length },
          { key: 'contactos' as Tab, label: 'Contactos', icon: UserSquare2, count: contactCount },
        ].map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}>
            <Icon className="w-4 h-4" />
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {activeTab === 'contactos' ? (
        <ContactosTab onCountChange={setContactCount} />
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
            </div>
          )}

          {/* ── Tabla ── */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Cédula / NIT</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Ciudad</th>
                  <th className="px-4 py-3 font-medium">Etapa</th>
                  <th className="px-4 py-3 font-medium hidden xl:table-cell">Categoría</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditing(c); setShowModal(true) }}
                          className="text-slate-400 hover:text-slate-700 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteCliente(c.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
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
        </>
      )}

      {showModal && (
        <ClienteModal
          cliente={editing}
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
