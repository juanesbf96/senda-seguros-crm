-- KPIs comparativos del Dashboard — Fase 1.3 del PLAN_EJECUCION_AUDITORIAS.md
--
-- El dashboard ya compara "mes actual vs mes_pasado", pero mes_pasado es el mes
-- anterior COMPLETO: a mitad de mes eso da deltas engañosos (el mes en curso
-- siempre "cae" contra un mes completo). Esta RPC devuelve comparaciones JUSTAS,
-- alineadas al mismo número de días transcurridos del mes:
--   * mes_actual        : del día 1 del mes actual hasta hoy.
--   * mes_ant_a_fecha    : del día 1 del mes anterior hasta el mismo día relativo.
--   * anio_ant_a_fecha   : del día 1 del mismo mes del año pasado, mismo día relativo.
-- Se usa un offset en días (hoy - inicio de mes) para comparar "a igual avance",
-- no por fecha calendario (así meses de distinta longitud se comparan bien).
--
-- Métricas de producción (idénticas a get_dashboard_metrics): pólizas creadas
-- (por fecha_inicio), prima_neta emitida y comision_agencia. Respeta el filtro
-- por vendedor (p_uid) para la vista de agente.

CREATE OR REPLACE FUNCTION public.get_dashboard_comparativos(p_ws uuid, p_uid uuid DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_hoy    date := current_date;
  v_mes0   date := date_trunc('month', current_date)::date;
  v_offset int  := current_date - date_trunc('month', current_date)::date; -- días transcurridos
  v_mesp0  date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_anio0  date := (date_trunc('month', current_date) - interval '1 year')::date;
  r        jsonb;
BEGIN
  IF NOT is_workspace_member(p_ws) THEN
    RAISE EXCEPTION 'Sin permiso sobre este workspace';
  END IF;

  WITH po AS (
    SELECT fecha_inicio, prima_neta, comision_agencia
    FROM polizas
    WHERE workspace_id = p_ws AND eliminada = false
      AND (p_uid IS NULL OR vendedor_id = p_uid)
  ),
  ventana AS (
    SELECT 'mes_actual'::text AS k, v_mes0 AS ini, v_hoy AS fin
    UNION ALL SELECT 'mes_ant_a_fecha',  v_mesp0, v_mesp0 + v_offset
    UNION ALL SELECT 'anio_ant_a_fecha', v_anio0, v_anio0 + v_offset
  )
  SELECT jsonb_object_agg(t.k, t.bloque) INTO r
  FROM (
    SELECT w.k, jsonb_build_object(
      'polizas',  count(p.fecha_inicio),
      'prima',    coalesce(sum(coalesce(p.prima_neta, 0)), 0),
      'comision', coalesce(sum(coalesce(p.comision_agencia, 0)), 0)
    ) AS bloque
    FROM ventana w
    LEFT JOIN po p ON p.fecha_inicio BETWEEN w.ini AND w.fin
    GROUP BY w.k
  ) t;

  RETURN r;
END;
$$;

ALTER FUNCTION public.get_dashboard_comparativos(uuid, uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_dashboard_comparativos(uuid, uuid) TO anon, authenticated, service_role;
