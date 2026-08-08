-- Fase 3 (deuda documentada en BITACORA) — periodicidad de la CUOTA de financiación.
--
-- El espaciado entre cuotas lo define el acuerdo con la FINANCIERA (Crediseguro,
-- Finesa, Servicrédito…), NO `periodicidad_pago`, que describe cada cuánto se paga
-- la PRIMA. Hasta ahora `generar_operaciones_cuotas` leía `periodicidad_pago`, que
-- es conceptualmente incorrecto para una póliza financiada: una póliza anual
-- ("Anual financiado") se paga en cuotas mensuales, no en una cuota al año.
--
-- Nullable y SIN DEFAULT a propósito: NULL = "no especificado". Un DEFAULT
-- 'mensual' escribiría sobre las ~1.000 pólizas existentes una decisión que nadie
-- tomó. El generador interpreta NULL como mensual, que es el caso predominante.

ALTER TABLE public.polizas
  ADD COLUMN IF NOT EXISTS periodicidad_cuota text;

ALTER TABLE public.polizas
  DROP CONSTRAINT IF EXISTS polizas_periodicidad_cuota_check;

ALTER TABLE public.polizas
  ADD CONSTRAINT polizas_periodicidad_cuota_check
  CHECK (
    periodicidad_cuota IS NULL
    OR periodicidad_cuota IN ('mensual','bimestral','trimestral','semestral','anual')
  );

COMMENT ON COLUMN public.polizas.periodicidad_cuota IS
  'Espaciado entre cuotas de financiación, definido por el acuerdo con la financiera. '
  'NULL = no especificado (el generador de cuotas asume mensual). '
  'Distinto de periodicidad_pago, que describe la periodicidad de la PRIMA.';

-- ---------------------------------------------------------------------------
-- Generador de cuotas: pasa a leer `periodicidad_cuota`.
--
-- Idéntico a 20260801223448_operaciones_produccion.sql salvo la fuente de la
-- periodicidad. NO cae de vuelta a `periodicidad_pago`: ese es justamente el
-- campo equivocado que esta migración saca de este camino, y usarlo como
-- fallback reintroduciría el bug en silencio para las pólizas que lo tengan.
-- ---------------------------------------------------------------------------
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
         lower(COALESCE(periodicidad_cuota, 'mensual'))
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
