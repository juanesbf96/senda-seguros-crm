'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Solicitud, TipoSolicitud, EstadoSolicitud, PrioridadSolicitud, Cliente, Poliza } from '@/types'
import { X } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  solicitud?: Solicitud
  clienteId?: string
  onClose: () => void
  onSaved: () => void
}

const TIPO_LABELS: Record<TipoSolicitud, string> = {
  cotizacion:  'Cotización',
  expedicion:  'Expedición',
  renovacion:  'Renovación',
  endoso:      'Endoso',
  cancelacion: 'Cancelación',
  certificado: 'Certificado',
  siniestro:   'Siniestro',
  inclusion:   'Inclusión',
  exclusion:   'Exclusión',
  otro:        'Otro',
}

const ESTADO_OPTIONS: { value: EstadoSolicitud; label: string }[] = [
  { value: 'nueva',      label: 'Nueva' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'resuelta',   label: 'Resuelta' },
  { value: 'cancelada',  label: 'Cancelada' },
  { value: 'inactiva',   label: 'Inactiva' },
]

export default function SolicitudModal({ solicitud, clienteId, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [polizas, setPolizas]   = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])

  const [form, setForm] = useState({
    client_id:    solicitud?.client_id    || clienteId || '',
    poliza_id:    solicitud?.poliza_id    || '',
    tipo:         (solicitud?.tipo        || 'cotizacion') as TipoSolicitud,
    estado:       (solicitud?.estado      || 'nueva')      as EstadoSolicitud,
    prioridad:    (solicitud?.prioridad   || 'normal')     as PrioridadSolicitud,
    descripcion:  solicitud?.descripcion  || '',
    notas:        solicitud?.notas        || '',
    fecha_limite: solicitud?.fecha_limite || '',
    asignado_a:   solicitud?.asignado_a   || '',
    ramo:         solicitud?.ramo         || '',
    riesgo:       solicitud?.riesgo       || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  useEffect(() => {
    if (!clienteId)
      supabase.from('clientes').select('id, nombre').order('nombre')
        .then(({ data }) => setClientes(data || []))
  }, [clienteId])

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
    setSaving(true); setError('')
    const payload = {
      client_id:    form.client_id    || null,
      poliza_id:    form.poliza_id    || null,
      tipo:         form.tipo,
      estado:       form.estado,
      prioridad:    form.prioridad,
      descripcion:  form.descripcion.trim()  || null,
      notas:        form.notas.trim()        || null,
      fecha_limite: form.fecha_limite        || null,
      asignado_a:   form.asignado_a.trim()   || null,
      ramo:         form.ramo.trim()         || null,
      riesgo:       form.riesgo.trim()       || null,
      workspace_id: currentWorkspace?.id,
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
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">
            {solicitud
              ? `Editar solicitud #${solicitud.numero_solicitud || ''}`
              : 'Nueva solicitud'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Número (read-only en edición) */}
          {solicitud?.numero_solicitud && (
            <div className="flex items-center gap-2 px-3 py-2 bg-cream-100 rounded-lg border border-ink-200">
              <span className="text-xs text-ink-400">N° solicitud</span>
              <span className="font-mono font-semibold text-ink-600">#{solicitud.numero_solicitud}</span>
              <span className="ml-auto text-xs text-ink-400">(auto-generado)</span>
            </div>
          )}

          {/* Cliente */}
          {!clienteId && (
            <Field label="Cliente">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                <option value="">Sin cliente específico</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          {/* Tipo y Estado */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo *">
              <select value={form.tipo} onChange={e => set('tipo', e.target.value as TipoSolicitud)} className={inputCls}>
                {(Object.entries(TIPO_LABELS) as [TipoSolicitud, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoSolicitud)} className={inputCls}>
                {ESTADO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Ramo y Riesgo */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ramo">
              <input value={form.ramo} onChange={e => set('ramo', e.target.value)}
                placeholder="Ej: Vida, SOAT, Todo Riesgo..." className={inputCls} />
            </Field>
            <Field label="Riesgo">
              <input value={form.riesgo} onChange={e => set('riesgo', e.target.value)}
                placeholder="Objeto asegurado..." className={inputCls} />
            </Field>
          </div>

          {/* Asignado a y Fecha límite */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Asignado a">
              <input value={form.asignado_a} onChange={e => set('asignado_a', e.target.value)}
                placeholder="Asesor responsable..." className={inputCls} />
            </Field>
            <Field label="Fecha límite">
              <input type="date" value={form.fecha_limite} onChange={e => set('fecha_limite', e.target.value)} className={inputCls} />
            </Field>
          </div>

          {/* Prioridad */}
          <Field label="Prioridad">
            <div className="flex gap-2">
              {(['normal', 'urgente'] as PrioridadSolicitud[]).map(p => (
                <button key={p} type="button" onClick={() => set('prioridad', p)}
                  className={[
                    'flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
                    form.prioridad === p
                      ? p === 'urgente'
                        ? 'bg-error border-error text-white'
                        : 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-white border-ink-200 text-ink-500 hover:border-ink-400',
                  ].join(' ')}>
                  {p === 'urgente' ? '⚠ Urgente' : 'Normal'}
                </button>
              ))}
            </div>
          </Field>

          {/* Póliza vinculada */}
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

          <Field label="Observaciones">
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Descripción de la solicitud..." rows={2} className={inputCls} />
          </Field>

          <Field label="Notas internas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Notas para el equipo..." rows={2} className={inputCls} />
          </Field>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar solicitud'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>{children}</div>
}
const inputCls = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
