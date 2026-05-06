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
  borrador:  { label: 'Borrador',  cls: 'bg-slate-100 text-slate-600',     icon: FileEdit     },
  enviada:   { label: 'Enviada',   cls: 'bg-blue-100 text-blue-700',       icon: SendHorizonal },
  recibida:  { label: 'Recibida',  cls: 'bg-amber-100 text-amber-700',     icon: FileClock    },
  aprobada:  { label: 'Aprobada',  cls: 'bg-emerald-100 text-emerald-700', icon: FileCheck2   },
  rechazada: { label: 'Rechazada', cls: 'bg-red-100 text-red-700',         icon: FileX2       },
  anulada:   { label: 'Anulada',   cls: 'bg-slate-100 text-slate-400',     icon: Ban          },
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Remisiones</h1>
          <p className="text-slate-500 text-sm mt-1">
            {activas.length} activas · {anuladas.length} anuladas
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nueva remisión
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {([
          { key: 'activas',  label: 'Activas',  count: activas.length },
          { key: 'anuladas', label: 'Anuladas', count: anuladas.length },
        ] as { key: Tab; label: string; count: number }[]).map(({ key, label, count }) => (
          <button key={key} onClick={() => { setActiveTab(key); setFilterEstado('all') }}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}>
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
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
                  filterEstado === key ? `${cls} border-current` : 'bg-white border-slate-200 hover:border-slate-300',
                ].join(' ')}>
                <Icon className={`w-4 h-4 mx-auto mb-1 ${filterEstado === key ? '' : 'text-slate-400'}`} />
                <p className={`text-lg font-bold ${filterEstado === key ? '' : 'text-slate-700'}`}>{cnt}</p>
                <p className={`text-xs truncate ${filterEstado === key ? '' : 'text-slate-500'}`}>{label}</p>
              </button>
            )
          })}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N°, cliente, aseguradora, ramo..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
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
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {r.numero_remision ? `#${r.numero_remision}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.client_id
                      ? <Link href={`/clientes/${r.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">{r.cliente?.nombre || '—'}</Link>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{r.aseguradora}</p>
                    <p className="text-xs text-slate-400">{r.ramo}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs max-w-[200px]">
                    <span className="line-clamp-2">{r.descripcion || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">{formatFecha(r.fecha)}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
                      <Icon className="w-3 h-3" />{label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(r); setShowModal(true) }}
                        className="text-slate-400 hover:text-slate-700 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteRemision(r.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors">
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
          <div className="text-center py-12 text-slate-400">
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
