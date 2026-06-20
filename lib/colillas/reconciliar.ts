import { createServerClient } from '@supabase/ssr'
import type { ColillaLineaRaw } from './parsers/types'

export interface LineaReconciliada extends ColillaLineaRaw {
  poliza_id:            string | null
  estado_conciliacion:  'conciliada' | 'no_encontrada' | 'corregida_manual'
}

export async function reconciliarLineas(
  lineas: ColillaLineaRaw[],
  workspaceId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<LineaReconciliada[]> {
  if (lineas.length === 0) return []

  // Obtener todos los números de póliza del workspace de una sola query
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

  return lineas.map(linea => {
    // 48 Horas: VOUCHER nunca matchea automáticamente
    if (linea.requiere_mapeo_manual) {
      return {
        ...linea,
        poliza_id:           null,
        estado_conciliacion: 'no_encontrada' as const,
      }
    }

    const polizaId = mapaPolizas.get(linea.numero_poliza_raw) ?? null
    return {
      ...linea,
      poliza_id:           polizaId,
      estado_conciliacion: polizaId ? ('conciliada' as const) : ('no_encontrada' as const),
    }
  })
}

export function calcularStats(lineas: LineaReconciliada[]) {
  return {
    total:          lineas.length,
    conciliadas:    lineas.filter(l => l.estado_conciliacion === 'conciliada').length,
    noEncontradas:  lineas.filter(l => l.estado_conciliacion === 'no_encontrada').length,
    totalComision:  lineas.reduce((s, l) => s + (l.valor_comision ?? 0), 0),
  }
}
