'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Settings, Building2, List, Save, CheckCircle, Plus, X, GripVertical, Tag, Pencil, Trash2, Check, ToggleLeft, ToggleRight, Users } from 'lucide-react'
import { ConfigItem } from '@/types'
import WorkspaceMembersView from '@/components/workspace/WorkspaceMembersView'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const AGENCY_KEYS = ['nombre_agencia', 'nit', 'telefono', 'email', 'ciudad', 'departamento', 'direccion']
const AGENCY_LABELS: Record<string, string> = {
  nombre_agencia: 'Nombre de la agencia', nit: 'NIT', telefono: 'Teléfono',
  email: 'Correo electrónico', ciudad: 'Ciudad', departamento: 'Departamento', direccion: 'Dirección',
}

const PRESET_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#64748b', '#1d4ed8',
  '#16a34a', '#dc2626', '#7c3aed', '#0284c7', '#b45309',
]

/* ── TagListEditor ──────────────────────────────────── */
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

/* ── Categorías Editor ──────────────────────────────── */
interface Categoria {
  id: string
  nombre: string
  color: string
  descripcion: string
}

const CAT_DEFAULTS: Omit<Categoria, 'id'> = { nombre: '', color: '#10b981', descripcion: '' }

function CategoriasEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [cats,    setCats]    = useState<Categoria[]>([])
  const [editId,  setEditId]  = useState<string | null>(null)
  const [editData, setEditData] = useState<Omit<Categoria, 'id'>>(CAT_DEFAULTS)
  const [newForm, setNewForm] = useState<Omit<Categoria, 'id'>>(CAT_DEFAULTS)
  const [adding,  setAdding]  = useState(false)

  useEffect(() => {
    try { setCats(JSON.parse(value || '[]')) } catch { setCats([]) }
  }, [value])

  function sync(next: Categoria[]) {
    setCats(next)
    onChange(JSON.stringify(next))
  }

  function addCat() {
    if (!newForm.nombre.trim()) return
    const cat: Categoria = { id: crypto.randomUUID(), ...newForm, nombre: newForm.nombre.trim() }
    sync([...cats, cat])
    setNewForm(CAT_DEFAULTS)
    setAdding(false)
  }

  function startEdit(cat: Categoria) {
    setEditId(cat.id)
    setEditData({ nombre: cat.nombre, color: cat.color, descripcion: cat.descripcion })
  }

  function saveEdit() {
    if (!editData.nombre.trim() || !editId) return
    sync(cats.map(c => c.id === editId ? { ...c, ...editData, nombre: editData.nombre.trim() } : c))
    setEditId(null)
  }

  function removeCat(id: string) {
    if (!confirm('¿Eliminar esta categoría? Los clientes con esta categoría quedarán sin categoría asignada.')) return
    sync(cats.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Existing categories */}
      {cats.map(cat => (
        <div key={cat.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {editId === cat.id ? (
            /* Edit row */
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                  <input value={editData.nombre} onChange={e => setEditData(d => ({ ...d, nombre: e.target.value }))}
                    className={iCls} placeholder="Nombre de la categoría" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
                  <div className="flex flex-wrap gap-1.5 w-48">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setEditData(d => ({ ...d, color: c }))}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${editData.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción (opcional)</label>
                <input value={editData.descripcion} onChange={e => setEditData(d => ({ ...d, descripcion: e.target.value }))}
                  className={iCls} placeholder="Ej: Clientes con alto volumen de pólizas" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditId(null)}
                  className="px-3 py-1.5 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                  Cancelar
                </button>
                <button onClick={saveEdit} disabled={!editData.nombre.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> Guardar
                </button>
              </div>
            </div>
          ) : (
            /* Display row */
            <div className="flex items-center gap-3 px-4 py-3 group">
              <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ backgroundColor: cat.color + '20', border: `2px solid ${cat.color}` }}>
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800 text-sm">{cat.nombre}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ backgroundColor: cat.color }}>
                    {cat.nombre}
                  </span>
                </div>
                {cat.descripcion && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{cat.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(cat)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeCat(cat.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {cats.length === 0 && !adding && (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">No hay categorías creadas</p>
          <p className="text-xs text-slate-400 mt-1">Crea categorías para clasificar y segmentar tus clientes</p>
        </div>
      )}

      {/* Add new form */}
      {adding ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-emerald-800">Nueva categoría</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
              <input value={newForm.nombre} onChange={e => setNewForm(f => ({ ...f, nombre: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addCat() }}
                className={iCls} placeholder="Ej: VIP, Preferencial, Estándar..." autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5 w-48">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewForm(f => ({ ...f, color: c }))}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${newForm.color === c ? 'border-slate-800 scale-110' : 'border-transparent'}`} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Descripción (opcional)</label>
            <input value={newForm.descripcion} onChange={e => setNewForm(f => ({ ...f, descripcion: e.target.value }))}
              className={iCls} placeholder="Descripción breve de la categoría" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewForm(CAT_DEFAULTS) }}
              className="px-3 py-1.5 text-sm border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={addCat} disabled={!newForm.nombre.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> Crear categoría
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Agregar categoría
        </button>
      )}

      {cats.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <p className="text-xs font-medium text-slate-600 mb-2">Vista previa de etiquetas:</p>
          <div className="flex flex-wrap gap-2">
            {cats.map(cat => (
              <span key={cat.id}
                className="text-xs px-3 py-1 rounded-full font-medium text-white"
                style={{ backgroundColor: cat.color }}>
                {cat.nombre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Módulos configurables ──────────────────────────── */
interface ModuloConfig {
  key: string
  label: string
  descripcion: string
  group: string
  requiere?: string   // key of a module that must be enabled first
}

const MODULOS: ModuloConfig[] = [
  // CRM core
  { key: 'modulo_prospectos',     label: 'Prospectos / Pipeline',         descripcion: 'Kanban de oportunidades y seguimiento de prospectos antes de convertirlos en clientes.',         group: 'CRM' },
  { key: 'modulo_segmentos',      label: 'Segmentos de clientes',         descripcion: 'Filtra y agrupa clientes por categoría, ramo, ciudad u otras variables de segmentación.',         group: 'CRM' },
  { key: 'modulo_agenda',         label: 'Agenda y calendario',           descripcion: 'Eventos, recordatorios y reuniones vinculados a clientes y pólizas.',                             group: 'CRM' },
  { key: 'modulo_tareas',         label: 'Gestión de tareas',             descripcion: 'Tablero de tareas por estado con prioridades y asignación de responsables.',                      group: 'CRM' },
  // Pólizas / producción
  { key: 'modulo_renovaciones',   label: 'Campañas de renovación',        descripcion: 'Gestor de campañas de renovación con seguimiento por estado (pendiente, renovado, no renueva).',  group: 'Producción' },
  { key: 'modulo_cumplimiento',   label: 'Pólizas de cumplimiento',       descripcion: 'Subsección de pólizas para ramo Cumplimiento / Judicial con campos especiales.',                 group: 'Producción' },
  { key: 'modulo_anexos',         label: 'Anexos de pólizas',             descripcion: 'Control de anexos y vinculados asociados a cada póliza.',                                        group: 'Producción' },
  { key: 'modulo_cierre_prod',    label: 'Cierre de producción',          descripcion: 'Bloqueo contable al cierre de mes o período para evitar modificaciones retroactivas.',             group: 'Producción' },
  { key: 'modulo_cocorretaje',    label: 'Cocorretaje',                   descripcion: 'Gestión de pólizas compartidas entre varias corredoras con reparto de comisiones.',               group: 'Producción' },
  // Finanzas
  { key: 'modulo_siniestros',     label: 'Siniestros',                    descripcion: 'Registro y seguimiento de siniestros con amparos, valores reclamados y estado de pago.',         group: 'Finanzas' },
  { key: 'modulo_diligencias',    label: 'Diligencias',                   descripcion: 'Control de trámites, certificados y paz y salvos pendientes.',                                   group: 'Finanzas' },
  { key: 'modulo_conciliacion',   label: 'Conciliación de comisiones',    descripcion: 'Cuadre entre comisiones emitidas en facturas y pagos recibidos de aseguradoras.',                group: 'Finanzas' },
  { key: 'modulo_reteiva_vend',   label: 'Reteiva a vendedores',          descripcion: 'Aplica retención de IVA en las liquidaciones de vendedores según régimen tributario.',            group: 'Finanzas' },
  { key: 'modulo_pagos_auto',     label: 'Crear pagos automáticos',       descripcion: 'Genera cobros y recibos automáticamente al registrar una póliza o renovación.',                  group: 'Finanzas' },
  // Comunicación
  { key: 'modulo_notif_email',    label: 'Notificaciones por correo',     descripcion: 'Envío de alertas de renovación, vencimiento y novedades a clientes por email.',                 group: 'Comunicación' },
  { key: 'modulo_remision_pdf',   label: 'Remisión PDF automática',       descripcion: 'Generación de PDF de remisiones para enviar a aseguradoras.',                                    group: 'Comunicación' },
  { key: 'modulo_archivos',       label: 'Módulo de archivos',            descripcion: 'Gestor de documentos adjuntos por cliente, póliza y prospecto con subida a la nube.',           group: 'Comunicación' },
]

const MODULO_GROUPS = ['CRM', 'Producción', 'Finanzas', 'Comunicación']

function ModulosEditor({ config, onToggle }: {
  config: Record<string, string>
  onToggle: (key: string, val: boolean) => void
}) {
  return (
    <div className="space-y-6">
      {MODULO_GROUPS.map(group => {
        const items = MODULOS.filter(m => m.group === group)
        return (
          <div key={group} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700">{group}</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map(mod => {
                const enabled = config[mod.key] === '1'
                return (
                  <div key={mod.key} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{mod.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{mod.descripcion}</p>
                    </div>
                    <button
                      onClick={() => onToggle(mod.key, !enabled)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        enabled
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {enabled
                        ? <><ToggleRight className="w-4 h-4 text-emerald-500" /> Activo</>
                        : <><ToggleLeft className="w-4 h-4 text-slate-400" /> Inactivo</>
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Nota:</strong> Activar o desactivar un módulo no elimina los datos existentes. Solo oculta o muestra la funcionalidad en la interfaz. Los cambios aplican después de guardar.
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────── */
type TabKey = 'agencia' | 'listas' | 'categorias' | 'modulos' | 'workspace'

export default function ConfiguracionView() {
  const { currentWorkspace } = useWorkspace()
  const [config, setConfig]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [tab, setTab]         = useState<TabKey>('agencia')

  const load = useCallback(async () => {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('configuracion')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
    const map: Record<string, string> = {}
    ;(data as ConfigItem[] || []).forEach(c => { map[c.clave] = c.valor || '' })
    setConfig(map)
    setLoading(false)
  }, [currentWorkspace?.id])

  useEffect(() => { load() }, [load])

  function set(key: string, val: string) {
    setConfig(prev => ({ ...prev, [key]: val }))
  }

  async function saveAll() {
    if (!currentWorkspace) return
    setSaving(true)
    const updates = Object.entries(config).map(([clave, valor]) => ({
      clave, valor, workspace_id: currentWorkspace.id, updated_at: new Date().toISOString(),
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

  function toggleModulo(key: string, val: boolean) {
    set(key, val ? '1' : '0')
  }

  const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: 'agencia',    label: 'Datos de la agencia',    icon: Building2 },
    { key: 'listas',     label: 'Listados del sistema',   icon: List },
    { key: 'categorias', label: 'Categorías de clientes', icon: Tag },
    { key: 'modulos',    label: 'Módulos',                icon: ToggleRight },
    { key: 'workspace',  label: 'Workspace & Miembros',   icon: Users },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" /> Configuración
          </h1>
          <p className="text-slate-500 text-sm mt-1">Personaliza tu agencia, listados y categorías de clientes</p>
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
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Agencia tab ── */}
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

      {/* ── Listas tab ── */}
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

      {/* ── Módulos tab ── */}
      {tab === 'modulos' && (
        <div>
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <ToggleRight className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Módulos configurables</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Activa o desactiva funcionalidades del CRM según las necesidades de tu agencia.
              </p>
            </div>
          </div>
          <ModulosEditor config={config} onToggle={toggleModulo} />
        </div>
      )}

      {/* ── Categorías tab ── */}
      {tab === 'categorias' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Tag className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Categorías de clientes</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Define etiquetas para clasificar y segmentar tus clientes (VIP, Preferencial, Estándar, etc.).
                  Cada categoría tiene un nombre, color y descripción opcional.
                </p>
              </div>
            </div>

            <CategoriasEditor
              value={config.categorias_clientes || '[]'}
              onChange={v => set('categorias_clientes', v)}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Tip:</strong> Las categorías creadas aquí estarán disponibles en el formulario de clientes y en los filtros avanzados de la lista de clientes. Recuerda guardar los cambios con el botón superior.
          </div>
        </div>
      )}

      {/* ── Workspace tab ── */}
      {tab === 'workspace' && (
        <WorkspaceMembersView />
      )}
    </div>
  )
}

const iCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
