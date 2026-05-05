'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import { AlertTriangle, Clock, CheckCircle, Phone } from 'lucide-react'
import Link from 'next/link'

type PolizaConCliente = Poliza & {
  cliente: { id: string; nombre: string; telefono: string | null } | null
}

export default function Renovaciones() {
  const [polizas, setPolizas] = useState<PolizaConCliente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const in60 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data } = await supabase
        .from('polizas')
        .select('*, cliente:clientes(id, nombre, telefono)')
        .eq('estado', 'activa')
        .gte('fecha_fin', today)
        .lte('fecha_fin', in60)
        .order('fecha_fin', { ascending: true })
      setPolizas((data as PolizaConCliente[]) || [])
      setLoading(false)
    }
    load()
  }, [])

  const urgente = polizas.filter(p => daysUntil(p.fecha_fin!) <= 15)
  const proximo30 = polizas.filter(p => daysUntil(p.fecha_fin!) > 15 && daysUntil(p.fecha_fin!) <= 30)
  const proximo60 = polizas.filter(p => daysUntil(p.fecha_fin!) > 30)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Renovaciones</h1>
        <p className="text-slate-500 text-sm mt-1">Pólizas activas que vencen en los próximos 60 días</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-700">{urgente.length}</p>
          <p className="text-xs text-red-600">Vencen en 0–15 días</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{proximo30.length}</p>
          <p className="text-xs text-amber-600">Vencen en 16–30 días</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <CheckCircle className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-700">{proximo60.length}</p>
          <p className="text-xs text-blue-600">Vencen en 31–60 días</p>
        </div>
      </div>

      {polizas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="font-medium text-slate-600">No hay renovaciones próximas</p>
          <p className="text-sm text-slate-400 mt-1">Todas las pólizas activas vencen después de 60 días</p>
        </div>
      ) : (
        <div className="space-y-3">
          {polizas.map(p => {
            const days = daysUntil(p.fecha_fin!)
            const isUrgent = days <= 15
            const isWarn = days > 15 && days <= 30
            return (
              <div key={p.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-4 ${
                isUrgent ? 'border-red-300' : isWarn ? 'border-amber-300' : 'border-slate-200'
              }`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUrgent ? 'bg-red-100' : isWarn ? 'bg-amber-100' : 'bg-blue-100'
                  }`}>
                    <span className={`text-sm font-bold ${
                      isUrgent ? 'text-red-700' : isWarn ? 'text-amber-700' : 'text-blue-700'
                    }`}>{days}d</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.cliente ? (
                        <Link href={`/clientes/${p.cliente.id}`}
                          className="font-semibold text-slate-800 hover:text-emerald-600 transition-colors">
                          {p.cliente.nombre}
                        </Link>
                      ) : <span className="font-semibold text-slate-800">—</span>}
                      <span className="text-slate-400 text-sm">·</span>
                      <span className="text-sm text-slate-600">{p.aseguradora}</span>
                      <span className="text-sm text-slate-400">{p.ramo}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400">Vence: {formatDate(p.fecha_fin)}</span>
                      {p.prima && <span className="text-xs text-slate-500">Prima: {formatCOP(p.prima)}</span>}
                      {p.numero_poliza && <span className="text-xs text-slate-400">N°: {p.numero_poliza}</span>}
                    </div>
                  </div>
                </div>
                {p.cliente?.telefono && (
                  <a href={`tel:${p.cliente.telefono}`}
                    className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors flex-shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                    {p.cliente.telefono}
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
