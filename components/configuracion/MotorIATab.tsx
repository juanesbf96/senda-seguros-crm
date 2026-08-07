'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { ProveedorIA, PROVEEDORES_IA, PROVEEDOR_LABEL, MODELO_DEFAULT } from '@/lib/ia/motor'
import { Bot, KeyRound, Check, Loader2, ShieldCheck } from 'lucide-react'

export default function MotorIATab() {
  const { currentWorkspace } = useWorkspace()
  const [proveedor, setProveedor] = useState<ProveedorIA>('groq')
  const [modelo, setModelo]       = useState('')
  const [tieneLlave, setTieneLlave] = useState(false)
  const [nuevaLlave, setNuevaLlave] = useState('')
  const [borrarLlave, setBorrarLlave] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState('')

  async function load() {
    if (!currentWorkspace) return
    setLoading(true)
    const { data, error } = await supabase.rpc('get_ia_config', { p_ws: currentWorkspace.id })
    if (error) setError(error.message)
    else {
      const row = Array.isArray(data) ? data[0] : data
      setProveedor((row?.proveedor as ProveedorIA) || 'groq')
      setModelo(row?.modelo || '')
      setTieneLlave(!!row?.tiene_llave)
    }
    setNuevaLlave(''); setBorrarLlave(false)
    setLoading(false)
  }
  useEffect(() => { load() }, [currentWorkspace?.id])

  const esGroq = proveedor === 'groq'
  const requiereLlave = !esGroq && !tieneLlave && !nuevaLlave.trim()

  async function guardar() {
    if (!currentWorkspace) return
    if (requiereLlave) { setError(`${PROVEEDOR_LABEL[proveedor]} requiere una llave de API propia`); return }
    setSaving(true); setError('')
    // p_api_key: '' borra · null conserva · valor reemplaza. Groq no usa llave → conservar.
    const p_api_key = esGroq ? null : (borrarLlave ? '' : (nuevaLlave.trim() || null))
    const { error } = await supabase.rpc('set_ia_config', {
      p_ws: currentWorkspace.id,
      p_proveedor: proveedor,
      p_modelo: modelo.trim() || null,
      p_api_key,
    })
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 3000)
    await load()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-primary-500" />
        <h2 className="font-semibold text-ink-700">Motor de IA</h2>
      </div>
      <p className="text-ink-400 text-sm mb-5">
        Elige el proveedor que usa el asistente y las funciones de IA. Con &quot;Senda incluido&quot;
        no necesitas nada; con otro proveedor usás tu propia llave (BYOK).
      </p>

      <div className="space-y-4">
        <Field label="Proveedor">
          <select value={proveedor} onChange={e => { setProveedor(e.target.value as ProveedorIA); setBorrarLlave(false) }} className={cls}>
            {PROVEEDORES_IA.map(p => <option key={p} value={p}>{PROVEEDOR_LABEL[p]}</option>)}
          </select>
        </Field>

        <Field label="Modelo">
          <input value={modelo} onChange={e => setModelo(e.target.value)}
            placeholder={`Por defecto: ${MODELO_DEFAULT[proveedor]}`} className={cls} />
          <p className="text-xs text-ink-400 mt-1">Dejalo vacío para usar el modelo por defecto del proveedor.</p>
        </Field>

        {esGroq ? (
          <div className="flex items-start gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2.5">
            <ShieldCheck className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
            <p className="text-sm text-primary-700">
              <strong>Senda incluido:</strong> el asistente funciona sin costo ni configuración con la llave compartida de Senda.
            </p>
          </div>
        ) : (
          <Field label="Llave de API (BYOK)">
            {tieneLlave && !borrarLlave && (
              <div className="flex items-center gap-2 text-sm text-primary-700 mb-2">
                <Check className="w-4 h-4" /> Hay una llave guardada.
                <button type="button" onClick={() => setBorrarLlave(true)} className="text-error hover:underline ml-1">Borrar</button>
              </div>
            )}
            {borrarLlave && (
              <div className="flex items-center gap-2 text-sm text-error mb-2">
                Se borrará la llave guardada.
                <button type="button" onClick={() => setBorrarLlave(false)} className="text-ink-500 hover:underline ml-1">Cancelar</button>
              </div>
            )}
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
              <input type="password" value={nuevaLlave} onChange={e => setNuevaLlave(e.target.value)}
                placeholder={tieneLlave ? 'Escribí una nueva llave para reemplazarla' : 'sk-...'} className={`${cls} pl-9`} />
            </div>
            <p className="text-xs text-ink-400 mt-1">
              La llave se guarda del lado del servidor y <strong>nunca</strong> se muestra de vuelta ni se envía al navegador.
            </p>
          </Field>
        )}

        {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}

        <button onClick={guardar} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved ? 'bg-primary-100 text-primary-700 border border-primary-200'
                  : 'bg-primary-500 hover:bg-primary-700 text-white'} disabled:opacity-60`}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
           : saved ? <><Check className="w-4 h-4" /> Guardado</>
           : 'Guardar configuración'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>{children}</div>
}
const cls = "w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
