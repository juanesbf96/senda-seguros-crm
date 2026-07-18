import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: colillaId } = await params

    const cookieStore = await cookies()
    const supabase    = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Obtener workspace de la colilla (para pasar al RPC)
    const { data: colilla } = await supabase
      .from('colillas_importacion')
      .select('workspace_id')
      .eq('id', colillaId)
      .single()

    if (!colilla) return NextResponse.json({ error: 'Colilla no encontrada' }, { status: 404 })

    const { data, error } = await supabase.rpc('confirmar_colilla', {
      p_colilla_id:   colillaId,
      p_workspace_id: colilla.workspace_id,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch (e) {
    console.error('[POST /api/colillas/[id]/confirmar]', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
