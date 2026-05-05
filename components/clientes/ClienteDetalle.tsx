'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Poliza, Actividad, TipoActividad } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import {
  ArrowLeft, Phone, Mail, MapPin, FileText, Plus, Clock,
  PhoneCall, AtSign, Users, StickyNote, Pencil, Trash2, AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import ClienteModal from './ClienteModal'
import PolizaModal from '@/components/polizas/PolizaModal'

const TIPO_ICONS: Record<TipoActividad, React.ReactNode> = {
  llamada: <PhoneCall className="w-4 h-4 text-blue-500" />,
  email: <AtSign className="w-4 h-4 text-purple-500" />,
  reunion: <Users className="w-4 h-4 text-emerald-500" />,
  nota: <StickyNote className="w-4 h-4 text-amber-500" />,
}

const ESTADO_COLORS: Record<string, string> = {
  activa: 'bg-emerald-100 text-emerald-700',
  vencida: 'bg-red-100 text-red-700',
  cancelada: 'bg-slate-100 text-slate-600',
  pendiente: 'bg-amber-100 text-amber-700',
}

export default function ClienteDetalle({ id }: { id: string }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [polizas, setPolizas] = useState<Poliza[]>([])
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditCliente, setShowEditCliente] = useState(false)
  const [showPolizaModal, setShowPolizaModal] = useState(false)
  const [editingPoliza, setEditingPoliza] = useState<Poliza | undefined>()
  const [actForm, setActForm] = useState({ tipo: 'nota' as TipoActividad, descripcion: '', fecha: new Date().toISOString().split('T')[0] })
  const [savingAct, setSavingAct] = useState(false)

  async function load() {
    const [{ data: c }, { data: p }, { data: a }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('polizas').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('actividades').select('*').eq('client_id', id).order('fecha', { ascending: false }),
    ])
    setCliente(c)
    setPolizas(p || [])
    setActividades(a || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveActividad() {
    if (!actForm.descripcion.trim()) return
    setSavingAct(true)
    await supabase.from('actividades').insert({
      client_id: id,
      tipo: actForm.tipo,
      descripcion: actForm.descripcion.trim(),
      fecha: actForm.fecha,
    })
    setActForm({ tipo: 'nota', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
    setSavingAct(false)
    load()
  }

  async function deleteActividad(actId: string) {
    await supabase.from('actividades').delete().eq('id', actId)
    setActividades(prev => prev.filter(a => a.id !== actId))
  }

  async function deletePoliza(polizaId: string) {
    if (!confirm('¿Eliminar esta póliza?')) return
    await supabase.from('polizas').delete().eq('id', polizaId)
    setPolizas(prev => prev.filter(p => p.id !== polizaId))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )
  if (!cliente) return <div className="p-6 text-slate-500">Cliente no encontrado.</div>

  const ETAPA_COLORS: Record<string, string> = {
    nuevo: 'bg-blue-100 text-blue-700',
    contactado: 'bg-amber-100 text-amber-700',
    cotizacion: 'bg-purple-100 text-purple-700',
    cerrado: 'bg-emerald-100 text-emerald-700',
  }
  const ETAPA_LABELS: Record<string, string> = {
    nuevo: 'Nuevo', contactado: 'Contactado', cotizacion: 'Cotización', cerrado: 'Cerrado'
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/clientes" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-3">
          <ArrowLeft className="w-4 h-4" /> Volver a clientes
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{cliente.nombre}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLORS[cliente.etapa]}`}>
                {ETAPA_LABELS[cliente.etapa]}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              {cliente.telefono && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone className="w-3.5 h-3.5" />{cliente.telefono}
                </span>
              )}
              {cliente.email && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Mail className="w-3.5 h-3.5" />{cliente.email}
                </span>
              )}
              {cliente.ciudad && (
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="w-3.5 h-3.5" />{cliente.ciudad}, {cliente.departamento}
                </span>
              )}
              {cliente.cedula && (
                <span className="text-sm text-slate-500">CC: {cliente.cedula}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowEditCliente(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Pencil className="w-4 h-4" /> Editar
          </button>
        </div>
        {cliente.notas && (
          <p className="mt-3 text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
            {cliente.notas}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pólizas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" /> Pólizas ({polizas.length})
            </h2>
            <button
              onClick={() => { setEditingPoliza(undefined); setShowPolizaModal(true) }}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva póliza
            </button>
          </div>

          {polizas.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin pólizas registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {polizas.map(p => {
                const days = p.fecha_fin ? daysUntil(p.fecha_fin) : null
                const urgent = days !== null && days >= 0 && days <= 30
                return (
                  <div key={p.id} className={`bg-white rounded-xl border p-4 ${urgent ? 'border-amber-300' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800">{p.aseguradora}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600">{p.ramo}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[p.estado]}`}>
                            {p.estado}
                          </span>
                          {urgent && (
                            <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" /> Vence en {days}d
                            </span>
                          )}
                        </div>
                        {p.numero_poliza && <p className="text-xs text-slate-400 mt-1">Póliza: {p.numero_poliza}</p>}
                      </div>
                      <div className="flex gap-2 ml-2">
                        <button onClick={() => { setEditingPoliza(p); setShowPolizaModal(true) }}
                          className="text-slate-400 hover:text-slate-700">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deletePoliza(p.id)}
                          className="text-slate-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-500">
                      {p.prima && (
                        <div>
                          <p className="text-slate-400">Prima</p>
                          <p className="font-semibold text-slate-700">{formatCOP(p.prima)}</p>
                        </div>
                      )}
                      {p.fecha_inicio && (
                        <div>
                          <p className="text-slate-400">Inicio</p>
                          <p>{formatDate(p.fecha_inicio)}</p>
                        </div>
                      )}
                      {p.fecha_fin && (
                        <div>
                          <p className="text-slate-400">Vencimiento</p>
                          <p className={urgent ? 'text-amber-700 font-medium' : ''}>{formatDate(p.fecha_fin)}</p>
                        </div>
                      )}
                    </div>
                    {p.notas && <p className="mt-2 text-xs text-slate-400 italic">{p.notas}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Historial de actividades */}
        <div>
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Historial
          </h2>

          {/* Form nueva actividad */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
            <div className="flex gap-2 mb-2">
              {(['llamada', 'email', 'reunion', 'nota'] as TipoActividad[]).map(t => (
                <button key={t}
                  onClick={() => setActForm(f => ({ ...f, tipo: t }))}
                  className={`flex-1 py-1 text-xs rounded-lg capitalize transition-colors ${
                    actForm.tipo === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <textarea
              value={actForm.descripcion}
              onChange={e => setActForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Descripción de la actividad..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none mb-2"
            />
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={actForm.fecha}
                onChange={e => setActForm(f => ({ ...f, fecha: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={saveActividad}
                disabled={savingAct || !actForm.descripcion.trim()}
                className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {savingAct ? '...' : 'Registrar'}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin">
            {actividades.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6">Sin actividades registradas</p>
            ) : actividades.map(a => (
              <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {TIPO_ICONS[a.tipo]}
                    <span className="text-xs text-slate-500">{new Date(a.fecha).toLocaleDateString('es-CO')}</span>
                  </div>
                  <button onClick={() => deleteActividad(a.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm text-slate-700 mt-1">{a.descripcion}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showEditCliente && (
        <ClienteModal
          cliente={cliente}
          onClose={() => setShowEditCliente(false)}
          onSaved={() => { setShowEditCliente(false); load() }}
        />
      )}

      {showPolizaModal && (
        <PolizaModal
          poliza={editingPoliza}
          clientId={id}
          onClose={() => setShowPolizaModal(false)}
          onSaved={() => { setShowPolizaModal(false); load() }}
        />
      )}
    </div>
  )
}
