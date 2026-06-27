import { createServerClient } from '@supabase/ssr'
import type { ColillaLineaRaw } from './parsers/types'

export interface PolizaSugerida {
  id:             string
  numero_poliza:  string | null
  nombre_tomador: string | null
  aseguradora:    string
}

export interface LineaReconciliada extends ColillaLineaRaw {
  poliza_id:           string | null
  // 'probable' es solo client-side; se resuelve a corregida_manual / no_encontrada antes de guardar en DB
  estado_conciliacion: 'conciliada' | 'no_encontrada' | 'corregida_manual' | 'probable'
  poliza_sugerida?:    PolizaSugerida
}

export async function reconciliarLineas(
  lineas: ColillaLineaRaw[],
  workspaceId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<LineaReconciliada[]> {
  if (lineas.length === 0) return []

  // ── Paso 1: match exacto por número de póliza ──────────────────────
  const numerosRaw = [...new Set(lineas.map(l => l.numero_poliza_raw).filter(Boolean))]

  const { data: polizas } = await supabase
    .from('polizas')
    .select('id, numero_poliza')
    .eq('workspace_id', workspaceId)
    .in('numero_poliza', numerosRaw)

  type PolizaRow = { id: string; numero_poliza: string | null }
  const mapaPolizas = new Map<string, string>(
    ((polizas ?? []) as PolizaRow[])
      .filter((p): p is { id: string; numero_poliza: string } => typeof p.numero_poliza === 'string')
      .map((p) => [p.numero_poliza, p.id])
  )

  const reconciled: LineaReconciliada[] = lineas.map(linea => {
    if (linea.requiere_mapeo_manual) {
      return { ...linea, poliza_id: null, estado_conciliacion: 'no_encontrada' as const }
    }
    const polizaId = mapaPolizas.get(linea.numero_poliza_raw) ?? null
    return {
      ...linea,
      poliza_id:           polizaId,
      estado_conciliacion: polizaId ? ('conciliada' as const) : ('no_encontrada' as const),
    }
  })

  // ── Paso 2: match probable por nombre del tomador ──────────────────
  const sinMatch = reconciled.filter(l => l.estado_conciliacion === 'no_encontrada' && l.nombre_tomador)
  if (sinMatch.length > 0) {
    const palabrasClave = [...new Set(
      sinMatch.flatMap(l =>
        (l.nombre_tomador ?? '')
          .split(/\s+/)
          .filter(w => w.length >= 4)
          .slice(0, 2)
      )
    )]

    if (palabrasClave.length > 0) {
      const orFilter = palabrasClave.map(w => `nombre_tomador.ilike.%${w}%`).join(',')

      const { data: candidatos } = await supabase
        .from('polizas')
        .select('id, numero_poliza, nombre_tomador, aseguradora')
        .eq('workspace_id', workspaceId)
        .or(orFilter)

      type CandidatoRow = { id: string; numero_poliza: string | null; nombre_tomador: string | null; aseguradora: string }

      for (let i = 0; i < reconciled.length; i++) {
        const l = reconciled[i]
        if (l.estado_conciliacion !== 'no_encontrada' || !l.nombre_tomador) continue

        const palabras = l.nombre_tomador.toUpperCase().split(/\s+/).filter(w => w.length >= 4)
        const candidato = ((candidatos ?? []) as CandidatoRow[]).find(c => {
          const cNombre = (c.nombre_tomador ?? '').toUpperCase()
          const coincidencias = palabras.filter(w => cNombre.includes(w))
          // Requiere al menos 2 palabras coincidentes (o 1 si el nombre es corto)
          return coincidencias.length >= Math.min(2, palabras.length)
        })

        if (candidato) {
          reconciled[i] = {
            ...l,
            poliza_id:           candidato.id,
            estado_conciliacion: 'probable',
            poliza_sugerida:     candidato,
          }
        }
      }
    }
  }

  return reconciled
}

export function calcularStats(lineas: LineaReconciliada[]) {
  return {
    total:         lineas.length,
    conciliadas:   lineas.filter(l => l.estado_conciliacion === 'conciliada').length,
    probables:     lineas.filter(l => l.estado_conciliacion === 'probable').length,
    noEncontradas: lineas.filter(l => l.estado_conciliacion === 'no_encontrada').length,
    totalComision: lineas
      .filter(l => l.estado_conciliacion !== 'no_encontrada')
      .reduce((s, l) => s + (l.valor_comision ?? 0), 0),
  }
}
