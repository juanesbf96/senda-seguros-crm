'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Tarea, PrioridadTarea, Cliente } from '@/types'
import { X, AlertCircle, ArrowUp, Minus } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  tarea?: Tarea
  clienteId?: string
  onClose: () => void
  onSaved: (fechaVencimiento?: string | null) => void
}

const PRIORIDAD_CONFIG: Record<PrioridadTarea, { label: string; cls: string; icon: React.ElementType }> = {
  normal:  { label: 'Normal',  cls: 'bg-cream-200 text-ink-500 border-ink-200',   icon: Minus },
  alta:    { label: 'Alta',    cls: 'bg-warning-soft text-ink-700 border-warning/30',   icon: ArrowUp },
  urgente: { label: 'Urgente', cls: 'bg-error-soft text-error border-error/30',         icon: AlertCircle },
}

export default function TareaModal({ tarea, clienteId, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [form, setForm] = useState({
    client_id:         tarea?.client_id || clienteId || '',
    titulo:            tarea?.titulo || '',
    descripcion:       tarea?.descripcion || '',
    fecha_vencimiento: tarea?.fecha_vencimiento || '',
    prioridad:         (tarea?.prioridad || 'normal') as PrioridadTarea,
    completada:        tarea?.completada ?? false,
    asignado_a:        tarea?.asignado_a || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!clienteId) {
      supabase.from('clientes').select('id, nombre').order('nombre')
        .then(({ data }) => setClientes(data || []))
    }
  }, [clienteId])

  function set(field: string, val: string | boolean) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    setSaving(true)
    setError('')
    const payload = {
      client_id:         form.client_id || null,
      titulo:            form.titulo.trim(),
      descripcion:       form.descripcion.trim() || null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      prioridad:         form.prioridad,
      completada:        form.completada,
      asignado_a:        form.asignado_a.trim() || null,
      workspace_id:      currentWorkspace?.id,
    }
    const { error: err } = tarea
      ? await supabase.from('tareas').update(payload).eq('id', tarea.id)
      : await supabase.from('tareas').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved(form.fecha_vencimiento || null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">{tarea ? 'Editar tarea' : 'Nueva tarea'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Título *">
            <input value={form.titulo} onChange={e => set('titulo', e.target.value)}
              placeholder="Ej: Llamar a cliente sobre renovación" className={inputCls} />
          </Field>

          {!clienteId && (
            <Field label="Cliente (opcional)">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                <option value="">Sin cliente específico</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha límite">
              <input type="date" value={form.fecha_vencimiento}
                onChange={e => set('fecha_vencimiento', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Prioridad">
              <div className="flex gap-1.5 pt-0.5">
                {(Object.entries(PRIORIDAD_CONFIG) as [PrioridadTarea, typeof PRIORIDAD_CONFIG[PrioridadTarea]][]).map(([key, { label, cls, icon: Icon }]) => (
                  <button key={key} type="button" onClick={() => set('prioridad', key)}
                    className={[
                      'flex-1 py-1.5 px-1 rounded-lg text-xs font-medium border transition-colors flex items-center justify-center gap-1',
                      form.prioridad === key ? cls : 'bg-white border-ink-200 text-ink-400 hover:border-ink-300',
                    ].join(' ')}>
                    <Icon className="w-3 h-3" />{label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="Asignado a">
            <input value={form.asignado_a} onChange={e => set('asignado_a', e.target.value)}
              placeholder="Asesor responsable..." className={inputCls} />
          </Field>

          <Field label="Descripción">
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Detalles o pasos a seguir..." rows={2} className={inputCls} />
          </Field>

          {tarea && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.completada}
                onChange={e => set('completada', e.target.checked)}
                className="w-4 h-4 rounded accent-primary-500" />
              <span className="text-sm text-ink-600">Marcar como completada</span>
            </label>
          )}

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar'}
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
