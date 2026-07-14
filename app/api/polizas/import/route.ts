import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { importarPolizas } from '@/lib/import/importarPolizas'
import type { ExcelRow } from '@/lib/import/types'

// Los updates de un re-import grande pueden tomar >10s (default de Vercel)
export const maxDuration = 60

const MAX_FILAS = 5000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { workspace_id?: string; rows?: ExcelRow[] }
    const workspaceId = body.workspace_id
    const rows        = body.rows

    if (!workspaceId || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }
    if (rows.length > MAX_FILAS) {
      return NextResponse.json(
        { error: `Máximo ${MAX_FILAS} filas por importación (recibidas: ${rows.length})` },
        { status: 413 },
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar membresía del workspace (fail-fast; RLS igual protege cada
    // escritura). Mismo RPC SECURITY DEFINER que usa WorkspaceContext.
    const { data: wsRows } = await supabase.rpc('get_user_workspaces')
    const esMiembro = Array.isArray(wsRows) &&
      wsRows.some((row: { workspace?: { id?: string } }) => row.workspace?.id === workspaceId)
    if (!esMiembro) {
      return NextResponse.json({ error: 'No eres miembro de este workspace' }, { status: 403 })
    }

    const result = await importarPolizas(supabase, rows, workspaceId, user.id)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[POST /api/polizas/import]', e)
    return NextResponse.json({ error: 'Error interno al importar' }, { status: 500 })
  }
}
