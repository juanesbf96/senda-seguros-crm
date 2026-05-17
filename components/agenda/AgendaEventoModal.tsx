'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { AgendaEvento, TipoEvento, Cliente, Poliza, Prospecto } from '@/types'
import { X, Trash2, Calendar, Clock, User, FileText, TrendingUp, Tag } from 'lucide-react'

interface Props {
  evento?: Partial<AgendaEvento>
  fechaInicial?: Date
  onClose: () => void
  onSaved: () => void
  onDeleted?: () => void
}

const TIPO_LABELS: Record<TipoEvento, string> = {
  evento:       'Evento',
  reunion:      'Reunión',
  llamada:      'Llamada',
  recordatorio: 'Recordatorio',
  otro:         'Otro',
}

const COLORES = [
  { val: '#10b981', label: 'Verde' },
  { val: '#3b82f6', label: 'Azul' },
  { val: '#8b5cf6', label: 'Violeta' },
  { val: '#f59e0b', label: 'Amarillo' },
  { val: '#ef4444', label: 'Rojo' },
  { val: '#ec4899', label: 'Rosa' },
  { val: '#14b8a6', label: 'Teal' },
  { val: '#64748b', label: 'Gris' },
]

function toLocalInput(dt: string | Date | undefined): string {
  if (!dt) return ''
  const d = typeof dt === 'string' ? new Date(dt) : dt
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toDateInput(dt: string | Date | undefined): string {
  if (!dt) return ''
  const d = typeof dt === 'string' ? new Date(dt) : dt
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

export default function AgendaEventoModal({ evento, fechaInicial, onClose, onSaved, onDeleted }: Props) {
  const isNew = !evento?.id
  const baseDate = fechaInicial || (evento?.fecha_inicio ? new Date(evento.fecha_inicio) : new Date())
  const baseEnd  = new Date(baseDate.getTime() + 60 * 60 * 1000)

  const [form, setForm] = useState({
    titulo:       evento?.titulo       || '',
    descripcion:  evento?.descripcion  || '',
    fecha_inicio: evento?.fecha_inicio ? toLocalInput(evento.fecha_inicio) : toLocalInput(baseDate),
    fecha_fin:    evento?.fecha_fin    ? toLocalInput(evento.fecha_fin)    : toLocalInput(baseEnd),
    todo_el_dia:  evento?.todo_el_dia  ?? false,
    color:        evento?.color        || '#10b981',
    tipo:         (evento?.tipo        || 'evento') as TipoEvento,
    notas:        evento?.notas        || '',
    client_id:    evento?.client_id    || '',
    poliza_id:    evento?.poliza_id    || '',
    prospecto_id: evento?.prospecto_id || '',
  })

  const [clientes,   setClientes]   = useState<Pick<Cliente,  'id' | 'nombre'>[]>([])
  const [polizas,    setPolizas]    = useState<Pick<Poliza,   'id' | 'numero_poliza' | 'aseguradora'>[]>([])
  const [prospectos, setProspectos] = useState<Pick<Prospecto,'id' | 'nombre'>[]>([])
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('clientes').select('id, nombre').order('nombre'),
      supabase.from('prospectos').select('id, nombre').order('nombre'),
    ]).then(([c, p]) => {
      setClientes(c.data || [])
      setProspectos(p.data || [])
    })
  }, [])

  useEffect(() => {
    if (!form.client_id) { setPolizas([]); return }
    supabase.from('polizas').select('id, numero_poliza, aseguradora')
      .eq('client_id', form.client_id).eq('eliminada', false)
      .then(({ data }) => setPolizas(data || []))
  }, [form.client_id])

  function set(field: string, val: string | boolean) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    if (!form.titulo.trim()) { setError('El título es obligatorio'); return }
    setSaving(true); setError('')

    const toISO = (val: string, allDay: boolean) => {
      if (allDay) return new Date(val + 'T00:00:00').toISOString()
      return new Date(val).toISOString()
    }

    const payload = {
      titulo:       form.titulo.trim(),
      descripcion:  form.descripcion.trim() || null,
      fecha_inicio: toISO(form.todo_el_dia ? toDateInput(form.fecha_inicio) : form.fecha_inicio, form.todo_el_dia),
      fecha_fin:    toISO(form.todo_el_dia ? toDateInput(form.fecha_fin)    : form.fecha_fin,    form.todo_el_dia),
      todo_el_dia:  form.todo_el_dia,
      color:        form.color,
      tipo:         form.tipo,
      notas:        form.notas.trim() || null,
      client_id:    form.client_id    || null,
      poliza_id:    form.poliza_id    || null,
      prospecto_id: form.prospecto_id || null,
    }

    const { error: err } = evento?.id
      ? await supabase.from('agenda_eventos').update(payload).eq('id', evento.id)
      : await supabase.from('agenda_eventos').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  async function handleDelete() {
    if (!evento?.id || !confirm('¿Eliminar este evento?')) return
    setDeleting(true)
    await supabase.from('agenda_eventos').delete().eq('id', evento.id)
    onDeleted?.()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header con color */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: form.color }} />
            <h2 className="font-semibold text-ink-700">{isNew ? 'Nuevo evento' : 'Editar evento'}</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button onClick={handleDelete} disabled={deleting}
                className="text-ink-300 hover:text-error transition-colors p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-ink-300 hover:text-ink-500 transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Título */}
          <input
            value={form.titulo}
            onChange={e => set('titulo', e.target.value)}
            placeholder="Título del evento..."
            className="w-full text-lg font-medium placeholder-ink-300 border-0 border-b border-ink-200 pb-2 focus:outline-none focus:border-primary-400 transition-colors"
          />

          {/* Tipo */}
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-ink-400 flex-shrink-0" />
            {(Object.entries(TIPO_LABELS) as [TipoEvento, string][]).map(([k, v]) => (
              <button key={k} type="button" onClick={() => set('tipo', k)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  form.tipo === k
                    ? 'text-white border-transparent'
                    : 'bg-white border-ink-200 text-ink-400 hover:border-ink-400'
                }`}
                style={form.tipo === k ? { background: form.color } : {}}>
                {v}
              </button>
            ))}
          </div>

          {/* Color */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-400 w-12">Color</span>
            <div className="flex gap-1.5">
              {COLORES.map(c => (
                <button key={c.val} type="button" onClick={() => set('color', c.val)}
                  title={c.label}
                  className={`w-5 h-5 rounded-full transition-transform ${form.color === c.val ? 'scale-125 ring-2 ring-offset-1 ring-ink-400' : 'hover:scale-110'}`}
                  style={{ background: c.val }} />
              ))}
            </div>
          </div>

          {/* Todo el día */}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="todo_el_dia" checked={form.todo_el_dia}
              onChange={e => set('todo_el_dia', e.target.checked)}
              className="rounded border-ink-300 text-primary-500 focus:ring-primary-400" />
            <label htmlFor="todo_el_dia" className="text-sm text-ink-500">Todo el día</label>
          </div>

          {/* Fechas */}
          <div className="bg-cream-100 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-ink-400 flex-shrink-0" />
              <div className="flex-1 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-ink-400 block mb-1">Inicio</label>
                  {form.todo_el_dia
                    ? <input type="date" value={toDateInput(form.fecha_inicio)}
                        onChange={e => set('fecha_inicio', e.target.value + 'T00:00')}
                        className={inputCls} />
                    : <input type="datetime-local" value={form.fecha_inicio}
                        onChange={e => set('fecha_inicio', e.target.value)}
                        className={inputCls} />
                  }
                </div>
                <div>
                  <label className="text-xs text-ink-400 block mb-1">Fin</label>
                  {form.todo_el_dia
                    ? <input type="date" value={toDateInput(form.fecha_fin)}
                        onChange={e => set('fecha_fin', e.target.value + 'T23:59')}
                        className={inputCls} />
                    : <input type="datetime-local" value={form.fecha_fin}
                        onChange={e => set('fecha_fin', e.target.value)}
                        className={inputCls} />
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <textarea
              value={form.descripcion}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Descripción del evento..."
              rows={3}
              className="w-full text-sm text-ink-600 placeholder-ink-300 border border-ink-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>

          {/* Vincular a CRM */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Vincular al CRM</p>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-ink-300 flex-shrink-0" />
              <select value={form.client_id} onChange={e => { set('client_id', e.target.value); set('poliza_id', '') }}
                className={selectCls}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            {polizas.length > 0 && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-ink-300 flex-shrink-0" />
                <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)}
                  className={selectCls}>
                  <option value="">Sin póliza</option>
                  {polizas.map(p => (
                    <option key={p.id} value={p.id}>{p.aseguradora} · {p.numero_poliza}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-ink-300 flex-shrink-0" />
              <select value={form.prospecto_id} onChange={e => set('prospecto_id', e.target.value)}
                className={selectCls}>
                <option value="">Sin prospecto</option>
                {prospectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>

          {/* Notas */}
          <div>
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Notas adicionales, recordatorios, detalles..."
              rows={3}
              className="w-full text-sm text-ink-500 placeholder-ink-300 border border-ink-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          </div>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-60 transition-colors"
            style={{ background: form.color }}>
            {saving ? 'Guardando...' : isNew ? 'Crear evento' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = "w-full px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
const selectCls = "flex-1 px-2 py-1.5 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white text-ink-500"
