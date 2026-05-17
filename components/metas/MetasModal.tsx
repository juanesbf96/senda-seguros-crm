'use client'
import { useEffect, useState } from 'react'
import { X, Target } from 'lucide-react'
import { Meta, TipoMeta, PeriodoMeta } from '@/types'
import { supabase } from '@/lib/supabase/client'

const TIPO_LABELS: Record<TipoMeta, string> = {
  prima_total:     'Prima total recaudada',
  clientes_nuevos: 'Clientes nuevos',
  renovaciones:    'Renovaciones cerradas',
  polizas_activas: 'Pólizas activas',
  comisiones:      'Comisiones recibidas',
  cobros:          'Cobros realizados',
  personalizada:   'Meta personalizada',
}

const PERIODO_LABELS: Record<PeriodoMeta, string> = {
  mensual:      'Mensual',
  trimestral:   'Trimestral',
  anual:        'Anual',
  personalizado:'Personalizado',
}

const COLORS = [
  '#10b981','#3b82f6','#8b5cf6','#f59e0b','#ef4444',
  '#06b6d4','#84cc16','#f97316','#ec4899','#6366f1',
]

const now = new Date()
const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

type Form = {
  nombre: string; tipo: TipoMeta; periodo: PeriodoMeta
  valor_meta: string; valor_actual: string
  fecha_inicio: string; fecha_fin: string
  color: string; descripcion: string; auto_calcular: boolean
}

const EMPTY: Form = {
  nombre: '', tipo: 'prima_total', periodo: 'mensual',
  valor_meta: '', valor_actual: '0',
  fecha_inicio: firstOfMonth, fecha_fin: lastOfMonth,
  color: '#10b981', descripcion: '', auto_calcular: true,
}

export default function MetasModal({
  meta, onClose, onSaved,
}: { meta?: Meta; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (meta) {
      setForm({
        nombre: meta.nombre, tipo: meta.tipo, periodo: meta.periodo,
        valor_meta: String(meta.valor_meta), valor_actual: String(meta.valor_actual),
        fecha_inicio: meta.fecha_inicio, fecha_fin: meta.fecha_fin,
        color: meta.color, descripcion: meta.descripcion || '', auto_calcular: meta.auto_calcular,
      })
    } else {
      setForm(EMPTY)
    }
  }, [meta])

  // Auto-set dates when period changes
  function handlePeriodo(p: PeriodoMeta) {
    const y = now.getFullYear()
    const m = now.getMonth()
    let fi = firstOfMonth, ff = lastOfMonth
    if (p === 'trimestral') {
      const q = Math.floor(m / 3)
      fi = new Date(y, q * 3, 1).toISOString().split('T')[0]
      ff = new Date(y, q * 3 + 3, 0).toISOString().split('T')[0]
    } else if (p === 'anual') {
      fi = `${y}-01-01`; ff = `${y}-12-31`
    }
    setForm(f => ({ ...f, periodo: p, fecha_inicio: fi, fecha_fin: ff }))
  }

  async function save() {
    if (!form.nombre || !form.valor_meta) return
    setSaving(true)
    const payload = {
      nombre: form.nombre, tipo: form.tipo, periodo: form.periodo,
      valor_meta: Number(form.valor_meta),
      valor_actual: form.auto_calcular ? 0 : Number(form.valor_actual),
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
      color: form.color,
      descripcion: form.descripcion || null,
      auto_calcular: form.auto_calcular,
    }
    if (meta) {
      await supabase.from('metas').update(payload).eq('id', meta.id)
    } else {
      await supabase.from('metas').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  const set = (k: keyof Form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: form.color + '20' }}>
              <Target className="w-4 h-4" style={{ color: form.color }} />
            </div>
            <h2 className="font-semibold text-ink-700">{meta ? 'Editar meta' : 'Nueva meta'}</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Nombre de la meta *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Prima mensual objetivo"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">Tipo de meta</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TIPO_LABELS) as [TipoMeta, string][]).map(([k, label]) => (
                <button key={k} onClick={() => set('tipo', k)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    form.tipo === k ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Período */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">Período</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.entries(PERIODO_LABELS) as [PeriodoMeta, string][]).map(([k, label]) => (
                <button key={k} onClick={() => handlePeriodo(k)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    form.periodo === k ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-ink-200 text-ink-500 hover:border-ink-300'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Fecha fin</label>
              <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)}
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          </div>

          {/* Valor meta */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">
              {['prima_total','comisiones','cobros'].includes(form.tipo) ? 'Valor meta (COP)' : 'Cantidad meta'} *
            </label>
            <input type="number" value={form.valor_meta} onChange={e => set('valor_meta', e.target.value)}
              placeholder="0"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>

          {/* Auto-calcular toggle */}
          <div className="flex items-center justify-between p-3 bg-cream-100 rounded-lg">
            <div>
              <p className="text-sm font-medium text-ink-600">Auto-calcular progreso</p>
              <p className="text-xs text-ink-400">El sistema actualiza el avance desde los datos del CRM</p>
            </div>
            <button onClick={() => set('auto_calcular', !form.auto_calcular)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.auto_calcular ? 'bg-primary-500' : 'bg-ink-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.auto_calcular ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Valor actual manual */}
          {!form.auto_calcular && (
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1">Progreso actual</label>
              <input type="number" value={form.valor_actual} onChange={e => set('valor_actual', e.target.value)}
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
          )}

          {/* Color */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-ink-400 scale-110' : 'hover:scale-110'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1">Descripción (opcional)</label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              rows={2} placeholder="Notas sobre esta meta..."
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-cream-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-500 hover:text-ink-700 rounded-lg border border-ink-200 hover:border-ink-300 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !form.nombre || !form.valor_meta}
            style={{ background: form.color }}
            className="px-5 py-2 text-sm text-white rounded-lg font-medium transition-opacity disabled:opacity-50">
            {saving ? 'Guardando...' : meta ? 'Actualizar' : 'Crear meta'}
          </button>
        </div>
      </div>
    </div>
  )
}
