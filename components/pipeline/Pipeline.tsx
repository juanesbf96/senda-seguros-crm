'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Etapa } from '@/types'
import { Plus, Phone, Mail, MapPin, Lock } from 'lucide-react'
import Link from 'next/link'
import ClienteModal from '@/components/clientes/ClienteModal'
import { usePermissions } from '@/contexts/PermissionsContext'

const ETAPAS: { id: Etapa; label: string; color: string; header: string }[] = [
  { id: 'nuevo', label: 'Nuevo', color: 'border-t-blue-500', header: 'bg-blue-50' },
  { id: 'contactado', label: 'Contactado', color: 'border-t-amber-500', header: 'bg-amber-50' },
  { id: 'cotizacion', label: 'Cotización', color: 'border-t-purple-500', header: 'bg-purple-50' },
  { id: 'cerrado', label: 'Cerrado', color: 'border-t-emerald-500', header: 'bg-emerald-50' },
]

const ETAPA_DOT: Record<Etapa, string> = {
  nuevo: 'bg-blue-500',
  contactado: 'bg-amber-500',
  cotizacion: 'bg-purple-500',
  cerrado: 'bg-emerald-500',
}

export default function Pipeline() {
  const { can } = usePermissions()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('clientes').select('*').order('created_at', { ascending: false })
    setClientes(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function moveToEtapa(clienteId: string, etapa: Etapa) {
    await supabase.from('clientes').update({ etapa }).eq('id', clienteId)
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  if (!can('pipeline_ver')) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
      <Lock className="w-10 h-10 opacity-40" />
      <p className="text-sm font-medium">Sin acceso al Pipeline</p>
      <p className="text-xs">No tienes permiso para ver esta sección.</p>
    </div>
  )

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline de Leads</h1>
          <p className="text-slate-500 text-sm mt-1">{clientes.length} contacto{clientes.length !== 1 ? 's' : ''} en total</p>
        </div>
        {can('pipeline_ver') && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
                  <span className="font-semibold text-slate-700 text-sm">{etapa.label}</span>
                </div>
                <span className="text-xs bg-white text-slate-600 px-2 py-0.5 rounded-full font-medium shadow-sm">
                  {cols.length}
                </span>
              </div>

              <div
                className={`flex-1 bg-slate-100 rounded-b-xl border-t-4 ${etapa.color} min-h-[200px] p-2 space-y-2 overflow-y-auto scrollbar-thin`}
                style={{ maxHeight: 'calc(100vh - 220px)' }}
              >
                {cols.map(c => (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={e => handleDragStart(e, c.id)}
                    className="bg-white rounded-lg p-3 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <Link href={`/clientes/${c.id}`} className="block">
                      <p className="font-semibold text-slate-800 text-sm hover:text-emerald-600 transition-colors">
                        {c.nombre}
                      </p>
                    </Link>
                    <div className="mt-2 space-y-1">
                      {c.telefono && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Phone className="w-3 h-3" />
                          {c.telefono}
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.ciudad && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-3 h-3" />
                          {c.ciudad}
                        </div>
                      )}
                    </div>
                    {c.notas && (
                      <p className="mt-2 text-xs text-slate-400 line-clamp-2 border-t border-slate-100 pt-2">
                        {c.notas}
                      </p>
                    )}
                    {/* Quick move */}
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {ETAPAS.filter(e => e.id !== c.etapa).map(e => (
                        <button
                          key={e.id}
                          onClick={() => moveToEtapa(c.id, e.id)}
                          className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          → {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {cols.length === 0 && (
                  <p className="text-center text-xs text-slate-400 py-8">
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
