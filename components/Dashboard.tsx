'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Poliza, Etapa } from '@/types'
import { formatCOP, daysUntil } from '@/lib/utils'
import Link from 'next/link'
import { Users, FileText, AlertTriangle, TrendingUp, ChevronRight, Clock } from 'lucide-react'

const ETAPA_LABELS: Record<Etapa, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  cotizacion: 'Cotización',
  cerrado: 'Cerrado',
}

const ETAPA_COLORS: Record<Etapa, string> = {
  nuevo: 'bg-blue-100 text-blue-700',
  contactado: 'bg-amber-100 text-amber-700',
  cotizacion: 'bg-purple-100 text-purple-700',
  cerrado: 'bg-emerald-100 text-emerald-700',
}

export default function Dashboard() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from('clientes').select('*').order('created_at', { ascending: false }),
        supabase.from('polizas').select('*, cliente:clientes(nombre)').eq('estado', 'activa'),
      ])
      setClientes(c || [])
      setPolizas(p || [])
      setLoading(false)
    }
    load()
  }, [])

  const porEtapa = (etapa: Etapa) => clientes.filter(c => c.etapa === etapa).length

  const renovaciones30 = polizas.filter(p => {
    if (!p.fecha_fin) return false
    const d = daysUntil(p.fecha_fin)
    return d >= 0 && d <= 30
  })

  const renovaciones60 = polizas.filter(p => {
    if (!p.fecha_fin) return false
    const d = daysUntil(p.fecha_fin)
    return d > 30 && d <= 60
  })

  const primaTotal = polizas.reduce((sum, p) => sum + (p.prima || 0), 0)

  const recentClientes = clientes.slice(0, 5)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Resumen de Senda Seguros</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label="Total clientes"
          value={clientes.length}
          bg="bg-blue-50"
          href="/clientes"
        />
        <MetricCard
          icon={<FileText className="w-5 h-5 text-emerald-600" />}
          label="Pólizas activas"
          value={polizas.length}
          bg="bg-emerald-50"
          href="/polizas"
        />
        <MetricCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          label="Renuevan en 30 días"
          value={renovaciones30.length}
          bg="bg-amber-50"
          href="/renovaciones"
          urgent={renovaciones30.length > 0}
        />
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
          label="Prima total activa"
          value={formatCOP(primaTotal)}
          bg="bg-purple-50"
          href="/polizas"
          isString
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Pipeline de leads</h2>
            <Link href="/leads" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver pipeline <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {(['nuevo', 'contactado', 'cotizacion', 'cerrado'] as Etapa[]).map(etapa => {
              const count = porEtapa(etapa)
              const pct = clientes.length > 0 ? (count / clientes.length) * 100 : 0
              return (
                <div key={etapa}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLORS[etapa]}`}>
                      {ETAPA_LABELS[etapa]}
                    </span>
                    <span className="text-slate-600 font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        etapa === 'nuevo' ? 'bg-blue-400' :
                        etapa === 'contactado' ? 'bg-amber-400' :
                        etapa === 'cotizacion' ? 'bg-purple-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Renovaciones próximas */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Próximas renovaciones</h2>
            <Link href="/renovaciones" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {[...renovaciones30, ...renovaciones60].length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Sin renovaciones próximas</p>
          ) : (
            <div className="space-y-2">
              {[...renovaciones30, ...renovaciones60].slice(0, 5).map(p => {
                const days = daysUntil(p.fecha_fin!)
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{(p as any).cliente?.nombre || '—'}</p>
                      <p className="text-xs text-slate-500">{p.aseguradora} · {p.ramo}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                      days <= 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {days}d
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Últimos clientes */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Últimos clientes registrados</h2>
          <Link href="/clientes" className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">Nombre</th>
                <th className="pb-2 font-medium">Ciudad</th>
                <th className="pb-2 font-medium">Etapa</th>
                <th className="pb-2 font-medium">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {recentClientes.map(c => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2.5">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-slate-800 hover:text-emerald-600">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="py-2.5 text-slate-500">{c.ciudad || '—'}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLORS[c.etapa]}`}>
                      {ETAPA_LABELS[c.etapa]}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-500">{c.telefono || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  icon, label, value, bg, href, urgent, isString
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  bg: string
  href: string
  urgent?: boolean
  isString?: boolean
}) {
  return (
    <Link href={href} className={`${bg} rounded-xl p-4 border ${urgent ? 'border-amber-300' : 'border-transparent'} hover:shadow-sm transition-shadow block`}>
      <div className="flex items-center gap-2 mb-2">{icon}</div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </Link>
  )
}
