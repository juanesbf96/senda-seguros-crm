'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaAnexo, Poliza, Cliente } from '@/types'
import { X } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  anexo?: PolizaAnexo
  polizaId?: string   // pre-selected poliza
  onClose: () => void
  onSaved: () => void
}

export default function PolizaAnexoModal({ anexo, polizaId, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [polizas, setPolizas]   = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])

  const [form, setForm] = useState({
    poliza_id:    anexo?.poliza_id    || polizaId || '',
    client_id:    anexo?.client_id    || '',
    numero_anexo: anexo?.numero_anexo || '',
    estado:       (anexo?.estado      || 'activo') as 'activo' | 'inactivo' | 'cancelado',
    documento:    anexo?.documento    || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  useEffect(() => {
    if (!polizaId)
      supabase.from('polizas').select('id, numero_poliza, aseguradora, ramo')
        .eq('workspace_id', currentWorkspace?.id ?? '')
        .eq('eliminada', false).order('created_at', { ascending: false })
        .then(({ data }) => setPolizas(data || []))
    supabase.from('clientes').select('id, nombre')
      .eq('workspace_id', currentWorkspace?.id ?? '')
      .order('nombre')
      .then(({ data }) => setClientes(data || []))
  }, [polizaId])

  async function save() {
    if (!form.poliza_id) { setError('Selecciona una póliza'); return }
    setSaving(true); setError('')
    const payload = {
      poliza_id:    form.poliza_id,
      client_id:    form.client_id    || null,
      numero_anexo: form.numero_anexo.trim() || null,
      estado:       form.estado,
      documento:    form.documento.trim()    || null,
      workspace_id: currentWorkspace?.id,
    }
    const { error: err } = anexo
      ? await supabase.from('poliza_anexos').update(payload).eq('id', anexo.id)
      : await supabase.from('poliza_anexos').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">{anexo ? 'Editar anexo' : 'Nuevo anexo'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5" /></button>
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

          {/* Estado */}
          <Field label="Estado">
            <select value={form.estado} onChange={e => set('estado', e.target.value)} className={inputCls}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </Field>

          {/* Cliente */}
          <Field label="Cliente (opcional)">
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
              <option value="">Sin cliente específico</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="N° Anexo">
              <input value={form.numero_anexo} onChange={e => set('numero_anexo', e.target.value)}
                placeholder="Ej: ANX-001" className={inputCls} />
            </Field>
            <Field label="Documento">
              <input value={form.documento} onChange={e => set('documento', e.target.value)}
                placeholder="Nombre o URL doc." className={inputCls} />
            </Field>
          </div>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar anexo'}
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
