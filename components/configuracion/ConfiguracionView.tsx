'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Settings, Building2, List, Save, CheckCircle, Plus, X, GripVertical, Tag, Pencil, Trash2, Check, ToggleLeft, ToggleRight, Users, ShieldCheck, Lock, Percent, Grid3x3, Bot } from 'lucide-react'
import { ConfigItem } from '@/types'
import WorkspaceMembersView from '@/components/workspace/WorkspaceMembersView'
import PermisosRolesView from '@/components/configuracion/PermisosRolesView'
import RamosAseguradoraTab from '@/components/configuracion/RamosAseguradoraTab'
import MotorIATab from '@/components/configuracion/MotorIATab'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'

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
      <label className="block text-xs font-medium text-ink-500 mb-2">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 p-3 bg-cream-100 border border-ink-200 rounded-lg min-h-[48px]">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1 bg-white border border-ink-200 text-ink-600 text-xs px-2 py-1 rounded-full">
            <GripVertical className="w-3 h-3 text-ink-300" />
            {item}
            <button onClick={() => remove(i)} className="text-ink-400 hover:text-error ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-ink-400 self-center">Sin elementos</span>}
      </div>
      <div className="flex gap-2">
        <input value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={`Agregar ${label.toLowerCase()}...`}
          className="flex-1 border border-ink-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <button onClick={add} disabled={!newItem.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-500 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
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
        <div key={cat.id} className="bg-white border border-ink-200 rounded-xl overflow-hidden">
          {editId === cat.id ? (
            /* Edit row */
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-ink-400 mb-1">Nombre</label>
                  <input value={editData.nombre} onChange={e => setEditData(d => ({ ...d, nombre: e.target.value }))}
                    className={iCls} placeholder="Nombre de la categoría" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-400 mb-1">Color</label>
                  <div className="flex flex-wrap gap-1.5 w-48">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setEditData(d => ({ ...d, color: c }))}
                        style={{ backgroundColor: c }}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${editData.color === c ? 'border-ink-700 scale-110' : 'border-transparent'}`} />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-400 mb-1">Descripción (opcional)</label>
                <input value={editData.descripcion} onChange={e => setEditData(d => ({ ...d, descripcion: e.target.value }))}
                  className={iCls} placeholder="Ej: Clientes con alto volumen de pólizas" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditId(null)}
                  className="px-3 py-1.5 text-sm border border-ink-200 text-ink-500 rounded-lg hover:bg-cream-100">
                  Cancelar
                </button>
                <button onClick={saveEdit} disabled={!editData.nombre.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
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
                  <span className="font-medium text-ink-700 text-sm">{cat.nombre}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                    style={{ backgroundColor: cat.color }}>
                    {cat.nombre}
                  </span>
                </div>
                {cat.descripcion && (
                  <p className="text-xs text-ink-400 mt-0.5 truncate">{cat.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(cat)}
                  className="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-cream-200 rounded-lg transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeCat(cat.id)}
                  className="p-1.5 text-ink-400 hover:text-error hover:bg-error-soft rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {cats.length === 0 && !adding && (
        <div className="text-center py-8 bg-cream-100 rounded-xl border border-dashed border-ink-200">
          <Tag className="w-8 h-8 mx-auto mb-2 text-ink-300" />
          <p className="text-sm text-ink-400">No hay categorías creadas</p>
          <p className="text-xs text-ink-400 mt-1">Crea categorías para clasificar y segmentar tus clientes</p>
        </div>
      )}

      {/* Add new form */}
      {adding ? (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-primary-800">Nueva categoría</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ink-500 mb-1">Nombre *</label>
              <input value={newForm.nombre} onChange={e => setNewForm(f => ({ ...f, nombre: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') addCat() }}
                className={iCls} placeholder="Ej: VIP, Preferencial, Estándar..." autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Color</label>
              <div className="flex flex-wrap gap-1.5 w-48">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setNewForm(f => ({ ...f, color: c }))}
                    style={{ backgroundColor: c }}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${newForm.color === c ? 'border-ink-700 scale-110' : 'border-transparent'}`} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Descripción (opcional)</label>
            <input value={newForm.descripcion} onChange={e => setNewForm(f => ({ ...f, descripcion: e.target.value }))}
              className={iCls} placeholder="Descripción breve de la categoría" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setNewForm(CAT_DEFAULTS) }}
              className="px-3 py-1.5 text-sm border border-ink-200 bg-white text-ink-500 rounded-lg hover:bg-cream-100">
              Cancelar
            </button>
            <button onClick={addCat} disabled={!newForm.nombre.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> Crear categoría
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-ink-200 text-ink-400 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50/50 rounded-xl text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Agregar categoría
        </button>
      )}

      {cats.length > 0 && (
        <div className="bg-cream-100 border border-ink-200 rounded-xl p-3">
          <p className="text-xs font-medium text-ink-500 mb-2">Vista previa de etiquetas:</p>
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

/* ── Tarifas de comisión ────────────────────────────────── */
interface TarifaComision {
  id: string
  codigo: string       // máx 9 caracteres
  ramo: string
  aseguradora: string
  porcentaje: number
}

const RAMOS_TARIFAS = [
  'Vida Individual','Vida Grupo','SOAT','Todo Riesgo Vehículo','Responsabilidad Civil',
  'Hogar','Incendio','Empresarial','Salud','ARL','Transportes','Agrícola','Otros',
  'Fianzas','Cumplimiento',
]
const ASEGURADORAS_TARIFAS = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado',
]

const TARIFA_BLANK: Omit<TarifaComision, 'id'> = { codigo: '', ramo: '', aseguradora: '', porcentaje: 0 }

function TarifasEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [tarifas, setTarifas] = useState<TarifaComision[]>([])
  const [editId,  setEditId]  = useState<string | null>(null)
  const [editData, setEditData] = useState<Omit<TarifaComision, 'id'>>(TARIFA_BLANK)
  const [newForm,  setNewForm]  = useState<Omit<TarifaComision, 'id'>>(TARIFA_BLANK)
  const [adding,   setAdding]   = useState(false)
  const [codigoError, setCodigoError] = useState('')

  useEffect(() => {
    try { setTarifas(JSON.parse(value || '[]')) } catch { setTarifas([]) }
  }, [value])

  function sync(next: TarifaComision[]) {
    setTarifas(next)
    onChange(JSON.stringify(next))
  }

  function validateCodigo(codigo: string, excludeId?: string): string {
    if (!codigo.trim()) return 'El código es obligatorio'
    if (codigo.length > 9) return 'Máximo 9 caracteres'
    if (tarifas.some(t => t.codigo === codigo.trim() && t.id !== excludeId))
      return 'Ya existe una tarifa con ese código'
    return ''
  }

  function addTarifa() {
    const err = validateCodigo(newForm.codigo)
    if (err) { setCodigoError(err); return }
    if (!newForm.ramo || !newForm.aseguradora) return
    const tarifa: TarifaComision = { id: crypto.randomUUID(), ...newForm, codigo: newForm.codigo.trim().toUpperCase() }
    sync([...tarifas, tarifa])
    setNewForm(TARIFA_BLANK)
    setAdding(false)
    setCodigoError('')
  }

  function startEdit(t: TarifaComision) {
    setEditId(t.id)
    setEditData({ codigo: t.codigo, ramo: t.ramo, aseguradora: t.aseguradora, porcentaje: t.porcentaje })
    setCodigoError('')
  }

  function saveEdit() {
    const err = validateCodigo(editData.codigo, editId!)
    if (err) { setCodigoError(err); return }
    if (!editData.ramo || !editData.aseguradora || !editId) return
    sync(tarifas.map(t => t.id === editId
      ? { ...t, ...editData, codigo: editData.codigo.trim().toUpperCase() }
      : t
    ))
    setEditId(null)
    setCodigoError('')
  }

  function removeTarifa(id: string) {
    if (!confirm('¿Eliminar esta tarifa? Las pólizas existentes no se verán afectadas.')) return
    sync(tarifas.filter(t => t.id !== id))
  }

  const fieldCls = "w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"

  function TarifaForm({ data, setData, onSave, onCancel, saveLabel }: {
    data: Omit<TarifaComision, 'id'>
    setData: (d: Omit<TarifaComision, 'id'>) => void
    onSave: () => void
    onCancel: () => void
    saveLabel: string
  }) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Código <span className="text-error">*</span></label>
            <input
              value={data.codigo}
              onChange={e => { setData({ ...data, codigo: e.target.value.slice(0, 9) }); setCodigoError('') }}
              placeholder="Ej: SURA-VIDA"
              maxLength={9}
              className={fieldCls + (codigoError ? ' border-error' : '')}
            />
            {codigoError && <p className="text-xs text-error mt-1">{codigoError}</p>}
            <p className="text-xs text-ink-400 mt-1">{data.codigo.length}/9 caracteres</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">% Comisión <span className="text-error">*</span></label>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.5"
                value={data.porcentaje || ''}
                onChange={e => setData({ ...data, porcentaje: parseFloat(e.target.value) || 0 })}
                placeholder="Ej: 12.5"
                className={fieldCls + ' pr-6'}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Ramo <span className="text-error">*</span></label>
            <select value={data.ramo} onChange={e => setData({ ...data, ramo: e.target.value })} className={fieldCls}>
              <option value="">Seleccionar ramo...</option>
              {RAMOS_TARIFAS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Aseguradora <span className="text-error">*</span></label>
            <select value={data.aseguradora} onChange={e => setData({ ...data, aseguradora: e.target.value })} className={fieldCls}>
              <option value="">Seleccionar aseguradora...</option>
              {ASEGURADORAS_TARIFAS.map(a => <option key={a} value={a}>{a}</option>)}
              <option value="Otra">Otra</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-ink-200 text-ink-500 rounded-lg hover:bg-cream-100">
            Cancelar
          </button>
          <button onClick={onSave} disabled={!data.ramo || !data.aseguradora || !data.codigo.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            <Check className="w-3.5 h-3.5" /> {saveLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-400">{tarifas.length} tarifa{tarifas.length !== 1 ? 's' : ''} configurada{tarifas.length !== 1 ? 's' : ''}</p>
        {!adding && (
          <button onClick={() => { setAdding(true); setNewForm(TARIFA_BLANK); setCodigoError('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-700">
            <Plus className="w-3.5 h-3.5" /> Nueva tarifa
          </button>
        )}
      </div>

      {/* New form */}
      {adding && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-primary-800 mb-3">Nueva tarifa</p>
          <TarifaForm
            data={newForm} setData={setNewForm}
            onSave={addTarifa} onCancel={() => { setAdding(false); setCodigoError('') }}
            saveLabel="Crear tarifa"
          />
        </div>
      )}

      {/* Table */}
      {tarifas.length > 0 && (
        <div className="bg-white border border-ink-200 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[110px_1fr_1fr_72px_72px] gap-3 px-4 py-2.5 bg-cream-100 border-b border-ink-200">
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Código</span>
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Ramo</span>
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Aseguradora</span>
            <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide text-right">%</span>
            <span />
          </div>

          {tarifas.map(t => (
            <div key={t.id} className="border-b border-ink-100 last:border-0">
              {editId === t.id ? (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-400">
                  <TarifaForm
                    data={editData} setData={setEditData}
                    onSave={saveEdit} onCancel={() => { setEditId(null); setCodigoError('') }}
                    saveLabel="Guardar"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-[110px_1fr_1fr_72px_72px] gap-3 items-center px-4 py-3 group hover:bg-cream-50">
                  <span className="inline-flex">
                    <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-md font-mono tracking-wide">
                      {t.codigo}
                    </span>
                  </span>
                  <span className="text-sm text-ink-700 truncate">{t.ramo}</span>
                  <span className="text-sm text-ink-600 truncate">{t.aseguradora}</span>
                  <span className="text-sm font-semibold text-emerald-600 text-right">{t.porcentaje}%</span>
                  <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEdit(t)}
                      className="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-cream-200 rounded-lg">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeTarifa(t.id)}
                      className="p-1.5 text-ink-400 hover:text-error hover:bg-error-soft rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tarifas.length === 0 && !adding && (
        <div className="text-center py-10 bg-cream-100 rounded-xl border border-dashed border-ink-200">
          <Percent className="w-8 h-8 mx-auto mb-2 text-ink-300" />
          <p className="text-sm text-ink-400">No hay tarifas configuradas</p>
          <p className="text-xs text-ink-400 mt-1">Crea tarifas para aplicarlas automáticamente al registrar pólizas</p>
        </div>
      )}

      <div className="bg-info/10 border border-info/30 rounded-xl p-4 text-sm text-info">
        <strong>Cómo funciona:</strong> Al crear una póliza puedes seleccionar una tarifa por su código —
        el sistema rellena automáticamente el % de comisión. Al importar desde Excel, se aplica la tarifa
        que coincida con el ramo y la aseguradora de cada fila.
      </div>
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
          <div key={group} className="bg-white rounded-xl border border-ink-200 overflow-hidden">
            <div className="px-5 py-3 bg-cream-100 border-b border-ink-200">
              <h3 className="text-sm font-semibold text-ink-600">{group}</h3>
            </div>
            <div className="divide-y divide-cream-200">
              {items.map(mod => {
                const enabled = config[mod.key] === '1'
                return (
                  <div key={mod.key} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-700">{mod.label}</p>
                      <p className="text-xs text-ink-400 mt-0.5">{mod.descripcion}</p>
                    </div>
                    <button
                      onClick={() => onToggle(mod.key, !enabled)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        enabled
                          ? 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100'
                          : 'bg-cream-200 border-ink-200 text-ink-400 hover:bg-ink-200'
                      }`}
                    >
                      {enabled
                        ? <><ToggleRight className="w-4 h-4 text-primary-500" /> Activo</>
                        : <><ToggleLeft className="w-4 h-4 text-ink-400" /> Inactivo</>
                      }
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="bg-warning-soft border border-warning/30 rounded-xl p-4 text-sm text-ink-700">
        <strong>Nota:</strong> Activar o desactivar un módulo no elimina los datos existentes. Solo oculta o muestra la funcionalidad en la interfaz. Los cambios aplican después de guardar.
      </div>
    </div>
  )
}

/* ── Main Component ─────────────────────────────────── */
type TabKey = 'agencia' | 'listas' | 'categorias' | 'modulos' | 'comisiones' | 'ramos' | 'ia' | 'workspace' | 'permisos'

export default function ConfiguracionView() {
  const { currentWorkspace, isAdmin } = useWorkspace()
  const { can } = usePermissions()
  const canEditAgencia = can('configuracion_editar_agencia')
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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  function toggleModulo(key: string, val: boolean) {
    set(key, val ? '1' : '0')
  }

  const ALL_TABS: { key: TabKey; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
    { key: 'agencia',    label: 'Datos de la agencia',    icon: Building2 },
    { key: 'listas',     label: 'Listados del sistema',   icon: List },
    { key: 'categorias', label: 'Categorías de clientes', icon: Tag },
    { key: 'modulos',    label: 'Módulos',                icon: ToggleRight },
    { key: 'comisiones', label: 'Comisiones',             icon: Percent, adminOnly: true },
    { key: 'ramos',      label: 'Ramos × Aseguradora',    icon: Grid3x3 },
    { key: 'ia',         label: 'Motor de IA',            icon: Bot, adminOnly: true },
    { key: 'permisos',   label: 'Permisos de roles',      icon: ShieldCheck, adminOnly: true },
    { key: 'workspace',  label: 'Workspace & Miembros',   icon: Users },
  ]
  const TABS = ALL_TABS.filter(t => !t.adminOnly || isAdmin)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700 flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary-500" /> Configuración
          </h1>
          <p className="text-ink-400 text-sm mt-1">Personaliza tu agencia, listados y categorías de clientes</p>
        </div>
        {(tab !== 'agencia' || canEditAgencia) && (
          <button onClick={saveAll} disabled={saving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saved
                ? 'bg-primary-100 text-primary-700 border border-primary-200'
                : 'bg-primary-500 hover:bg-primary-700 text-white'
            }`}>
            {saved
              ? <><CheckCircle className="w-4 h-4" /> Guardado</>
              : saving
              ? <><Save className="w-4 h-4 animate-pulse" /> Guardando...</>
              : <><Save className="w-4 h-4" /> Guardar cambios</>
            }
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-ink-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Agencia tab ── */}
      {tab === 'agencia' && (
        <div className="space-y-4">
        {!canEditAgencia && (
          <div className="flex items-center gap-2 bg-warning-soft border border-warning/30 rounded-xl px-4 py-3 text-sm text-ink-700">
            <Lock className="w-4 h-4 flex-shrink-0" />
            Solo lectura. No tienes permiso para editar los datos de la agencia.
          </div>
        )}
        <div className="bg-white rounded-xl border border-ink-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <h2 className="font-semibold text-ink-700">{config.nombre_agencia || 'Tu agencia'}</h2>
              <p className="text-sm text-ink-400">Información general de la agencia de seguros</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {AGENCY_KEYS.map(key => (
              <div key={key} className={key === 'direccion' || key === 'nombre_agencia' ? 'md:col-span-2' : ''}>
                <label className="block text-xs font-medium text-ink-500 mb-1.5">{AGENCY_LABELS[key]}</label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={config[key] || ''} onChange={e => canEditAgencia && set(key, e.target.value)}
                  placeholder={AGENCY_LABELS[key]}
                  readOnly={!canEditAgencia}
                  className={`w-full border border-ink-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 ${canEditAgencia ? 'bg-white' : 'bg-cream-100 text-ink-400 cursor-not-allowed'}`}
                />
              </div>
            ))}
          </div>

          {config.nombre_agencia && (
            <div className="mt-6 p-4 bg-cream-100 rounded-xl border border-ink-200">
              <p className="text-xs font-medium text-ink-400 mb-2 uppercase tracking-wide">Vista previa</p>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                  {(config.nombre_agencia || 'S')[0]}
                </div>
                <div>
                  <p className="font-semibold text-ink-700">{config.nombre_agencia}</p>
                  {config.nit && <p className="text-xs text-ink-400">NIT: {config.nit}</p>}
                  {(config.ciudad || config.departamento) && (
                    <p className="text-xs text-ink-400">{[config.ciudad, config.departamento].filter(Boolean).join(', ')}</p>
                  )}
                  {config.telefono && <p className="text-xs text-ink-400">{config.telefono}</p>}
                  {config.email && <p className="text-xs text-ink-400">{config.email}</p>}
                  {config.direccion && <p className="text-xs text-ink-400">{config.direccion}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ── Listas tab ── */}
      {tab === 'listas' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-ink-200 p-6">
            <h3 className="font-semibold text-ink-700 mb-1">Aseguradoras</h3>
            <p className="text-sm text-ink-400 mb-4">Lista de aseguradoras disponibles para seleccionar en pólizas, cobros y otros módulos.</p>
            <TagListEditor
              label="Aseguradoras"
              value={config.aseguradoras_lista || ''}
              onChange={v => set('aseguradoras_lista', v)}
            />
          </div>

          <div className="bg-white rounded-xl border border-ink-200 p-6">
            <h3 className="font-semibold text-ink-700 mb-1">Ramos</h3>
            <p className="text-sm text-ink-400 mb-4">Ramos de seguros disponibles para seleccionar en los formularios del CRM.</p>
            <TagListEditor
              label="Ramos"
              value={config.ramos_lista || ''}
              onChange={v => set('ramos_lista', v)}
            />
          </div>

          <div className="bg-warning-soft border border-warning/30 rounded-xl p-4 text-sm text-ink-700">
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
              <h3 className="font-semibold text-ink-700">Módulos configurables</h3>
              <p className="text-sm text-ink-400 mt-0.5">
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
          <div className="bg-white rounded-xl border border-ink-200 p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Tag className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-700">Categorías de clientes</h3>
                <p className="text-sm text-ink-400 mt-0.5">
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

          <div className="bg-info/10 border border-info/30 rounded-xl p-4 text-sm text-info">
            <strong>Tip:</strong> Las categorías creadas aquí estarán disponibles en el formulario de clientes y en los filtros avanzados de la lista de clientes. Recuerda guardar los cambios con el botón superior.
          </div>
        </div>
      )}

      {/* ── Comisiones tab ── */}
      {tab === 'comisiones' && isAdmin && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-ink-200 p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Percent className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-700">Comisiones por ramo</h3>
                <p className="text-sm text-ink-400 mt-0.5">
                  Define el porcentaje de comisión agencia por defecto para cada ramo.
                  Se aplica automáticamente al crear pólizas o importar desde Excel cuando no hay un % especificado.
                </p>
              </div>
            </div>

            <TarifasEditor
              value={config.comisiones_tarifas || '[]'}
              onChange={v => set('comisiones_tarifas', v)}
            />
          </div>
        </div>
      )}

      {/* ── Permisos tab ── */}
      {tab === 'permisos' && isAdmin && (
        <PermisosRolesView />
      )}

      {/* ── Ramos × Aseguradora tab ── */}
      {tab === 'ramos' && (
        <RamosAseguradoraTab isAdmin={isAdmin} />
      )}

      {/* ── Motor de IA tab ── */}
      {tab === 'ia' && isAdmin && (
        <MotorIATab />
      )}

      {/* ── Workspace tab ── */}
      {tab === 'workspace' && (
        <WorkspaceMembersView />
      )}
    </div>
  )
}

const iCls = "w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
