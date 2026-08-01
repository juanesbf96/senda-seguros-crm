-- ============================================================================
-- Motivos de cancelacion y de no-renovacion + RPCs de agregados para informes
-- Fase 1.1 del PLAN_EJECUCION_AUDITORIAS.md
--
-- Cider (el sistema que Rios Agencia usa hoy) trata el churn como ciudadano de
-- primera clase: el dashboard abre con "cancelaciones por mes y motivo" y sus
-- informes favoritos incluyen "renovadas vs no renovadas". Senda no registraba
-- POR QUE se pierde una poliza. Aqui se agrega ese registro estructurado.
-- ============================================================================

-- 1. Motivo de cancelacion en polizas ---------------------------------------
ALTER TABLE public.polizas
  ADD COLUMN IF NOT EXISTS motivo_cancelacion       text,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion_otro  text,
  ADD COLUMN IF NOT EXISTS fecha_cancelacion        date;

DO $$ BEGIN
  ALTER TABLE public.polizas
    ADD CONSTRAINT polizas_motivo_cancelacion_check
    CHECK (motivo_cancelacion IS NULL OR motivo_cancelacion IN
      ('por_no_pago','por_peticion_cliente','por_cambio_intermediario','otro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.polizas.motivo_cancelacion IS
  'Por que se cancelo: por_no_pago | por_peticion_cliente | por_cambio_intermediario | otro';

-- 2. Motivo de no-renovacion en gestiones_renovacion ------------------------
ALTER TABLE public.gestiones_renovacion
  ADD COLUMN IF NOT EXISTS motivo_no_renovacion text;

DO $$ BEGIN
  ALTER TABLE public.gestiones_renovacion
    ADD CONSTRAINT gestiones_motivo_no_renovacion_check
    CHECK (motivo_no_renovacion IS NULL OR motivo_no_renovacion IN
      ('por_no_pago','por_peticion_cliente','por_cambio_intermediario','precio','competencia','otro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. RPC: cancelaciones por mes y motivo (para el informe) -------------------
CREATE OR REPLACE FUNCTION public.get_cancelaciones_por_motivo(p_workspace_id uuid, p_anio int DEFAULT NULL)
  RETURNS TABLE (mes int, motivo text, cantidad bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXTRACT(MONTH FROM COALESCE(fecha_cancelacion, created_at))::int AS mes,
    COALESCE(motivo_cancelacion, 'sin_motivo') AS motivo,
    COUNT(*) AS cantidad
  FROM polizas
  WHERE workspace_id = p_workspace_id
    AND estado = 'cancelada'
    AND (p_anio IS NULL OR EXTRACT(YEAR FROM COALESCE(fecha_cancelacion, created_at)) = p_anio)
    AND is_workspace_member(p_workspace_id)
  GROUP BY 1, 2
  ORDER BY 1, 3 DESC;
$$;

-- 4. RPC: renovadas vs no-renovadas por mes ---------------------------------
-- Toma el ultimo estado de gestion por poliza (append-log: gana el mas reciente).
CREATE OR REPLACE FUNCTION public.get_renovaciones_resumen(p_workspace_id uuid, p_anio int DEFAULT NULL)
  RETURNS TABLE (mes int, renovadas bigint, no_renovadas bigint)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ultima_gestion AS (
    SELECT DISTINCT ON (poliza_id)
      poliza_id, estado, fecha
    FROM gestiones_renovacion
    WHERE workspace_id = p_workspace_id
      AND estado IN ('renovado','no_renueva')
    ORDER BY poliza_id, fecha DESC
  )
  SELECT
    EXTRACT(MONTH FROM fecha)::int AS mes,
    COUNT(*) FILTER (WHERE estado = 'renovado')   AS renovadas,
    COUNT(*) FILTER (WHERE estado = 'no_renueva') AS no_renovadas
  FROM ultima_gestion
  WHERE (p_anio IS NULL OR EXTRACT(YEAR FROM fecha) = p_anio)
    AND is_workspace_member(p_workspace_id)
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_cancelaciones_por_motivo(uuid, int) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_renovaciones_resumen(uuid, int) TO anon, authenticated, service_role;
