'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { RegistroCambio } from '@/types'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { formatDate } from '@/lib/utils'
import { History, Plus, Pencil, Trash2 } from 'lucide-react'

/**
 * Cronología de cambios de un registro, leída de `registro_cambios`
 * (poblada por trigger a nivel de BD). Sirve para cualquier tabla auditada:
 * polizas, clientes, cobros, liquidaciones.
 */
export default function Cronologia({ tabla, registroId }: { tabla: string; registroId: string }) {
  const { currentWorkspace } = useWorkspace()
  const [items, setItems]     = useState<RegistroCambio[]>([])
  const [loading, setLoading] = useState(true)
  const [nombres, setNombres] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!currentWorkspace) return
    let activo = true
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('registro_cambios')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .eq('tabla', tabla)
        .eq('registro_id', registroId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!activo) return
      const rows = (data as RegistroCambio[]) || []
      setItems(rows)
      setLoading(false)
      // Resolver nombres de usuarios que aparezcan
      const uids = [...new Set(rows.map(r => r.usuario_id).filter(Boolean))] as string[]
      if (uids.length) {
        const { data: miembros } = await supabase.rpc('get_workspace_members', { p_workspace_id: currentWorkspace.id })
        if (miembros && activo) {
          const map: Record<string, string> = {}
          for (const m of miembros as { user_id: string; nombre?: string; email?: string }[]) {
            map[m.user_id] = m.nombre || m.email || m.user_id.slice(0, 8)
          }
          setNombres(map)
        }
      }
    })()
    return () => { activo = false }
  }, [tabla, registroId, currentWorkspace])

  const ICON = {
    insert: <Plus className="w-3.5 h-3.5 text-primary-600" />,
    update: <Pencil className="w-3.5 h-3.5 text-info" />,
    delete: <Trash2 className="w-3.5 h-3.5 text-error" />,
  }
  const LABEL = { insert: 'Creado', update: 'Modificado', delete: 'Eliminado' }

  return (
    <div className="bg-white rounded-xl border border-ink-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary-500"><History className="w-4 h-4" /></span>
        <h3 className="font-semibold text-ink-700 text-sm">Cronología</h3>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-400">Sin cambios registrados.</p>
      ) : (
        <ol className="relative border-l border-ink-100 ml-1.5 space-y-4">
          {items.map(it => (
            <li key={it.id} className="ml-4">
              <span className="absolute -left-[7px] flex items-center justify-center w-3.5 h-3.5 bg-white rounded-full">
                {ICON[it.accion]}
              </span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-medium text-ink-700">{LABEL[it.accion]}</span>
                <span className="text-xs text-ink-400">
                  {formatDate(it.created_at)} · {new Date(it.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs text-ink-400">
                  {it.usuario_id ? `· ${nombres[it.usuario_id] ?? 'Usuario'}` : '· Sistema'}
                </span>
              </div>
              {it.accion === 'update' && it.campos_cambiados && (
                <ul className="mt-1 space-y-0.5">
                  {Object.entries(it.campos_cambiados).slice(0, 8).map(([campo, v]) => (
                    <li key={campo} className="text-xs text-ink-500">
                      <span className="font-medium text-ink-600">{campo}</span>:{' '}
                      <span className="text-ink-400 line-through">{fmt(v.antes)}</span>{' → '}
                      <span className="text-ink-700">{fmt(v.despues)}</span>
                    </li>
                  ))}
                  {Object.keys(it.campos_cambiados).length > 8 && (
                    <li className="text-xs text-ink-400">…y {Object.keys(it.campos_cambiados).length - 8} campo(s) más</li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '∅'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  const s = String(v)
  return s.length > 40 ? s.slice(0, 40) + '…' : s
}
