'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import { Search, AlertTriangle, Clock } from 'lucide-react'
import Link from 'next/link'

const ESTADO_COLORS: Record<string, string> = {
  activa: 'bg-emerald-100 text-emerald-700',
  vencida: 'bg-red-100 text-red-700',
  cancelada: 'bg-slate-100 text-slate-600',
  pendiente: 'bg-amber-100 text-amber-700',
}

type PolizaConCliente = Poliza & { cliente: { nombre: string } | null }

export default function PolizasList() {
  const [polizas, setPolizas] = useState<PolizaConCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState('all')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('polizas')
        .select('*, cliente:clientes(nombre)')
        .order('fecha_fin', { ascending: true })
      setPolizas((data as PolizaConCliente[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = polizas.filter(p => {
    const nombre = p.cliente?.nombre?.toLowerCase() || ''
    const matchSearch = !search ||
      nombre.includes(search.toLowerCase()) ||
      p.aseguradora.toLowerCase().includes(search.toLowerCase()) ||
      p.ramo.toLowerCase().includes(search.toLowerCase()) ||
      p.numero_poliza?.includes(search)
    const matchEstado = filterEstado === 'all' || p.estado === filterEstado
    return matchSearch && matchEstado
  })

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  const primaTotal = polizas.filter(p => p.estado === 'activa').reduce((s, p) => s + (p.prima || 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pólizas</h1>
          <p className="text-slate-500 text-sm mt-1">
            {polizas.filter(p => p.estado === 'activa').length} activas · Prima total: {formatCOP(primaTotal)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, aseguradora, ramo, número..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="all">Todos los estados</option>
          <option value="activa">Activa</option>
          <option value="pendiente">Pendiente</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Aseguradora / Ramo</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">N° Póliza</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Prima</th>
              <th className="px-4 py-3 font-medium">Vencimiento</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const days = p.fecha_fin ? daysUntil(p.fecha_fin) : null
              const urgent = days !== null && days >= 0 && days <= 30 && p.estado === 'activa'
              const warn = days !== null && days > 30 && days <= 60 && p.estado === 'activa'
              return (
                <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${urgent ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    {p.client_id ? (
                      <Link href={`/clientes/${p.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">
                        {p.cliente?.nombre || '—'}
                      </Link>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{p.aseguradora}</p>
                    <p className="text-xs text-slate-400">{p.ramo}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{p.numero_poliza || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-700 font-medium">
                    {p.prima ? formatCOP(p.prima) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={urgent ? 'text-amber-700 font-medium' : warn ? 'text-amber-600' : 'text-slate-600'}>
                        {formatDate(p.fecha_fin)}
                      </span>
                      {urgent && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      {(urgent || warn) && days !== null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {days}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[p.estado]}`}>
                      {p.estado}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p>No se encontraron pólizas</p>
          </div>
        )}
      </div>
    </div>
  )
}
