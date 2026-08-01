'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { RamoAseguradora, DisponibleRamo } from '@/types'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { CATALOGO_RAMOS_BASE, RAMOS_CATALOGO, ASEGURADORAS_CATALOGO } from '@/lib/catalogoRamos'
import { Download, Check, X, HelpCircle } from 'lucide-react'

// Estilo de celda por disponibilidad.
const DISP_CELL: Record<DisponibleRamo, string> = {
  si:          'bg-primary-100 text-primary-700',
  no:          'bg-error-soft text-error',
  condicionado:'bg-warning-soft text-ink-700',
}
const DISP_LABEL: Record<DisponibleRamo, string> = { si: 'Sí', no: 'No', condicionado: 'Cond.' }
// Ciclo al hacer clic (admin): sí → condicionado → no → sí
const NEXT_DISP: Record<DisponibleRamo, DisponibleRamo> = { si: 'condicionado', condicionado: 'no', no: 'si' }

export default function RamosAseguradoraTab({ isAdmin }: { isAdmin: boolean }) {
  const { currentWorkspace } = useWorkspace()
  const [rows, setRows]       = useState<RamoAseguradora[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function load() {
    if (!currentWorkspace) return
    const { data, error } = await supabase
      .from('ramos_aseguradora')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
    if (error) setError(error.message)
    setRows((data || []) as RamoAseguradora[])
    setLoading(false)
  }
  useEffect(() => { load() }, [currentWorkspace?.id])

  // Índice (aseguradora|ramo) → fila, para lookup O(1) en la matriz.
  const idx = useMemo(() => {
    const m = new Map<string, RamoAseguradora>()
    for (const r of rows) m.set(`${r.aseguradora}|${r.ramo}`, r)
    return m
  }, [rows])

  // Ejes: unión del catálogo base con lo que ya exista en la BD (por si editaron a mano).
  const aseguradoras = useMemo(() => {
    const s = new Set<string>(ASEGURADORAS_CATALOGO)
    rows.forEach(r => s.add(r.aseguradora))
    return [...s]
  }, [rows])
  const ramos = useMemo(() => {
    const s = new Set<string>(RAMOS_CATALOGO)
    rows.forEach(r => s.add(r.ramo))
    return [...s]
  }, [rows])

  async function cargarCatalogoBase() {
    if (!currentWorkspace || !isAdmin) return
    if (rows.length > 0 && !confirm('Esto sobreescribe la disponibilidad de las celdas del catálogo base. ¿Continuar?')) return
    setSaving(true); setError('')
    const payload = CATALOGO_RAMOS_BASE.map(c => ({
      workspace_id: currentWorkspace.id,
      aseguradora: c.aseguradora,
      ramo: c.ramo,
      disponible: c.disponible,
      nota: c.nota,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('ramos_aseguradora')
      .upsert(payload, { onConflict: 'workspace_id,aseguradora,ramo' })
    if (error) setError(error.message)
    await load()
    setSaving(false)
  }

  async function cycleCell(aseguradora: string, ramo: string) {
    if (!currentWorkspace || !isAdmin || saving) return
    const existing = idx.get(`${aseguradora}|${ramo}`)
    const next: DisponibleRamo = existing ? NEXT_DISP[existing.disponible] : 'si'
    setSaving(true); setError('')
    const { error } = await supabase
      .from('ramos_aseguradora')
      .upsert({
        workspace_id: currentWorkspace.id,
        aseguradora, ramo,
        disponible: next,
        nota: existing?.nota ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'workspace_id,aseguradora,ramo' })
    if (error) setError(error.message)
    else setRows(prev => {
      const others = prev.filter(r => !(r.aseguradora === aseguradora && r.ramo === ramo))
      const base = existing ?? { id: `tmp-${aseguradora}-${ramo}`, workspace_id: currentWorkspace.id,
        aseguradora, ramo, nota: null, pct_comision_default: null, activo: true,
        created_at: '', updated_at: '' } as RamoAseguradora
      return [...others, { ...base, disponible: next }]
    })
    setSaving(false)
  }

  const total = rows.length
  const disponibles = rows.filter(r => r.disponible === 'si').length

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-ink-700">Ramos por aseguradora</h2>
          <p className="text-ink-400 text-sm">
            Qué ramos maneja cada aseguradora. {total > 0 && <>{total} combinaciones · {disponibles} disponibles.</>}
          </p>
        </div>
        {isAdmin && (
          <button onClick={cargarCatalogoBase} disabled={saving}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500 hover:bg-primary-700 text-white disabled:opacity-60 transition-colors">
            <Download className="w-4 h-4" /> {rows.length > 0 ? 'Recargar catálogo base' : 'Cargar catálogo base'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2 mb-4">{error}</p>}

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-ink-500 mb-3">
        <span className="flex items-center gap-1"><span className={`px-1.5 py-0.5 rounded ${DISP_CELL.si}`}>Sí</span> disponible</span>
        <span className="flex items-center gap-1"><span className={`px-1.5 py-0.5 rounded ${DISP_CELL.condicionado}`}>Cond.</span> condicionado</span>
        <span className="flex items-center gap-1"><span className={`px-1.5 py-0.5 rounded ${DISP_CELL.no}`}>No</span> no maneja</span>
        {isAdmin && <span className="text-ink-400 ml-auto">Clic en una celda para cambiar (Sí → Cond. → No)</span>}
      </div>

      {total === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center text-ink-400">
          <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aún no hay catálogo cargado.</p>
          {isAdmin && <p className="text-xs mt-1">Usá &quot;Cargar catálogo base&quot; para traer la matriz de la agencia.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto border border-ink-200 rounded-xl bg-white">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-cream-100 border-b border-r border-ink-200 px-3 py-2 text-left font-medium text-ink-500 min-w-[140px]">
                  Aseguradora
                </th>
                {ramos.map(ramo => (
                  <th key={ramo} className="border-b border-ink-200 px-2 py-2 font-medium text-ink-500 align-bottom">
                    <div className="whitespace-nowrap max-w-[110px] truncate" title={ramo}>{ramo}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aseguradoras.map(aseg => (
                <tr key={aseg} className="hover:bg-cream-50">
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-ink-200 px-3 py-2 font-medium text-ink-700 whitespace-nowrap">
                    {aseg}
                  </td>
                  {ramos.map(ramo => {
                    const cell = idx.get(`${aseg}|${ramo}`)
                    return (
                      <td key={ramo} className="border-b border-cream-200 px-1 py-1 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin || saving}
                          onClick={() => cycleCell(aseg, ramo)}
                          title={cell?.nota || (cell ? DISP_LABEL[cell.disponible] : 'Sin definir')}
                          className={[
                            'w-full min-w-[44px] rounded px-1.5 py-1 font-medium transition-colors',
                            cell ? DISP_CELL[cell.disponible] : 'text-ink-300',
                            isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                          ].join(' ')}
                        >
                          {cell
                            ? (cell.disponible === 'si' ? <Check className="w-3.5 h-3.5 mx-auto" />
                              : cell.disponible === 'no' ? <X className="w-3.5 h-3.5 mx-auto" />
                              : '~')
                            : '—'}
                          {cell?.nota && <span className="block text-[9px] leading-tight opacity-70 truncate max-w-[60px]">{cell.nota}</span>}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
