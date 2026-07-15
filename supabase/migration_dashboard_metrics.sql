-- ══════════════════════════════════════════════════════════════════════
-- Dashboard con agregados en la base de datos (C5c)
--
-- El Dashboard hacía ~20 queries que traían FILAS al navegador para
-- contarlas/sumarlas en JS (incluyendo select * de todos los clientes y
-- todas las pólizas activas con join). Este RPC devuelve todos los
-- números ya calculados en un solo jsonb de pocos KB.
--
-- SECURITY INVOKER (por defecto): las políticas RLS del usuario aplican
-- dentro de la función — cada quien ve las métricas de lo que puede leer.
--
-- p_uid: si viene, filtra las métricas "propias" del agente
--   (clientes.assigned_to, polizas.vendedor_id, tareas/solicitudes.asignado_a)
--   igual que hacía el Dashboard. Cobros/liquidaciones/siniestros/tendencia
--   siguen siendo globales, como hoy.
--
-- IDEMPOTENTE. Aplicar en Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_ws uuid, p_uid uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  v_hoy     date := current_date;
  v_manana  date := current_date + 1;
  v_in7     date := current_date + 7;
  v_in90    date := current_date + 90;
  v_d30ago  date := current_date - 30;
  v_trend0  date := date_trunc('month', current_date - interval '11 months')::date;
  v_mes0    date := date_trunc('month', current_date)::date;
  v_mesp0   date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_mesp1   date := (date_trunc('month', current_date) - interval '1 day')::date;
  r         jsonb;
BEGIN
  WITH
  cl AS (
    SELECT * FROM clientes
    WHERE workspace_id = p_ws AND (p_uid IS NULL OR assigned_to = p_uid)
  ),
  po AS (  -- pólizas no eliminadas (con filtro de agente si aplica)
    SELECT * FROM polizas
    WHERE workspace_id = p_ws AND eliminada = false
      AND (p_uid IS NULL OR vendedor_id = p_uid)
  ),
  po_act AS (SELECT * FROM po WHERE estado = 'activa'),
  meses AS (
    SELECT generate_series(v_trend0, v_mes0, interval '1 month')::date AS mes
  ),
  dias AS (
    SELECT generate_series(v_d30ago, v_hoy - 1, interval '1 day')::date AS dia
  ),
  cumple AS (
    SELECT id, nombre, fecha_nacimiento,
      (to_date(
         to_char(v_hoy, 'YYYY') || '-' ||
         replace(to_char(fecha_nacimiento, 'MM-DD'), '02-29', '02-28'),
         'YYYY-MM-DD'
       ) + CASE WHEN to_date(
         to_char(v_hoy, 'YYYY') || '-' ||
         replace(to_char(fecha_nacimiento, 'MM-DD'), '02-29', '02-28'),
         'YYYY-MM-DD') < v_hoy THEN interval '1 year' ELSE interval '0' END
      )::date AS proximo
    FROM cl WHERE fecha_nacimiento IS NOT NULL
  )
  SELECT jsonb_build_object(
    'clientes_total',  (SELECT count(*) FROM cl),
    'clientes_por_etapa', (SELECT coalesce(jsonb_object_agg(etapa, n), '{}'::jsonb)
      FROM (SELECT etapa, count(*) n FROM cl GROUP BY etapa) t),
    'clientes_recientes', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT id, nombre, ciudad, etapa, categoria, telefono
      FROM cl ORDER BY created_at DESC LIMIT 5) t),
    'cumpleanos', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT id, nombre, fecha_nacimiento FROM cumple
      WHERE proximo - v_hoy <= 5 ORDER BY proximo LIMIT 9) t),

    'polizas_activas', (SELECT count(*) FROM po_act),
    'polizas_total',   (SELECT count(*) FROM po),
    'polizas_por_estado', (SELECT coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
      FROM (SELECT estado, count(*) n FROM po GROUP BY estado) t),
    'prima_total',    (SELECT coalesce(sum(coalesce(prima_neta, prima, 0)), 0) FROM po_act),
    'comision_total', (SELECT coalesce(sum(coalesce(comision_agencia, 0)), 0) FROM po_act),

    'renov_30', (SELECT count(*) FROM po_act WHERE fecha_fin BETWEEN v_hoy AND v_hoy + 30),
    'renov_60', (SELECT count(*) FROM po_act WHERE fecha_fin BETWEEN v_hoy + 31 AND v_hoy + 60),
    'renov_buckets', (SELECT jsonb_agg(n ORDER BY b) FROM (
      SELECT width_bucket(fecha_fin - v_hoy, 0, 90, 6) AS b, count(*) AS n
      FROM po_act WHERE fecha_fin BETWEEN v_hoy AND v_in90
      GROUP BY 1
      UNION ALL SELECT s, 0 FROM generate_series(1, 6) s
      WHERE s NOT IN (SELECT width_bucket(fecha_fin - v_hoy, 0, 90, 6)
                      FROM po_act WHERE fecha_fin BETWEEN v_hoy AND v_in90)
    ) t),

    'cartera_ramo', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT coalesce(ramo, 'Sin ramo') AS label, count(*) AS value
      FROM po_act GROUP BY 1 ORDER BY 2 DESC LIMIT 6) t),
    'cartera_aseguradora', (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT coalesce(aseguradora, 'Sin asignar') AS label, count(*) AS value
      FROM po_act GROUP BY 1 ORDER BY 2 DESC LIMIT 6) t),

    -- Tendencia 12 meses (siempre global, como hoy)
    'trend', (SELECT jsonb_agg(jsonb_build_object(
        'mes', extract(month FROM m.mes)::int,
        'prima', coalesce(s.prima, 0), 'comision', coalesce(s.comision, 0))
        ORDER BY m.mes)
      FROM meses m LEFT JOIN (
        SELECT date_trunc('month', fecha_inicio)::date AS mes,
               sum(coalesce(prima_neta, 0)) prima,
               sum(coalesce(comision_agencia, 0)) comision
        FROM polizas
        WHERE workspace_id = p_ws AND eliminada = false AND fecha_inicio >= v_trend0
        GROUP BY 1) s ON s.mes = m.mes),

    'spark_clientes', (SELECT jsonb_agg(coalesce(s.n, 0) ORDER BY d.dia)
      FROM dias d LEFT JOIN (
        SELECT created_at::date AS dia, count(*) n FROM cl
        WHERE created_at >= v_d30ago GROUP BY 1) s ON s.dia = d.dia),
    'spark_polizas', (SELECT jsonb_agg(coalesce(s.n, 0) ORDER BY d.dia)
      FROM dias d LEFT JOIN (
        SELECT fecha_inicio AS dia, count(*) n FROM po
        WHERE fecha_inicio >= v_d30ago GROUP BY 1) s ON s.dia = d.dia),

    'tareas_vencidas', (SELECT count(*) FROM tareas WHERE workspace_id = p_ws
      AND completada = false AND fecha_vencimiento < v_hoy
      AND (p_uid IS NULL OR asignado_a = p_uid)),
    'tareas_hoy', (SELECT count(*) FROM tareas WHERE workspace_id = p_ws
      AND completada = false AND fecha_vencimiento = v_hoy
      AND (p_uid IS NULL OR asignado_a = p_uid)),
    'tareas_manana', (SELECT count(*) FROM tareas WHERE workspace_id = p_ws
      AND completada = false AND fecha_vencimiento = v_manana
      AND (p_uid IS NULL OR asignado_a = p_uid)),

    'siniestros_pendientes', (SELECT count(*) FROM siniestros
      WHERE workspace_id = p_ws AND estado NOT IN ('cerrado', 'rechazado')),

    'cobros_pendiente', (SELECT coalesce(sum(valor), 0) FROM cobros
      WHERE workspace_id = p_ws AND estado = 'pendiente'
        AND tipo IN ('por_cobrar', 'comision_por_cobrar')),
    'cobros_vencido', (SELECT coalesce(sum(valor), 0) FROM cobros
      WHERE workspace_id = p_ws AND estado = 'vencido'),
    'liq_pendiente', (SELECT coalesce(sum(coalesce(total_comision, 0)), 0)
      FROM liquidaciones WHERE workspace_id = p_ws AND estado = 'pendiente'),

    'sol_nuevas', (SELECT count(*) FROM solicitudes WHERE workspace_id = p_ws
      AND estado = 'nueva' AND (p_uid IS NULL OR asignado_a = p_uid)),
    'sol_activas', (SELECT count(*) FROM solicitudes WHERE workspace_id = p_ws
      AND estado IN ('nueva', 'en_proceso') AND (p_uid IS NULL OR asignado_a = p_uid)),
    'sol_urgentes', (SELECT count(*) FROM solicitudes WHERE workspace_id = p_ws
      AND estado IN ('nueva', 'en_proceso') AND prioridad = 'urgente'
      AND (p_uid IS NULL OR asignado_a = p_uid)),
    'sol_por_vencer', (SELECT count(*) FROM solicitudes WHERE workspace_id = p_ws
      AND estado IN ('nueva', 'en_proceso') AND fecha_limite <= v_in7
      AND (p_uid IS NULL OR asignado_a = p_uid)),

    'metas_activas', (SELECT count(*) FROM metas WHERE workspace_id = p_ws
      AND fecha_inicio <= v_hoy AND fecha_fin >= v_hoy),
    'metas_progreso', (SELECT coalesce(round(avg(least(
        CASE WHEN valor_meta > 0 THEN valor_actual / valor_meta * 100 ELSE 0 END, 100))), 0)
      FROM metas WHERE workspace_id = p_ws AND fecha_inicio <= v_hoy AND fecha_fin >= v_hoy),
    'metas_cumplidas', (SELECT count(*) FROM metas WHERE workspace_id = p_ws
      AND fecha_inicio <= v_hoy AND fecha_fin >= v_hoy
      AND valor_meta > 0 AND valor_actual >= valor_meta),

    'mes', (SELECT jsonb_build_object('polizas', count(*),
        'prima', coalesce(sum(coalesce(prima_neta, 0)), 0),
        'comision', coalesce(sum(coalesce(comision_agencia, 0)), 0))
      FROM po WHERE fecha_inicio >= v_mes0),
    'mes_pasado', (SELECT jsonb_build_object('polizas', count(*),
        'prima', coalesce(sum(coalesce(prima_neta, 0)), 0),
        'comision', coalesce(sum(coalesce(comision_agencia, 0)), 0))
      FROM po WHERE fecha_inicio BETWEEN v_mesp0 AND v_mesp1),
    'clientes_mes', (SELECT count(*) FROM cl WHERE created_at >= v_mes0),
    'clientes_mes_pasado', (SELECT count(*) FROM cl
      WHERE created_at >= v_mesp0 AND created_at < v_mes0),

    -- Producción por asesor del mes (solo tiene sentido en vista global)
    'produccion_asesores', CASE WHEN p_uid IS NOT NULL THEN '[]'::jsonb ELSE
      (SELECT coalesce(jsonb_agg(t ORDER BY t.prima DESC), '[]'::jsonb) FROM (
        SELECT coalesce(p.vendedor_id::text, '__sin_asignar__') AS id,
               coalesce(v.nombre, 'Sin asignar') AS nombre,
               count(*) AS count,
               coalesce(sum(coalesce(p.prima_neta, 0)), 0) AS prima,
               coalesce(sum(coalesce(p.comision_agencia, 0)), 0) AS comision
        FROM po p LEFT JOIN vendedores v ON v.id = p.vendedor_id
        WHERE p.fecha_inicio >= v_mes0
        GROUP BY 1, 2) t) END
  ) INTO r;

  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics(uuid, uuid) TO authenticated;

-- Verificación sugerida (SQL Editor, con tu sesión):
-- SELECT jsonb_pretty(get_dashboard_metrics('<workspace_id>'));
