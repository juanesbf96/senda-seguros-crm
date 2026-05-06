'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ProspectoActividad, TipoActividadProspecto } from '@/types'
import { Phone, Mail, Users, FileText, Calculator, Plus, Trash2 } from 'lucide-react'

const TIPO_ICONS: Record<TipoActividadProspecto, React.ElementType> = {
  llamada:    Phone,
  email:      Mail,
  reunion:    Users,
  nota:       FileText,
  cotizacion: Calculator,
}

const TIPO_LABELS: Record<TipoActividadProspecto, string> = {
  llamada:    'Llamada',
  email:      'Email',
  reunion:    'Reunión',
  nota:       'Nota',
  cotizacion: 'Cotización',
}

const TIPO_COLORS: Record<TipoActividadProspecto, string> = {
  llamada:    'bg-blue-100 text-blue-600',
  email:      'bg-violet-100 text-violet-600',
  reunion:    'bg-amber-100 text-amber-600',
  nota:       'bg-slate-100 text-slate-600',
  cotizacion: 'bg-emerald-100 text-emerald-600',
}

interface Props {
  prospectoId: string
}

export default function ProspectoActividades({ prospectoId }: Props) {
  const [actividades, setActividades] = useState<ProspectoActividad[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState({
    tipo:        'nota' as TipoActividadProspecto,
    descripcion: '',
    fecha:       new Date().toISOString().slice(0, 16),
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('prospecto_actividades')
      .select('*')
      .eq('prospecto_id', prospectoId)
      .order('fecha', { ascending: false })
    setActividades((data || []) as ProspectoActividad[])
    setLoading(false)
  }

  useEffect(() => { load() }, [prospectoId])

  async function addActividad() {
    if (!form.descripcion.trim()) return
    setSaving(true)
    await supabase.from('prospecto_actividades').insert({
      prospecto_id: prospectoId,
      tipo:         form.tipo,
      descripcion:  form.descripcion.trim(),
      fecha:        form.fecha,
    })
    setForm(f => ({ ...f, descripcion: '' }))
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function deleteActividad(id: string) {
    await supabase.from('prospecto_actividades').delete().eq('id', id)
    setActividades(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return <div className="text-center py-4 text-slate-400 text-sm">Cargando actividades...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-700 text-sm">Actividades</h3>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
          <Plus className="w-3 h-3" /> Registrar
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoActividadProspecto }))}
                className={cls}>
                {(Object.entries(TIPO_LABELS) as [TipoActividadProspecto, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input type="datetime-local" value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className={cls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción *</label>
            <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Describe la actividad..." rows={2} className={cls} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button onClick={addActividad} disabled={saving}
              className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {actividades.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin actividades registradas</p>
      ) : (
        <div className="space-y-2">
          {actividades.map(act => {
            const Icon = TIPO_ICONS[act.tipo]
            return (
              <div key={act.id} className="flex gap-3 group">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${TIPO_COLORS[act.tipo]}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-700">{act.descripcion}</p>
                    <button onClick={() => deleteActividad(act.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {TIPO_LABELS[act.tipo]} · {new Date(act.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
