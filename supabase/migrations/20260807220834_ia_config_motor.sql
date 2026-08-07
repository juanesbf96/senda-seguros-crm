-- Motor de IA multi-proveedor (BYOK) — Fase 4.3 del PLAN_EJECUCION_AUDITORIAS.md
--
-- Config de IA por workspace. La llave (api_key) es SENSIBLE: NUNCA debe llegar
-- al cliente. Por eso:
--   * La tabla tiene RLS habilitado y NINGUNA política para `authenticated`
--     → el cliente no puede leerla ni escribirla directamente (default-deny).
--   * La UI lee vía `get_ia_config` (devuelve proveedor/modelo + `tiene_llave`,
--     nunca la llave) y escribe vía `set_ia_config` (SECURITY DEFINER, admin).
--   * El servidor (rutas API) lee la llave con el service-role key (bypassa RLS),
--     nunca se expone al navegador.
--
-- Proveedor default 'groq' = "Senda incluido" (usa la llave compartida del env,
-- gratis para el cliente). Los demás requieren llave propia (BYOK).

CREATE TABLE IF NOT EXISTS public.ia_config (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  proveedor    text NOT NULL DEFAULT 'groq'
                 CHECK (proveedor IN ('groq','openai','anthropic','deepseek','gemini')),
  modelo       text,
  api_key      text,               -- BYOK; NULL cuando se usa 'groq' incluido
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ia_config IS
  'Config de IA por workspace (fase 4.3). api_key es sensible: sin acceso directo del cliente (RLS default-deny); solo server-side por service-role o via RPCs que no exponen la llave.';

ALTER TABLE public.ia_config ENABLE ROW LEVEL SECURITY;
-- Sin políticas: el cliente no accede directo. Todo va por RPC o service-role.

-- Lectura para la UI: proveedor, modelo y si hay llave — NUNCA la llave.
CREATE OR REPLACE FUNCTION public.get_ia_config(p_ws uuid)
  RETURNS TABLE (proveedor text, modelo text, tiene_llave boolean)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_workspace_admin(p_ws) THEN
    RAISE EXCEPTION 'Solo un administrador puede ver la configuración de IA';
  END IF;
  RETURN QUERY
    SELECT c.proveedor, c.modelo, (c.api_key IS NOT NULL AND c.api_key <> '')
    FROM ia_config c WHERE c.workspace_id = p_ws;
  -- Si no hay fila, devolver el default 'groq' sin llave.
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'groq'::text, NULL::text, false;
  END IF;
END;
$$;

-- Escritura (admin). p_api_key: NULL = dejar la llave como está; '' = borrarla.
CREATE OR REPLACE FUNCTION public.set_ia_config(
  p_ws uuid, p_proveedor text, p_modelo text, p_api_key text DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_workspace_admin(p_ws) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar la configuración de IA';
  END IF;
  IF p_proveedor NOT IN ('groq','openai','anthropic','deepseek','gemini') THEN
    RAISE EXCEPTION 'Proveedor no soportado: %', p_proveedor;
  END IF;

  INSERT INTO ia_config (workspace_id, proveedor, modelo, api_key, updated_at)
    VALUES (p_ws, p_proveedor, NULLIF(p_modelo, ''),
            CASE WHEN p_api_key = '' THEN NULL ELSE p_api_key END, now())
  ON CONFLICT (workspace_id) DO UPDATE SET
    proveedor  = EXCLUDED.proveedor,
    modelo     = EXCLUDED.modelo,
    -- NULL entrante = conservar la llave actual; '' = borrarla; valor = reemplazar.
    api_key    = CASE
                   WHEN p_api_key IS NULL THEN ia_config.api_key
                   WHEN p_api_key = ''     THEN NULL
                   ELSE p_api_key
                 END,
    updated_at = now();
END;
$$;

ALTER FUNCTION public.get_ia_config(uuid) OWNER TO postgres;
ALTER FUNCTION public.set_ia_config(uuid, text, text, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_ia_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_ia_config(uuid, text, text, text) TO authenticated;
