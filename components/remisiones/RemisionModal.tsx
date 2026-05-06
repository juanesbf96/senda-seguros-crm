'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Remision, EstadoRemision, Cliente, Poliza } from '@/types'
import { X } from 'lucide-react'

const ASEGURADORAS = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado','Otro',
]
const RAMOS = [
  'Vida Individual','Vida Grupo','SOAT','Todo Riesgo Vehículo','Responsabilidad Civil',
  'Hogar','Incendio','Empresarial','Salud','ARL','Transportes','Agrícola','Fianzas','Cumplimiento','Otros',
]
const ESTADO_LABELS: Record<EstadoRemision, string> = {
  borrador: 'Borrador', enviada: 'Enviada', recibida: 'Recibida',
  aprobada: 'Aprobada', rechazada: 'Rechazada',
}

interface Props {
  remision?: Remision
  clienteId?: string
  onClose: () => void
  onSaved: () => void
}

export default function RemisionModal({ remision, clienteId, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [polizas, setPolizas] = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])
  const [form, setForm] = useState({
    client_id:   remision?.client_id || clienteId || '',
    poliza_id:   remision?.poliza_id || '',
    aseguradora: remision?.aseguradora || '',
    ramo:        remision?.ramo || '',
    descripcion: remision?.descripcion || '',
    estado:      (remision?.estado || 'borrador') as EstadoRemision,
    fecha:       remision?.fecha || new Date().toISOString().split('T')[0],
    notas:       remision?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  useEffect(() => {
    if (!clienteId) {
      supabase.from('clientes').select('id, nombre').order('nombre')
        .then(({ data }) => setClientes(data || []))
    }
  }, [clienteId])

  useEffect(() => {
    const cid = form.client_id
    if (!cid) { setPolizas([]); return }
    supabase.from('polizas').select('id, numero_poliza, aseguradora, ramo')
      .eq('client_id', cid).eq('eliminada', false).order('created_at', { ascending: false })
      .then(({ data }) => setPolizas(data || []))
  }, [form.client_id])

  async function save() {
    if (!form.aseguradora || !form.ramo) { setError('Aseguradora y ramo son obligatorios'); return }
    if (!form.client_id) { setError('Selecciona un cliente'); return }
    setSaving(true)
    setError('')
    const payload = {
      client_id: form.client_id,
      poliza_id: form.poliza_id || null,
      aseguradora: form.aseguradora,
      ramo: form.ramo,
      descripcion: form.descripcion.trim() || null,
      estado: form.estado,
      fecha: form.fecha || null,
      notas: form.notas.trim() || null,
    }
    const { error: err } = remision
      ? await supabase.from('remisiones').update(payload).eq('id', remision.id)
      : await supabase.from('remisiones').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{remision ? 'Editar remisión' : 'Nueva remisión'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!clienteId && (
            <Field label="Cliente *">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={cls}>
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Aseguradora *">
              <select value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} className={cls}>
                <option value="">Seleccionar...</option>
                {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Ramo *">
              <select value={form.ramo} onChange={e => set('ramo', e.target.value)} className={cls}>
                <option value="">Seleccionar...</option>
                {RAMOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          {polizas.length > 0 && (
            <Field label="Póliza vinculada">
              <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)} className={cls}>
                <option value="">Sin póliza específica</option>
                {polizas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.aseguradora} · {p.ramo}{p.numero_poliza ? ` · ${p.numero_poliza}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Descripción / Objeto">
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Describe lo que se remite a la aseguradora..." rows={2} className={cls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Estado">
              <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoRemision)} className={cls}>
                {(Object.entries(ESTADO_LABELS) as [EstadoRemision, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha">
              <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={cls} />
            </Field>
          </div>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Documentos adjuntos, observaciones..." rows={2} className={cls} />
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
  return <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>
}
const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
