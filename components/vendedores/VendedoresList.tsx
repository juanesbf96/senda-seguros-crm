'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Vendedor } from '@/types'
import { Plus, Pencil, Trash2, UserCheck, UserX, Search } from 'lucide-react'
import VendedorModal from './VendedorModal'
import { useWorkspace } from '@/contexts/WorkspaceContext'

export default function VendedoresList() {
  const { currentWorkspace } = useWorkspace()
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Vendedor | undefined>()
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')

  async function load() {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('vendedores')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('nombre')
    setVendedores((data || []) as Vendedor[])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentWorkspace])

  async function deleteVendedor(id: string) {
    if (!confirm('¿Eliminar este vendedor? Se perderá su información.')) return
    await supabase.from('vendedores').delete().eq('id', id)
    setVendedores(prev => prev.filter(v => v.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = vendedores.filter(v => {
    const matchSearch = !search ||
      v.nombre.toLowerCase().includes(q) ||
      v.email?.toLowerCase().includes(q) ||
      v.cedula?.includes(q)
    const matchActivo =
      filtroActivo === 'todos' ? true :
      filtroActivo === 'activos' ? v.activo :
      !v.activo
    return matchSearch && matchActivo
  })

  const totalActivos   = vendedores.filter(v => v.activo).length
  const totalInactivos = vendedores.filter(v => !v.activo).length

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendedores</h1>
          <p className="text-slate-500 text-sm mt-1">
            {totalActivos} activos · {totalInactivos} inactivos
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo vendedor
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
            <UserCheck className="w-3 h-3" /> Activos
          </p>
          <p className="text-2xl font-bold text-emerald-700">{totalActivos}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium mb-1 flex items-center gap-1">
            <UserX className="w-3 h-3" /> Inactivos
          </p>
          <p className="text-2xl font-bold text-slate-600">{totalInactivos}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, cédula..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value as typeof filtroActivo)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="todos">Todos</option>
          <option value="activos">Activos</option>
          <option value="inactivos">Inactivos</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Email</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Teléfono</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Cédula</th>
              <th className="px-4 py-3 font-medium text-right">% Comisión</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{v.nombre}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{v.email || '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{v.telefono || '—'}</td>
                <td className="px-4 py-3 hidden sm:table-cell text-slate-500 text-xs font-mono">{v.cedula || '—'}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-800">{v.porcentaje_comision}%</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    v.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {v.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setEditing(v); setShowModal(true) }}
                      className="text-slate-400 hover:text-slate-700 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteVendedor(v.id)}
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
            <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay vendedores registrados</p>
          </div>
        )}
      </div>

      {showModal && (
        <VendedorModal
          vendedor={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
