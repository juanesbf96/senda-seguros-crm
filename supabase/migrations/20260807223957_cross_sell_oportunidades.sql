-- Ventas cruzadas (cross-sell) con scoring + caché de análisis de IA — Fase 4.2
--
-- 1) RPC get_oportunidades_cross_sell: clientes con póliza activa de una familia de
--    ramo X pero sin la familia sugerida Y, con un score básico (prima, antigüedad,
--    # pólizas). El ramo es texto libre → se categoriza en familias con ILIKE.
-- 2) Tabla analisis_ia: cachea el mensaje sugerido por IA por (cliente, familia
--    destino) durante 30 días, con trazabilidad (modelo + timestamp).

-- ── Tabla de caché/trazabilidad de análisis de IA ──────────────────────────
CREATE TABLE IF NOT EXISTS public.analisis_ia (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tipo         text NOT NULL,                 -- 'cross_sell' | (futuros)
  entidad_id   uuid NOT NULL,                 -- p.ej. client_id
  clave        text,                          -- discriminador (p.ej. familia destino)
  resultado    jsonb NOT NULL,                -- { mensaje: "...", ... }
  modelo       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.analisis_ia IS
  'Caché y trazabilidad de análisis de IA (fase 4.2). Cross-sell cachea el mensaje por (cliente, familia destino) 30 días.';

CREATE INDEX IF NOT EXISTS idx_analisis_ia_lookup
  ON public.analisis_ia (workspace_id, tipo, entidad_id, clave, created_at DESC);

ALTER TABLE public.analisis_ia ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros del workspace. La escritura la hace el servidor (service-role)
-- tras llamar al motor de IA, así que no se exponen políticas de insert al cliente.
DROP POLICY IF EXISTS "analisis_ia_select" ON public.analisis_ia;
CREATE POLICY "analisis_ia_select" ON public.analisis_ia
  FOR SELECT USING (public.is_workspace_member(workspace_id));

-- ── RPC de oportunidades de cross-sell ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_oportunidades_cross_sell(p_workspace_id uuid)
  RETURNS TABLE (
    client_id        uuid,
    cliente_nombre   text,
    telefono         text,
    familia_tiene    text,
    familia_sugerida text,
    prioridad        text,
    num_polizas      int,
    prima_total      numeric,
    antiguedad_dias  int,
    score            numeric
  )
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH fam AS (
    SELECT
      p.client_id,
      CASE
        WHEN p.ramo ILIKE '%auto%' OR p.ramo ILIKE '%vehic%' OR p.ramo ILIKE '%soat%' OR p.ramo ILIKE '%moto%' THEN 'AUTOS'
        WHEN p.ramo ILIKE '%vida%'                                                                            THEN 'VIDA'
        WHEN p.ramo ILIKE '%salud%' OR p.ramo ILIKE '%medic%'                                                 THEN 'SALUD'
        WHEN p.ramo ILIKE '%hogar%' OR p.ramo ILIKE '%copropiedad%' OR p.ramo ILIKE '%incendio%'              THEN 'HOGAR'
        WHEN p.ramo ILIKE '%cumplimiento%'                                                                    THEN 'CUMPLIMIENTO'
        WHEN p.ramo ILIKE '%responsabilidad%' OR p.ramo ILIKE '%d&o%' OR p.ramo ILIKE '% rc%' OR p.ramo ILIKE 'rc %' THEN 'RC'
        WHEN p.ramo ILIKE '%empresarial%' OR p.ramo ILIKE '%pyme%' OR p.ramo ILIKE '%maquinaria%' OR p.ramo ILIKE '%trc%' THEN 'EMPRESARIAL'
        WHEN p.ramo ILIKE '%transporte%'                                                                      THEN 'TRANSPORTE'
        WHEN p.ramo ILIKE '%accidente%'                                                                       THEN 'ACCIDENTES'
        ELSE 'OTRO'
      END AS familia,
      p.prima, p.fecha_inicio
    FROM polizas p
    WHERE p.workspace_id = p_workspace_id
      AND p.estado = 'activa'
      AND p.eliminada = false
  ),
  cli AS (
    SELECT
      client_id,
      array_agg(DISTINCT familia)          AS familias,
      count(*)                             AS num_polizas,
      COALESCE(sum(prima), 0)              AS prima_total,
      min(fecha_inicio)                    AS primera
    FROM fam
    GROUP BY client_id
  ),
  reglas(origen, destino, prioridad, base) AS (
    VALUES
      ('AUTOS','VIDA','alta',30),
      ('AUTOS','HOGAR','media',20),
      ('HOGAR','AUTOS','media',20),
      ('VIDA','SALUD','media',20),
      ('SALUD','VIDA','alta',30),
      ('CUMPLIMIENTO','RC','alta',30),
      ('EMPRESARIAL','RC','media',20),
      ('EMPRESARIAL','CUMPLIMIENTO','baja',10)
  )
  SELECT
    c.client_id,
    cl.nombre,
    cl.telefono,
    r.origen,
    r.destino,
    r.prioridad,
    c.num_polizas::int,
    c.prima_total,
    (current_date - c.primera)::int AS antiguedad_dias,
    LEAST(100,
      r.base
      + LEAST(30, (c.prima_total / 1000000.0) * 3)            -- prima
      + LEAST(20, (current_date - c.primera) / 365.0 * 5)      -- antigüedad
      + LEAST(20, c.num_polizas * 5)                           -- # pólizas
    )::numeric(6,1) AS score
  FROM cli c
  JOIN reglas r
    ON r.origen = ANY(c.familias)
   AND NOT (r.destino = ANY(c.familias))
  JOIN clientes cl ON cl.id = c.client_id
  WHERE is_workspace_member(p_workspace_id)
  ORDER BY score DESC, cl.nombre;
$$;

ALTER FUNCTION public.get_oportunidades_cross_sell(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.get_oportunidades_cross_sell(uuid) TO anon, authenticated, service_role;
