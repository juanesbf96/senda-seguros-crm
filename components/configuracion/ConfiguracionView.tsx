'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Settings, Building2, List, Save, CheckCircle, Plus, X, GripVertical } from 'lucide-react'
import { ConfigItem } from '@/types'

const AGENCY_KEYS = ['nombre_agencia', 'nit', 'telefono', 'email', 'ciudad', 'departamento', 'direccion']
const AGENCY_LABELS: Record<string, string> = {
  nombre_agencia: 'Nombre de la agencia', nit: 'NIT', telefono: 'Teléfono',
  email: 'Correo electrónico', ciudad: 'Ciudad', departamento: 'Departamento', direccion: 'Dirección',
}

function TagListEditor({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  const [items, setItems]   = useState<string[]>([])
  const [newItem, setNewItem] = useState('')

  useEffect(() => {
    setItems(value ? value.split(',').map(s => s.trim()).filter(Boolean) : [])
  }, [value])

  function sync(next: string[]) {
    setItems(next)
    onChange(next.join(','))
  }

  function add() {
    const t = newItem.trim()
    if (!t || items.includes(t)) return
    sync([...items, t])
    setNewItem('')
  }

  function remove(i: number) {
    sync(items.filter((_, idx) => idx !== i))
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[48px]">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 text-xs px-2 py-1 rounded-full">
            <GripVertical className="w-3 h-3 text-slate-300" />
            {item}
            <button onClick={() => remove(i)} className="text-slate-400 hover:text-red-500 ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-slate-400 self-center">Sin elementos</span>}
      </div>
      <div className="flex gap-2">
        <input value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={`Agregar ${label.toLowerCase()}...`}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        <button onClick={add} disabled={!newItem.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </div>
    </div>
  )
}

export default function ConfiguracionView() {
  const [config, setConfig]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [tab, setTab]         = useState<'agencia' | 'listas'>('agencia')

  const load = useCallback(async () => {
    const { data } = await supabase.from('configuracion').select('*')
    const map: Record<string, string> = {}
    ;(data as ConfigItem[] || []).forEach(c => { map[c.clave] = c.valor || '' })
    setConfig(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function set(key: string, val: string) {
    setConfig(prev => ({ ...prev, [key]: val }))
  }

  async function saveAll() {
    setSaving(true)
    const updates = Object.entries(config).map(([clave, valor]) => ({
      clave, valor, updated_at: new Date().toISOString(),
    }))
    await supabase.from('configuracion').upsert(updates, { onConflict: 'clave' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" /> Configuración
          </h1>
          <p className="text-slate-500 text-sm mt-1">Personaliza la información de tu agencia y los listados del sistema</p>
        </div>
        <button onClick={saveAll} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}>
          {saved
            ? <><CheckCircle className="w-4 h-4" /> Guardado</>
            : saving
            ? <><Save className="w-4 h-4 animate-pulse" /> Guardando...</>
            : <><Save className="w-4 h-4" /> Guardar cambios</>
          }
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[['agencia', 'Datos de la agencia', Building2], ['listas', 'Listados del sistema', List]].map(([key, label, Icon]) => (
          <button key={key as string} onClick={() => setTab(key as 'agencia' | 'listas')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {/* @ts-ignore */}
            <Icon className="w-4 h-4" /> {label as string}
          </button>
        ))}
      </div>

      {tab === 'agencia' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">{config.nombre_agencia || 'Tu agencia'}</h2>
              <p className="text-sm text-slate-500">Información general de la agencia de seguros</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {AGENCY_KEYS.map(key => (
              <div key={key} className={key === 'direccion' || key === 'nombre_agencia' ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{AGENCY_LABELS[key]}</label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={config[key] || ''} onChange={e => set(key, e.target.value)}
                  placeholder={AGENCY_LABELS[key]}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                />
              </div>
            ))}
          </div>

          {/* Preview card */}
          {config.nombre_agencia && (
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Vista previa</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {(config.nombre_agencia || 'S')[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{config.nombre_agencia}</p>
                  {config.nit && <p className="text-xs text-slate-500">NIT: {config.nit}</p>}
                  {(config.ciudad || config.departamento) && (
                    <p className="text-xs text-slate-500">{[config.ciudad, config.departamento].filter(Boolean).join(', ')}</p>
                  )}
                  {config.telefono && <p className="text-xs text-slate-500">{config.telefono}</p>}
                  {config.email && <p className="text-xs text-slate-500">{config.email}</p>}
                  {config.direccion && <p className="text-xs text-slate-500">{config.direccion}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'listas' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Aseguradoras</h3>
            <p className="text-sm text-slate-500 mb-4">Lista de aseguradoras disponibles para seleccionar en pólizas, cobros y otros módulos.</p>
            <TagListEditor
              label="Aseguradoras"
              value={config.aseguradoras_lista || ''}
              onChange={v => set('aseguradoras_lista', v)}
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-1">Ramos</h3>
            <p className="text-sm text-slate-500 mb-4">Ramos de seguros disponibles para seleccionar en los formularios del CRM.</p>
            <TagListEditor
              label="Ramos"
              value={config.ramos_lista || ''}
              onChange={v => set('ramos_lista', v)}
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Nota:</strong> Los cambios en los listados no afectan los registros ya guardados. Solo modifican las opciones disponibles en los nuevos formularios. Recuerda guardar los cambios con el botón superior.
          </div>
        </div>
      )}
    </div>
  )
}
