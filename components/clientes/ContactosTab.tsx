'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Contacto } from '@/types'
import { Plus, Search, Pencil, Trash2, Download, Building2, User } from 'lucide-react'
import ContactoModal from './ContactoModal'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  /** Called when the contact count changes so parent can update the badge */
  onCountChange?: (count: number) => void
  /** When rendered inside a client's profile page, restrict to that client */
  clienteId?: string
}

export default function ContactosTab({ onCountChange, clienteId }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [contactos, setContactos] = useState<Contacto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Contacto | undefined>()

  async function load() {
    if (!currentWorkspace) return
    let query = supabase
      .from('contactos')
      .select('*, cliente:clientes(id, nombre)')
      .eq('workspace_id', currentWorkspace.id)
      .order('nombre')

    if (clienteId) {
      query = query.eq('client_id', clienteId)
    }

    const { data } = await query
    const list = (data || []) as Contacto[]
    setContactos(list)
    onCountChange?.(list.length)
    setLoading(false)
  }

  useEffect(() => { load() }, [clienteId, currentWorkspace])

  async function deleteContacto(id: string) {
    if (!confirm('¿Eliminar este contacto?')) return
    await supabase.from('contactos').delete().eq('id', id)
    setContactos(prev => {
      const updated = prev.filter(c => c.id !== id)
      onCountChange?.(updated.length)
      return updated
    })
  }

  function exportCSV() {
    const headers = ['Nombre', 'Cliente', 'Cargo', 'Tipo Documento', 'Número Documento']
    const rows = filtered.map(c => [
      c.nombre,
      c.cliente?.nombre || '',
      c.cargo || '',
      c.tipo_documento || '',
      c.numero_documento || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'contactos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = contactos.filter(c => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      c.nombre.toLowerCase().includes(s) ||
      c.cargo?.toLowerCase().includes(s) ||
      c.numero_documento?.includes(search) ||
      c.cliente?.nombre?.toLowerCase().includes(s)
    )
  })

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cargo, documento..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-white border border-ink-200 hover:bg-cream-100 text-ink-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo contacto
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
              <th className="px-4 py-3 font-medium">Nombre</th>
              {!clienteId && <th className="px-4 py-3 font-medium hidden md:table-cell">Cliente vinculado</th>}
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Cargo</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Tipo doc.</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">N° Documento</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-cream-200 flex items-center justify-center text-ink-400 flex-shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-ink-700">{c.nombre}</span>
                  </div>
                </td>
                {!clienteId && (
                  <td className="px-4 py-3 hidden md:table-cell">
                    {c.cliente && (
                      <div className="flex items-center gap-1.5 text-ink-400">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate max-w-[180px]">{c.cliente.nombre}</span>
                      </div>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 hidden sm:table-cell text-ink-400">
                  {c.cargo || <span className="text-ink-300">—</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-ink-400">
                  {c.tipo_documento || <span className="text-ink-300">—</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-ink-400">
                  {c.numero_documento || <span className="text-ink-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setEditing(c); setShowModal(true) }}
                      className="text-ink-400 hover:text-ink-600 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteContacto(c.id)}
                      className="text-ink-400 hover:text-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay contactos registrados</p>
            <p className="text-xs mt-1">Agrega el primer contacto vinculado a un cliente</p>
          </div>
        )}
      </div>

      {showModal && (
        <ContactoModal
          contacto={editing}
          clienteId={clienteId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
