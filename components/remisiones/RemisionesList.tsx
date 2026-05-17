'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Remision, EstadoRemision } from '@/types'
import {
  Plus, Search, Pencil, Trash2,
  SendHorizonal, FileCheck2, FileClock, FileX2, FileEdit, Ban,
} from 'lucide-react'
import Link from 'next/link'
import RemisionModal from './RemisionModal'

type Tab = 'activas' | 'anuladas'

const ESTADO_CONFIG: Record<EstadoRemision, { label: string; cls: string; icon: React.ElementType }> = {
  borrador:  { label: 'Borrador',  cls: 'bg-cream-200 text-ink-500',     icon: FileEdit     },
  enviada:   { label: 'Enviada',   cls: 'bg-info/20 text-info',       icon: SendHorizonal },
  recibida:  { label: 'Recibida',  cls: 'bg-warning-soft text-ink-700',     icon: FileClock    },
  aprobada:  { label: 'Aprobada',  cls: 'bg-primary-100 text-primary-700', icon: FileCheck2   },
  rechazada: { label: 'Rechazada', cls: 'bg-error-soft text-error',         icon: FileX2       },
  anulada:   { label: 'Anulada',   cls: 'bg-cream-200 text-ink-400',     icon: Ban          },
}

const ESTADOS_ACTIVOS: EstadoRemision[] = ['borrador', 'enviada', 'recibida', 'aprobada', 'rechazada']

function formatFecha(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function RemisionesList() {
  const [remisiones, setRemisiones] = useState<Remision[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoRemision | 'all'>('all')
  const [activeTab, setActiveTab]   = useState<Tab>('activas')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Remision | undefined>()

  async function load() {
    const { data } = await supabase
      .from('remisiones')
      .select('*, cliente:clientes(id, nombre), poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .order('numero_remision', { ascending: false })
    setRemisiones((data || []) as Remision[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteRemision(id: string) {
    if (!confirm('¿Eliminar esta remisión?')) return
    await supabase.from('remisiones').delete().eq('id', id)
    setRemisiones(prev => prev.filter(r => r.id !== id))
  }

  const activas  = remisiones.filter(r => r.estado !== 'anulada')
  const anuladas = remisiones.filter(r => r.estado === 'anulada')

  const tabData = activeTab === 'activas' ? activas : anuladas

  const counts = ESTADOS_ACTIVOS.reduce((acc, k) => {
    acc[k] = activas.filter(r => r.estado === k).length
    return acc
  }, {} as Record<EstadoRemision, number>)

  const q = search.toLowerCase()
  const filtered = tabData.filter(r => {
    const matchSearch = !search ||
      r.cliente?.nombre?.toLowerCase().includes(q) ||
      r.aseguradora.toLowerCase().includes(q) ||
      r.ramo.toLowerCase().includes(q) ||
      r.descripcion?.toLowerCase().includes(q) ||
      String(r.numero_remision || '').includes(q)
    const matchEstado = filterEstado === 'all' || r.estado === filterEstado
    return matchSearch && matchEstado
  })

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Remisiones</h1>
          <p className="text-ink-400 text-sm mt-1">
            {activas.length} activas · {anuladas.length} anuladas
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nueva remisión
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-200">
        {([
          { key: 'activas',  label: 'Activas',  count: activas.length },
          { key: 'anuladas', label: 'Anuladas', count: anuladas.length },
        ] as { key: Tab; label: string; count: number }[]).map(({ key, label, count }) => (
          <button key={key} onClick={() => { setActiveTab(key); setFilterEstado('all') }}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600',
            ].join(' ')}>
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Estado summary (only on Activas tab) */}
      {activeTab === 'activas' && (
        <div className="grid grid-cols-5 gap-3 mb-5">
          {ESTADOS_ACTIVOS.map(key => {
            const { label, cls, icon: Icon } = ESTADO_CONFIG[key]
            const cnt = counts[key] || 0
            return (
              <button key={key}
                onClick={() => setFilterEstado(filterEstado === key ? 'all' : key)}
                className={[
                  'rounded-xl p-3 text-center border transition-all',
                  filterEstado === key ? `${cls} border-current` : 'bg-white border-ink-200 hover:border-ink-300',
                ].join(' ')}>
                <Icon className={`w-4 h-4 mx-auto mb-1 ${filterEstado === key ? '' : 'text-ink-400'}`} />
                <p className={`text-lg font-bold ${filterEstado === key ? '' : 'text-ink-600'}`}>{cnt}</p>
                <p className={`text-xs truncate ${filterEstado === key ? '' : 'text-ink-400'}`}>{label}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N°, cliente, aseguradora, ramo..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
              <th className="px-4 py-3 font-medium w-16">N°</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Aseg. / Ramo</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Descripción</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const { label, cls, icon: Icon } = ESTADO_CONFIG[r.estado]
              return (
                <tr key={r.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                  <td className="px-4 py-3 text-ink-400 text-xs font-mono">
                    {r.numero_remision ? `#${r.numero_remision}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.client_id
                      ? <Link href={`/clientes/${r.client_id}`} className="font-medium text-ink-700 hover:text-primary-500">{r.cliente?.nombre || '—'}</Link>
                      : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-600">{r.aseguradora}</p>
                    <p className="text-xs text-ink-400">{r.ramo}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs max-w-[200px]">
                    <span className="line-clamp-2">{r.descripcion || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-ink-400 text-xs">{formatFecha(r.fecha)}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                      <Icon className="w-3 h-3" />{label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(r); setShowModal(true) }}
                        className="text-ink-400 hover:text-ink-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteRemision(r.id)}
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
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <SendHorizonal className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay remisiones en esta sección</p>
          </div>
        )}
      </div>

      {showModal && (
        <RemisionModal remision={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
