-- Operaciones de Producción (modelo de movimientos) — Fase 3 del PLAN_EJECUCION_AUDITORIAS.md
--
-- Cider unifica Renovación / Cobro-cuota / Cancelación / Modificación / Expedición
-- como "Operaciones de Producción" ligadas a la póliza, cada una con estado de
-- cartera. En Senda eso está regado entre Renovaciones, Cobros y Caja. Esta tabla
-- es el modelo unificado; convive con los Cobros existentes (no se migran datos
-- históricos aquí — eso se decide después con datos).
--
-- Este PR es el BACKBONE: tabla + RLS + índices + generador de cuotas. El timeline
-- dentro de PolizaDetalle y el enganche con financiación/cron se harán después,
-- coordinados con la fase 2 (que toca PolizaDetalle/PolizaModal).

-- 1. Tabla ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  poliza_id       uuid NOT NULL REFERENCES public.polizas(id)    ON DELETE CASCADE,
  tipo            text NOT NULL,
  numero_cuota    integer,
  estado_cartera  text NOT NULL DEFAULT 'pendiente',
  valor           numeric(15,2) DEFAULT 0,
  fecha_programada date,
  fecha_pago      date,
  responsable_id  uuid,
  origen          text,
  notas           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operaciones_tipo_check CHECK (tipo IN
    ('renovacion','cobro','cancelacion','modificacion','expedicion')),
  CONSTRAINT operaciones_estado_check CHECK (estado_cartera IN
    ('pendiente','pagada','anulada'))
);

COMMENT ON TABLE public.operaciones IS
  'Movimientos de producción por póliza (renovación/cobro-cuota/cancelación/etc), cada uno con estado de cartera. Modelo unificado estilo Cider.';

CREATE INDEX IF NOT EXISTS idx_operaciones_poliza
  ON public.operaciones (workspace_id, poliza_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_cartera
  ON public.operaciones (workspace_id, estado_cartera, fecha_programada);

-- 2. RLS (espejo de cobros) -------------------------------------------------
ALTER TABLE public.operaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operaciones_select" ON public.operaciones;
CREATE POLICY "operaciones_select" ON public.operaciones
  FOR SELECT USING (public.has_permission(workspace_id, 'finanzas_cobros_ver'));

DROP POLICY IF EXISTS "operaciones_insert" ON public.operaciones;
CREATE POLICY "operaciones_insert" ON public.operaciones
  FOR INSERT WITH CHECK (public.has_permission(workspace_id, 'finanzas_cobros_registrar'));

DROP POLICY IF EXISTS "operaciones_update" ON public.operaciones;
CREATE POLICY "operaciones_update" ON public.operaciones
  FOR UPDATE USING (public.has_permission(workspace_id, 'finanzas_cobros_registrar'));

DROP POLICY IF EXISTS "operaciones_delete" ON public.operaciones;
CREATE POLICY "operaciones_delete" ON public.operaciones
  FOR DELETE USING (public.is_workspace_admin(workspace_id));

-- 3. Generador de cuotas -----------------------------------------------------
-- Dada una póliza financiada, crea N operaciones tipo 'cobro' (Cobro 1..N) con
-- fechas programadas según la periodicidad. Lee la financiación desde la propia
-- póliza (num_cuotas, prima_periodica/prima_mensual, periodicidad_pago, fecha_inicio).
-- Idempotente-seguro: si la póliza ya tiene operaciones 'cobro', no duplica (error).
CREATE OR REPLACE FUNCTION public.generar_operaciones_cuotas(p_poliza_id uuid)
  RETURNS integer  -- cantidad de cuotas creadas
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws       uuid;
  v_n        integer;
  v_valor    numeric(15,2);
  v_inicio   date;
  v_period   text;
  v_step     interval;
  i          integer;
  v_creadas  integer := 0;
BEGIN
  SELECT workspace_id,
         num_cuotas,
         COALESCE(prima_periodica, prima_mensual,
                  CASE WHEN COALESCE(num_cuotas,0) > 0
                       THEN COALESCE(total_prima, prima_neta, prima, 0) / num_cuotas END),
         COALESCE(fecha_inicio, current_date),
         lower(COALESCE(periodicidad_pago, 'mensual'))
    INTO v_ws, v_n, v_valor, v_inicio, v_period
    FROM polizas
   WHERE id = p_poliza_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Póliza no encontrada: %', p_poliza_id;
  END IF;
  IF NOT public.has_permission(v_ws, 'finanzas_cobros_registrar') THEN
    RAISE EXCEPTION 'Sin permiso para generar cuotas en este workspace';
  END IF;
  IF v_n IS NULL OR v_n < 1 THEN
    RAISE EXCEPTION 'La póliza no tiene num_cuotas válido (financiación)';
  END IF;
  IF EXISTS (SELECT 1 FROM operaciones WHERE poliza_id = p_poliza_id AND tipo = 'cobro') THEN
    RAISE EXCEPTION 'La póliza ya tiene cuotas generadas';
  END IF;

  v_step := CASE v_period
    WHEN 'mensual'    THEN interval '1 month'
    WHEN 'bimestral'  THEN interval '2 months'
    WHEN 'trimestral' THEN interval '3 months'
    WHEN 'semestral'  THEN interval '6 months'
    WHEN 'anual'      THEN interval '12 months'
    ELSE interval '1 month'
  END;

  FOR i IN 1..v_n LOOP
    INSERT INTO operaciones (workspace_id, poliza_id, tipo, numero_cuota,
                             estado_cartera, valor, fecha_programada, origen)
    VALUES (v_ws, p_poliza_id, 'cobro', i, 'pendiente',
            COALESCE(v_valor, 0),
            (v_inicio + (v_step * (i - 1)))::date,
            'generador_cuotas');
    v_creadas := v_creadas + 1;
  END LOOP;

  RETURN v_creadas;
END;
$$;

ALTER FUNCTION public.generar_operaciones_cuotas(uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.generar_operaciones_cuotas(uuid) TO authenticated, service_role;
