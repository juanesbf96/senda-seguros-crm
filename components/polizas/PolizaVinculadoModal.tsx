'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaVinculado, Poliza } from '@/types'
import { X } from 'lucide-react'

interface Props {
  vinculado?: PolizaVinculado
  polizaId?: string
  onClose: () => void
  onSaved: () => void
}

export default function PolizaVinculadoModal({ vinculado, polizaId, onClose, onSaved }: Props) {
  const [polizas, setPolizas] = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])

  const [form, setForm] = useState({
    poliza_id:              vinculado?.poliza_id              || polizaId || '',
    numero_anexo_pago:      vinculado?.numero_anexo_pago      || '',
    numero_afiliado_objeto: vinculado?.numero_afiliado_objeto || '',
    fecha_inicio:           vinculado?.fecha_inicio           || '',
    beneficiario:           vinculado?.beneficiario           || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  useEffect(() => {
    if (!polizaId)
      supabase.from('polizas').select('id, numero_poliza, aseguradora, ramo')
        .eq('eliminada', false).order('created_at', { ascending: false })
        .then(({ data }) => setPolizas(data || []))
  }, [polizaId])

  async function save() {
    if (!form.poliza_id) { setError('Selecciona una póliza'); return }
    setSaving(true); setError('')
    const payload = {
      poliza_id:              form.poliza_id,
      numero_anexo_pago:      form.numero_anexo_pago.trim()      || null,
      numero_afiliado_objeto: form.numero_afiliado_objeto.trim() || null,
      fecha_inicio:           form.fecha_inicio                  || null,
      beneficiario:           form.beneficiario.trim()           || null,
    }
    const { error: err } = vinculado
      ? await supabase.from('poliza_vinculados').update(payload).eq('id', vinculado.id)
      : await supabase.from('poliza_vinculados').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{vinculado ? 'Editar vinculado' : 'Nuevo vinculado'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Póliza */}
          {!polizaId && (
            <Field label="Póliza *">
              <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)} className={inputCls}>
                <option value="">Seleccionar póliza...</option>
                {polizas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.aseguradora} · {p.ramo}{p.numero_poliza ? ` · ${p.numero_poliza}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="N° Anexo / Pago">
              <input value={form.numero_anexo_pago} onChange={e => set('numero_anexo_pago', e.target.value)}
                placeholder="Ej: 001" className={inputCls} />
            </Field>
            <Field label="N° Afiliado / Objeto asegurado">
              <input value={form.numero_afiliado_objeto} onChange={e => set('numero_afiliado_objeto', e.target.value)}
                placeholder="Ej: AF-2024-001" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha inicio">
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Beneficiario">
              <input value={form.beneficiario} onChange={e => set('beneficiario', e.target.value)}
                placeholder="Nombre beneficiario..." className={inputCls} />
            </Field>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar vinculado'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>
}
const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
