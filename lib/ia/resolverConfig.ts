import type { SupabaseClient } from '@supabase/supabase-js'
import { ConfigIA, ProveedorIA, PROVEEDORES_IA } from './motor'

// Resuelve la config de IA efectiva de un workspace (SOLO server-side).
// Requiere un cliente con service-role: la tabla ia_config tiene RLS default-deny,
// así que la llave BYOK solo es legible bypasseando RLS desde el servidor.
//
// Regla de resolución:
//   * proveedor 'groq' (o sin config)  -> usa la llave COMPARTIDA del env (Senda incluido).
//   * otro proveedor                    -> exige la llave BYOK del workspace.
export async function resolverConfigIA(
  serviceClient: SupabaseClient,
  workspaceId: string,
): Promise<ConfigIA> {
  const { data } = await serviceClient
    .from('ia_config')
    .select('proveedor, modelo, api_key')
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  const proveedor: ProveedorIA =
    data?.proveedor && PROVEEDORES_IA.includes(data.proveedor as ProveedorIA)
      ? (data.proveedor as ProveedorIA)
      : 'groq'
  const modelo: string | null = data?.modelo ?? null

  if (proveedor === 'groq') {
    const shared = process.env.GROQ_API_KEY
    if (!shared) throw new Error('GROQ_API_KEY no configurada en el servidor')
    return { proveedor, modelo, apiKey: shared }
  }

  const apiKey = data?.api_key
  if (!apiKey) {
    throw new Error(`Configurá la llave de API de ${proveedor} en Configuración → Motor de IA`)
  }
  return { proveedor, modelo, apiKey }
}
