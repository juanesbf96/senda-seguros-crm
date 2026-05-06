'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Solicitud, TipoSolicitud, EstadoSolicitud, PrioridadSolicitud, Cliente, Poliza } from '@/types'
import { X, AlertCircle } from 'lucide-react'

interface Props {
  solicitud?: Solicitud
  clienteId?: string   // pre-selected client (from profile page)
  onClose: () => void
  onSaved: () => void
}

const TIPO_LABELS: Record<TipoSolicitud, string> = {
  expedicion:   'Expedición',
  renovacion:   'Renovación',
  endoso:       'Endoso',
  cancelacion:  'Cancelación',
  certificado:  'Certificado',
  siniestro:    'Siniestro',
  inclusion:    'Inclusión',
  exclusion:    'Exclusión',
  otro:         'Otro',
}

export default function SolicitudModal({ solicitud, clienteId, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [polizas, setPolizas] = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])
  const [form, setForm] = useState({
    client_id:   solicitud?.client_id || clienteId || '',
    poliza_id:   solicitud?.poliza_id || '',
    tipo:        (solicitud?.tipo || 'expedicion') as TipoSolicitud,
    estado:      (solicitud?.estado || 'nueva') as EstadoSolicitud,
    prioridad:   (solicitud?.prioridad || 'normal') as PrioridadSolicitud,
    descripcion: solicitud?.descripcion || '',
    fecha_limite: solicitud?.fecha_limite || '',
    notas:       solicitud?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  // Load clients
  useEffect(() => {
    if (!clienteId) {
      supabase.from('clientes').select('id, nombre').order('nombre')
        .then(({ data }) => setClientes(data || []))
    }
  }, [clienteId])

  // Load policies for selected client
  useEffect(() => {
    const cid = form.client_id
    if (!cid) { setPolizas([]); return }
    supabase
      .from('polizas')
      .select('id, numero_poliza, aseguradora, ramo')
      .eq('client_id', cid)
      .eq('eliminada', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setPolizas(data || []))
  }, [form.client_id])

  async function save() {
    if (!form.client_id) { setError('Selecciona el cliente'); return }
    setSaving(true)
    setError('')
    const payload = {
      client_id:    form.client_id,
      poliza_id:    form.poliza_id || null,
      tipo:         form.tipo,
      estado:       form.estado,
      prioridad:    form.prioridad,
      descripcion:  form.descripcion.trim() || null,
      fecha_limite: form.fecha_limite || null,
      notas:        form.notas.trim() || null,
    }
    const { error: err } = solicitud
      ? await supabase.from('solicitudes').update(payload).eq('id', solicitud.id)
      : await supabase.from('solicitudes').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {solicitud ? 'Editar solicitud' : 'Nueva solicitud'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cliente */}
          {!clienteId && (
            <Field label="Cliente *">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          {/* Tipo y Prioridad */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de solicitud *">
              <select value={form.tipo} onChange={e => set('tipo', e.target.value as TipoSolicitud)} className={inputCls}>
                {(Object.entries(TIPO_LABELS) as [TipoSolicitud, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Prioridad">
              <div className="flex gap-2 pt-0.5">
                {(['normal', 'urgente'] as PrioridadSolicitud[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('prioridad', p)}
                    className={[
                      'flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
                      form.prioridad === p
                        ? p === 'urgente'
                          ? 'bg-red-600 border-red-600 text-white'
                          : 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400',
                    ].join(' ')}
                  >
                    {p === 'urgente' && <AlertCircle className="w-3 h-3 inline mr-1" />}
                    {p === 'urgente' ? 'Urgente' : 'Normal'}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Póliza vinculada (optional) */}
          {polizas.length > 0 && (
            <Field label="Póliza vinculada">
              <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)} className={inputCls}>
                <option value="">Sin póliza específica</option>
                {polizas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.aseguradora} · {p.ramo}{p.numero_poliza ? ` · ${p.numero_poliza}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Estado y Fecha límite */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Estado">
              <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoSolicitud)} className={inputCls}>
                <option value="nueva">Nueva</option>
                <option value="en_proceso">En proceso</option>
                <option value="resuelta">Resuelta</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </Field>
            <Field label="Fecha límite">
              <input type="date" value={form.fecha_limite} onChange={e => set('fecha_limite', e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="Descripción">
            <textarea
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Describe lo que se necesita..."
              rows={2}
              className={inputCls}
            />
          </Field>

          <Field label="Notas internas">
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones, documentos recibidos..."
              rows={2}
              className={inputCls}
            />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
