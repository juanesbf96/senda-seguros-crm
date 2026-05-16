'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Siniestro, EstadoSiniestro, SiniestroAmparo, Cliente, Poliza } from '@/types'
import { X, Plus, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  siniestro?: Siniestro
  clienteId?: string
  onClose: () => void
  onSaved: () => void
}

const ESTADOS: EstadoSiniestro[] = ['reportado','en_estudio','en_pago','cerrado','rechazado']
const ESTADO_LABELS: Record<EstadoSiniestro, string> = {
  reportado:  'Reportado',
  en_estudio: 'En estudio',
  en_pago:    'En pago',
  cerrado:    'Cerrado',
  rechazado:  'Rechazado',
}
const ESTADO_COLORS: Record<EstadoSiniestro, string> = {
  reportado:  'bg-slate-500',
  en_estudio: 'bg-amber-500',
  en_pago:    'bg-blue-500',
  cerrado:    'bg-emerald-600',
  rechazado:  'bg-red-600',
}

const ASEGURADORAS = ['Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria','La Equidad','Mapfre','Positiva','Previsora','Seguros del Estado','Otro']

export default function SiniestroModal({ siniestro, clienteId, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes] = useState<Pick<Cliente,'id'|'nombre'>[]>([])
  const [polizas,  setPolizas]  = useState<Pick<Poliza,'id'|'numero_poliza'|'aseguradora'|'ramo'>[]>([])
  const [amparos,  setAmparos]  = useState<Omit<SiniestroAmparo,'id'|'siniestro_id'|'created_at'>[]>(
    siniestro?.amparos?.map(a => ({ nombre: a.nombre, valor: a.valor, estado: a.estado, notas: a.notas })) || []
  )
  const [form, setForm] = useState({
    client_id:        siniestro?.client_id        || clienteId || '',
    poliza_id:        siniestro?.poliza_id        || '',
    aseguradora:      siniestro?.aseguradora      || '',
    ramo:             siniestro?.ramo             || '',
    fecha_ocurrencia: siniestro?.fecha_ocurrencia || '',
    fecha_reporte:    siniestro?.fecha_reporte    || new Date().toISOString().slice(0,10),
    descripcion:      siniestro?.descripcion      || '',
    amparo:           siniestro?.amparo           || '',
    valor_reclamado:  siniestro?.valor_reclamado?.toString() || '',
    valor_aprobado:   siniestro?.valor_aprobado?.toString()  || '',
    estado:           (siniestro?.estado || 'reportado') as EstadoSiniestro,
    notas:            siniestro?.notas            || '',
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
    supabase.from('polizas').select('id,numero_poliza,aseguradora,ramo')
      .eq('client_id', cid).eq('eliminada', false)
      .then(({ data }) => {
        setPolizas(data || [])
        // auto-fill aseguradora/ramo from poliza
        if (data && data.length > 0 && !form.poliza_id) {
          const p = data[0]
          setForm(f => ({ ...f, aseguradora: p.aseguradora, ramo: p.ramo }))
        }
      })
  }, [form.client_id])

  useEffect(() => {
    if (!form.poliza_id) return
    const p = polizas.find(x => x.id === form.poliza_id)
    if (p) setForm(f => ({ ...f, aseguradora: p.aseguradora, ramo: p.ramo }))
  }, [form.poliza_id])

  function addAmparo() {
    setAmparos(prev => [...prev, { nombre: '', valor: null, estado: 'pendiente', notas: null }])
  }
  function updateAmparo(i: number, field: string, val: string) {
    setAmparos(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: field === 'valor' ? (parseFloat(val) || null) : val } : a))
  }
  function removeAmparo(i: number) { setAmparos(prev => prev.filter((_, idx) => idx !== i)) }

  async function save() {
    if (!form.descripcion.trim()) { setError('La descripción es obligatoria'); return }
    setSaving(true); setError('')

    const payload = {
      client_id:        form.client_id       || null,
      poliza_id:        form.poliza_id       || null,
      aseguradora:      form.aseguradora.trim() || null,
      ramo:             form.ramo.trim()        || null,
      fecha_ocurrencia: form.fecha_ocurrencia   || null,
      fecha_reporte:    form.fecha_reporte,
      descripcion:      form.descripcion.trim(),
      amparo:           form.amparo.trim()      || null,
      valor_reclamado:  form.valor_reclamado  ? parseFloat(form.valor_reclamado)  : null,
      valor_aprobado:   form.valor_aprobado   ? parseFloat(form.valor_aprobado)   : null,
      estado:           form.estado,
      notas:            form.notas.trim()     || null,
      workspace_id:     currentWorkspace?.id,
    }

    let siniestroId = siniestro?.id
    if (siniestro?.id) {
      const { error: err } = await supabase.from('siniestros').update(payload).eq('id', siniestro.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data, error: err } = await supabase.from('siniestros').insert(payload).select('id').single()
      if (err) { setError(err.message); setSaving(false); return }
      siniestroId = data.id
    }

    // Sync amparos
    if (siniestroId) {
      await supabase.from('siniestro_amparos').delete().eq('siniestro_id', siniestroId)
      const validAmparos = amparos.filter(a => a.nombre.trim())
      if (validAmparos.length > 0) {
        await supabase.from('siniestro_amparos').insert(
          validAmparos.map(a => ({ ...a, siniestro_id: siniestroId }))
        )
      }
    }

    onSaved()
  }

  const currentIdx = ESTADOS.indexOf(form.estado)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800">{siniestro ? `Siniestro #${siniestro.numero_siniestro}` : 'Nuevo siniestro'}</h2>
            {siniestro && <p className="text-xs text-slate-400 mt-0.5">Editando registro</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">

          {/* Stepper */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Estado del siniestro</p>
            <div className="flex items-center gap-0">
              {ESTADOS.map((estado, i) => {
                const isDone    = i < currentIdx
                const isCurrent = i === currentIdx
                const isLast    = i === ESTADOS.length - 1
                return (
                  <div key={estado} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => set('estado', estado)}
                      className={[
                        'flex flex-col items-center gap-1 flex-1 py-2 px-1 rounded-lg transition-all',
                        isCurrent ? 'opacity-100' : 'opacity-60 hover:opacity-80',
                      ].join(' ')}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        estado === 'rechazado' ? 'bg-red-500' :
                        isDone ? 'bg-emerald-500' :
                        isCurrent ? ESTADO_COLORS[estado] : 'bg-slate-200'
                      }`}>
                        {isDone ? <CheckCircle className="w-4 h-4" /> : estado === 'rechazado' ? <XCircle className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight ${isCurrent ? 'text-slate-800' : 'text-slate-400'}`}>
                        {ESTADO_LABELS[estado]}
                      </span>
                    </button>
                    {!isLast && (
                      <div className={`h-0.5 w-3 flex-shrink-0 ${i < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cliente + póliza */}
          <div className="grid grid-cols-2 gap-4">
            {!clienteId && (
              <Field label="Cliente">
                <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={cls}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Field>
            )}
            <Field label="Póliza">
              <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)} className={cls}>
                <option value="">Sin póliza</option>
                {polizas.map(p => <option key={p.id} value={p.id}>{p.aseguradora} · {p.numero_poliza}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Aseguradora">
              <select value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} className={cls}>
                <option value="">Seleccionar...</option>
                {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Ramo">
              <input value={form.ramo} onChange={e => set('ramo', e.target.value)} placeholder="Ej: Autos, Vida..." className={cls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha ocurrencia">
              <input type="date" value={form.fecha_ocurrencia} onChange={e => set('fecha_ocurrencia', e.target.value)} className={cls} />
            </Field>
            <Field label="Fecha reporte">
              <input type="date" value={form.fecha_reporte} onChange={e => set('fecha_reporte', e.target.value)} className={cls} />
            </Field>
          </div>

          <Field label="Descripción del siniestro *">
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Describe lo ocurrido..." rows={3} className={cls} />
          </Field>

          <Field label="Amparo principal">
            <input value={form.amparo} onChange={e => set('amparo', e.target.value)}
              placeholder="Ej: Pérdida total, Robo, Incendio..." className={cls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor reclamado (COP)">
              <input type="number" min="0" value={form.valor_reclamado} onChange={e => set('valor_reclamado', e.target.value)} placeholder="0" className={cls} />
            </Field>
            <Field label="Valor aprobado (COP)">
              <input type="number" min="0" value={form.valor_aprobado} onChange={e => set('valor_aprobado', e.target.value)} placeholder="0" className={cls} />
            </Field>
          </div>

          {/* Amparos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amparos / Coberturas</p>
              <button onClick={addAmparo} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                <Plus className="w-3 h-3" /> Agregar
              </button>
            </div>
            {amparos.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-200 rounded-lg">
                Sin amparos registrados
              </p>
            ) : (
              <div className="space-y-2">
                {amparos.map((a, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input value={a.nombre} onChange={e => updateAmparo(i, 'nombre', e.target.value)}
                      placeholder="Nombre del amparo" className={`${cls} col-span-4`} />
                    <input type="number" value={a.valor?.toString() || ''} onChange={e => updateAmparo(i, 'valor', e.target.value)}
                      placeholder="Valor" className={`${cls} col-span-3`} />
                    <select value={a.estado} onChange={e => updateAmparo(i, 'estado', e.target.value)} className={`${cls} col-span-4`}>
                      <option value="pendiente">Pendiente</option>
                      <option value="aprobado">Aprobado</option>
                      <option value="rechazado">Rechazado</option>
                    </select>
                    <button onClick={() => removeAmparo(i)} className="col-span-1 text-slate-300 hover:text-red-500 transition-colors flex justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones adicionales..." rows={2} className={cls} />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar siniestro'}
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
