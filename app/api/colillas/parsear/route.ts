import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import { parsearColilla, AseguradoraKey } from '@/lib/colillas/parsers'
import { reconciliarLineas, calcularStats } from '@/lib/colillas/reconciliar'

export async function POST(req: NextRequest) {
  try {
    const formData    = await req.formData()
    const archivo     = formData.get('archivo')     as File | null
    const aseguradora = formData.get('aseguradora') as string | null
    const workspaceId = formData.get('workspace_id') as string | null

    if (!archivo || !aseguradora || !workspaceId) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    // Parsear archivo
    const buffer      = await archivo.arrayBuffer()
    const parseResult = await parsearColilla(aseguradora as AseguradoraKey, buffer)

    if (!parseResult.ok) {
      return NextResponse.json({ error: parseResult.error }, { status: 422 })
    }

    // Reconciliar contra pólizas del workspace
    const cookieStore = await cookies()
    const supabase    = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const lineasReconciliadas = await reconciliarLineas(parseResult.lineas, workspaceId, supabase)
    const stats               = calcularStats(lineasReconciliadas)

    return NextResponse.json({ ok: true, lineas: lineasReconciliadas, stats })
  } catch (e) {
    console.error('[POST /api/colillas/parsear]', e)
    return NextResponse.json({ error: 'Error interno al procesar el archivo' }, { status: 500 })
  }
}
