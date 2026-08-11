'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Contacto, Cliente } from '@/types'
import { X } from 'lucide-react'

interface Props {
  contacto?: Contacto
  clienteId?: string        // pre-selected cliente when opening from a client's profile
  onClose: () => void
  onSaved: () => void
}

const TIPOS_DOC = ['Cédula', 'NIT', 'CE', 'Pasaporte', 'Otro']

export default function ContactoModal({ contacto, clienteId, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [form, setForm] = useState({
    client_id: contacto?.client_id || clienteId || '',
    nombre: contacto?.nombre || '',
    tipo_documento: contacto?.tipo_documento || '',
    numero_documento: contacto?.numero_documento || '',
    cargo: contacto?.cargo || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('clientes')
      .select('id, nombre')
      .eq('workspace_id', currentWorkspace?.id ?? '')
      .order('nombre')
      .then(({ data }) => setClientes(data || []))
  }, [])

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!form.client_id) { setError('Selecciona el cliente vinculado'); return }
    setSaving(true)
    setError('')

    const payload = {
      client_id: form.client_id,
      nombre: form.nombre.trim(),
      tipo_documento: form.tipo_documento || null,
      numero_documento: form.numero_documento.trim() || null,
      cargo: form.cargo.trim() || null,
    }

    const { error: err } = contacto
      ? await supabase.from('contactos').update(payload).eq('id', contacto.id)
      // El insert lleva workspace_id: sin él la fila nace huérfana y la RLS por
      // workspace la dejaría invisible para todos.
      : await supabase.from('contactos').insert({ ...payload, workspace_id: currentWorkspace?.id })

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">
            {contacto ? 'Editar contacto' : 'Nuevo contacto'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Cliente vinculado *">
            <select
              value={form.client_id}
              onChange={e => set('client_id', e.target.value)}
              disabled={!!clienteId}
              className={inputCls}
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </Field>

          <Field label="Nombre completo *">
            <input
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: María Torres"
              className={inputCls}
            />
          </Field>

          <Field label="Cargo / Rol">
            <input
              value={form.cargo}
              onChange={e => set('cargo', e.target.value)}
              placeholder="Ej: Gerente, Representante legal"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo de documento">
              <select
                value={form.tipo_documento}
                onChange={e => set('tipo_documento', e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccionar...</option>
                {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de documento">
              <input
                value={form.numero_documento}
                onChange={e => set('numero_documento', e.target.value)}
                placeholder="12345678"
                className={inputCls}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors"
          >
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
      <label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
