import { NextRequest, NextResponse }  from 'next/server'
import { createServerClient }          from '@supabase/ssr'
import { cookies }                     from 'next/headers'

interface PatchBody {
  poliza_id:  string | null
  notas?:     string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineaId: string }> }
) {
  try {
    const { id: colillaId, lineaId } = await params
    const body: PatchBody = await req.json()

    const cookieStore = await cookies()
    const supabase    = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Verificar que la línea pertenece a la colilla y está en borrador
    const { data: linea } = await supabase
      .from('colilla_lineas')
      .select('id, colilla_id, colillas_importacion!inner(estado)')
      .eq('id', lineaId)
      .eq('colilla_id', colillaId)
      .single()

    if (!linea) {
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })
    }

    const nuevoEstado = body.poliza_id ? 'corregida_manual' : 'no_encontrada'

    const { error } = await supabase
      .from('colilla_lineas')
      .update({
        poliza_id:           body.poliza_id,
        estado_conciliacion: nuevoEstado,
        notas:               body.notas ?? null,
      })
      .eq('id', lineaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, estado_conciliacion: nuevoEstado })
  } catch (e) {
    console.error('[PATCH /api/colillas/[id]/linea/[lineaId]]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
