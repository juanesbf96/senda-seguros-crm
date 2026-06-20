import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import type { LineaReconciliada }    from '@/lib/colillas/reconciliar'

interface CrearBody {
  workspace_id:   string
  aseguradora:    string
  periodo:        string
  archivo_nombre: string
  lineas:         LineaReconciliada[]
}

export async function POST(req: NextRequest) {
  try {
    const body: CrearBody = await req.json()
    const { workspace_id, aseguradora, periodo, archivo_nombre, lineas } = body

    if (!workspace_id || !aseguradora || !periodo || !archivo_nombre || !lineas?.length) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase    = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Insertar colilla en borrador
    const { data: colilla, error: errColilla } = await supabase
      .from('colillas_importacion')
      .insert({
        workspace_id,
        aseguradora,
        periodo,
        archivo_nombre,
        total_lineas:  lineas.length,
        conciliadas:   lineas.filter(l => l.estado_conciliacion === 'conciliada').length,
        no_encontradas: lineas.filter(l => l.estado_conciliacion === 'no_encontrada').length,
        estado:        'borrador',
        creado_por:    user.id,
      })
      .select('id')
      .single()

    if (errColilla || !colilla) {
      return NextResponse.json({ error: errColilla?.message ?? 'Error creando colilla' }, { status: 500 })
    }

    // Insertar líneas en lotes de 100
    const BATCH = 100
    for (let i = 0; i < lineas.length; i += BATCH) {
      const lote = lineas.slice(i, i + BATCH).map(l => ({
        colilla_id:           colilla.id,
        workspace_id,
        poliza_id:            l.poliza_id ?? null,
        numero_poliza_raw:    l.numero_poliza_raw,
        nombre_tomador:       l.nombre_tomador   ?? null,
        valor_prima:          l.valor_prima       ?? null,
        valor_comision:       l.valor_comision    ?? null,
        porcentaje_comision:  l.porcentaje_comision ?? null,
        fecha_pago:           l.fecha_pago        ?? null,
        fecha_recaudo:        l.fecha_recaudo     ?? null,
        retefuente:           l.retefuente        ?? null,
        estado_conciliacion:  l.estado_conciliacion,
      }))

      const { error: errLineas } = await supabase.from('colilla_lineas').insert(lote)
      if (errLineas) {
        // Rollback: eliminar colilla (cascada borra líneas)
        await supabase.from('colillas_importacion').delete().eq('id', colilla.id)
        return NextResponse.json({ error: errLineas.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, colilla_id: colilla.id })
  } catch (e) {
    console.error('[POST /api/colillas/crear]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
