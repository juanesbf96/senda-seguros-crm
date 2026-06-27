import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import type { LineaReconciliada }    from '@/lib/colillas/reconciliar'

interface ActualizarNumero {
  poliza_id:    string
  nuevo_numero: string
}

interface CrearBody {
  workspace_id:       string
  aseguradora:        string
  periodo:            string
  archivo_nombre:     string
  lineas:             LineaReconciliada[]
  actualizar_numeros?: ActualizarNumero[]
}

export async function POST(req: NextRequest) {
  try {
    const body: CrearBody = await req.json()
    const { workspace_id, aseguradora, periodo, archivo_nombre, lineas, actualizar_numeros } = body

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

    // Resolver estado 'probable' (client-side only) antes de guardar
    const lineasResueltas = lineas.map(l => ({
      ...l,
      estado_conciliacion: l.estado_conciliacion === 'probable' ? 'corregida_manual' : l.estado_conciliacion,
    }))

    const conteo = {
      conciliadas:      lineasResueltas.filter(l => l.estado_conciliacion === 'conciliada').length,
      corregidas_manual: lineasResueltas.filter(l => l.estado_conciliacion === 'corregida_manual').length,
      no_encontradas:   lineasResueltas.filter(l => l.estado_conciliacion === 'no_encontrada').length,
    }

    // Insertar colilla en borrador
    const { data: colilla, error: errColilla } = await supabase
      .from('colillas_importacion')
      .insert({
        workspace_id,
        aseguradora,
        periodo,
        archivo_nombre,
        total_lineas:      lineasResueltas.length,
        conciliadas:       conteo.conciliadas,
        corregidas_manual: conteo.corregidas_manual,
        no_encontradas:    conteo.no_encontradas,
        estado:            'borrador',
        creado_por:        user.id,
      })
      .select('id')
      .single()

    if (errColilla || !colilla) {
      return NextResponse.json({ error: errColilla?.message ?? 'Error creando colilla' }, { status: 500 })
    }

    // Insertar líneas en lotes de 100
    const BATCH = 100
    for (let i = 0; i < lineasResueltas.length; i += BATCH) {
      const lote = lineasResueltas.slice(i, i + BATCH).map(l => ({
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
        await supabase.from('colillas_importacion').delete().eq('id', colilla.id)
        return NextResponse.json({ error: errLineas.message }, { status: 500 })
      }
    }

    // Actualizar números de póliza en CRM si el usuario lo solicitó
    if (actualizar_numeros?.length) {
      for (const { poliza_id, nuevo_numero } of actualizar_numeros) {
        await supabase
          .from('polizas')
          .update({ numero_poliza: nuevo_numero })
          .eq('id', poliza_id)
          .eq('workspace_id', workspace_id)
      }
    }

    return NextResponse.json({ ok: true, colilla_id: colilla.id, conteo })
  } catch (e) {
    console.error('[POST /api/colillas/crear]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
