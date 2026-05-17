'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Etapa } from '@/types'
import { Plus, Phone, Mail, MapPin, Lock } from 'lucide-react'
import Link from 'next/link'
import ClienteModal from '@/components/clientes/ClienteModal'
import { usePermissions } from '@/contexts/PermissionsContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const ETAPAS: { id: Etapa; label: string; color: string; header: string }[] = [
  { id: 'nuevo', label: 'Nuevo', color: 'border-t-blue-500', header: 'bg-info/10' },
  { id: 'contactado', label: 'Contactado', color: 'border-t-warning', header: 'bg-warning-soft' },
  { id: 'cotizacion', label: 'Cotización', color: 'border-t-purple-500', header: 'bg-purple-50' },
  { id: 'cerrado', label: 'Cerrado', color: 'border-t-primary-500', header: 'bg-primary-50' },
]

const ETAPA_DOT: Record<Etapa, string> = {
  nuevo: 'bg-info/100',
  contactado: 'bg-warning',
  cotizacion: 'bg-purple-500',
  cerrado: 'bg-primary-500',
}

export default function Pipeline() {
  const { can } = usePermissions()
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)

  async function load() {
    if (!currentWorkspace) return
    const { data } = await supabase.from('clientes').select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentWorkspace])

  async function moveToEtapa(clienteId: string, etapa: Etapa) {
    if (!currentWorkspace) return
    await supabase.from('clientes').update({ etapa }).eq('id', clienteId).eq('workspace_id', currentWorkspace.id)
    setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, etapa } : c))
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    setDragging(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent, etapa: Etapa) {
    e.preventDefault()
    if (dragging) moveToEtapa(dragging, etapa)
    setDragging(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  if (!can('pipeline_ver')) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-ink-400">
      <Lock className="w-10 h-10 opacity-40" />
      <p className="text-sm font-medium">Sin acceso al Pipeline</p>
      <p className="text-xs">No tienes permiso para ver esta sección.</p>
    </div>
  )

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Pipeline de Leads</h1>
          <p className="text-ink-400 text-sm mt-1">{clientes.length} contacto{clientes.length !== 1 ? 's' : ''} en total</p>
        </div>
        {can('pipeline_ver') && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo contacto
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
        {ETAPAS.map(etapa => {
          const cols = clientes.filter(c => c.etapa === etapa.id)
          return (
            <div
              key={etapa.id}
              className="flex-shrink-0 w-72 flex flex-col"
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, etapa.id)}
            >
              <div className={`${etapa.header} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${ETAPA_DOT[etapa.id]}`} />
                  <span className="font-semibold text-ink-600 text-sm">{etapa.label}</span>
                </div>
                <span className="text-xs bg-white text-ink-500 px-2 py-0.5 rounded-full font-medium shadow-sm">
                  {cols.length}
                </span>
              </div>

              <div
                className={`flex-1 bg-cream-200 rounded-b-xl border-t-4 ${etapa.color} min-h-[200px] p-2 space-y-2 overflow-y-auto scrollbar-thin`}
                style={{ maxHeight: 'calc(100vh - 220px)' }}
              >
                {cols.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={e => handleDragStart(e, c.id)}
                    className="bg-white rounded-lg p-3 shadow-sm border border-ink-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <Link href={`/clientes/${c.id}`} className="block">
                      <p className="font-semibold text-ink-700 text-sm hover:text-primary-500 transition-colors">
                        {c.nombre}
                      </p>
                    </Link>
                    <div className="mt-2 space-y-1">
                      {c.telefono && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-400">
                          <Phone className="w-3 h-3" />
                          {c.telefono}
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-400 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.ciudad && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-400">
                          <MapPin className="w-3 h-3" />
                          {c.ciudad}
                        </div>
                      )}
                    </div>
                    {c.notas && (
                      <p className="mt-2 text-xs text-ink-400 line-clamp-2 border-t border-cream-200 pt-2">
                        {c.notas}
                      </p>
                    )}
                    {/* Quick move */}
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {ETAPAS.filter(e => e.id !== c.etapa).map(e => (
                        <button
                          key={e.id}
                          onClick={() => moveToEtapa(c.id, e.id)}
                          className="text-xs text-ink-400 hover:text-ink-600 transition-colors"
                        >
                          → {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {cols.length === 0 && (
                  <p className="text-center text-xs text-ink-400 py-8">
                    Arrastra aquí para mover
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <ClienteModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
