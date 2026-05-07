'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Diligencia, EstadoDiligencia, TipoDiligencia, Cliente, Poliza } from '@/types'
import { X } from 'lucide-react'

interface Props {
  diligencia?: Diligencia
  clienteId?: string
  onClose: () => void
  onSaved: () => void
}

const TIPO_LABELS: Record<TipoDiligencia, string> = {
  tramite:     'Trámite',
  certificado: 'Certificado',
  paz_y_salvo: 'Paz y salvo',
  inclusion:   'Inclusión',
  exclusion:   'Exclusión',
  endoso:      'Endoso',
  otro:        'Otro',
}

const ESTADO_LABELS: Record<EstadoDiligencia, string> = {
  pendiente:   'Pendiente',
  en_proceso:  'En proceso',
  completada:  'Completada',
  cancelada:   'Cancelada',
}

const ESTADO_COLORS: Record<EstadoDiligencia, string> = {
  pendiente:   'bg-amber-500 border-amber-500 text-white',
  en_proceso:  'bg-blue-600 border-blue-600 text-white',
  completada:  'bg-emerald-600 border-emerald-600 text-white',
  cancelada:   'bg-slate-500 border-slate-500 text-white',
}

export default function DiligenciasModal({ diligencia, clienteId, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<Pick<Cliente,'id'|'nombre'>[]>([])
  const [polizas,  setPolizas]  = useState<Pick<Poliza,'id'|'numero_poliza'|'aseguradora'>[]>([])
  const [form, setForm] = useState({
    client_id:    diligencia?.client_id   || clienteId || '',
    poliza_id:    diligencia?.poliza_id   || '',
    tipo:         (diligencia?.tipo       || 'tramite') as TipoDiligencia,
    descripcion:  diligencia?.descripcion || '',
    asignado_a:   diligencia?.asignado_a  || '',
    fecha_limite: diligencia?.fecha_limite|| '',
    estado:       (diligencia?.estado     || 'pendiente') as EstadoDiligencia,
    notas:        diligencia?.notas       || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  useEffect(() => {
    if (!clienteId) supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes(data || []))
  }, [clienteId])

  useEffect(() => {
    const cid = form.client_id
    if (!cid) { setPolizas([]); return }
    supabase.from('polizas').select('id,numero_poliza,aseguradora').eq('client_id', cid).eq('eliminada', false)
      .then(({ data }) => setPolizas(data || []))
  }, [form.client_id])

  async function save() {
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria'); return }
    setSaving(true); setError('')

    const payload = {
      client_id:    form.client_id    || null,
      poliza_id:    form.poliza_id    || null,
      tipo:         form.tipo,
      descripcion:  form.descripcion.trim(),
      asignado_a:   form.asignado_a.trim() || null,
      fecha_limite: form.fecha_limite || null,
      estado:       form.estado,
      notas:        form.notas.trim() || null,
    }

    const { error: err } = diligencia
      ? await supabase.from('diligencias').update(payload).eq('id', diligencia.id)
      : await supabase.from('diligencias').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {diligencia ? `Diligencia #${diligencia.numero_diligencia}` : 'Nueva diligencia'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">

          <Field label="Tipo de diligencia *">
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={cls}>
              {(Object.entries(TIPO_LABELS) as [TipoDiligencia,string][]).map(([k,v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          {!clienteId && (
            <Field label="Cliente">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={cls}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          {polizas.length > 0 && (
            <Field label="Póliza asociada">
              <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)} className={cls}>
                <option value="">Sin póliza</option>
                {polizas.map(p => <option key={p.id} value={p.id}>{p.aseguradora} · {p.numero_poliza}</option>)}
              </select>
            </Field>
          )}

          <Field label="Descripción *">
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Describe la diligencia a realizar..." rows={3} className={cls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Asignado a">
              <input value={form.asignado_a} onChange={e => set('asignado_a', e.target.value)}
                placeholder="Nombre del responsable" className={cls} />
            </Field>
            <Field label="Fecha límite">
              <input type="date" value={form.fecha_limite} onChange={e => set('fecha_limite', e.target.value)} className={cls} />
            </Field>
          </div>

          <Field label="Estado">
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(ESTADO_LABELS) as [EstadoDiligencia,string][]).map(([k,v]) => (
                <button key={k} type="button" onClick={() => set('estado', k)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    form.estado === k ? ESTADO_COLORS[k] : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}>{v}</button>
              ))}
            </div>
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..." rows={2} className={cls} />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar diligencia'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>
}
const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
