


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_workspace_invitation"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inv     record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  SELECT * INTO v_inv
  FROM workspace_invitations
  WHERE token = p_token AND expires_at > now() AND accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitación inválida, ya usada, o expirada');
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_inv.workspace_id, v_user_id, v_inv.role, v_inv.created_by)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE workspace_invitations SET accepted_at = now() WHERE id = v_inv.id;

  RETURN jsonb_build_object('workspace_id', v_inv.workspace_id, 'role', v_inv.role);
END;
$$;


ALTER FUNCTION "public"."accept_workspace_invitation"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_workspace_invitation"("p_workspace_id" "uuid", "p_invitation_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'admin')
  THEN RAISE EXCEPTION 'Solo administradores pueden cancelar invitaciones'; END IF;

  DELETE FROM workspace_invitations
  WHERE id = p_invitation_id AND workspace_id = p_workspace_id;
END; $$;


ALTER FUNCTION "public"."cancel_workspace_invitation"("p_workspace_id" "uuid", "p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_member_role"("p_workspace_id" "uuid", "p_member_id" "uuid", "p_new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'admin')
  THEN RAISE EXCEPTION 'Solo administradores pueden cambiar roles'; END IF;

  IF p_new_role NOT IN ('admin','supervisor','agente')
  THEN RAISE EXCEPTION 'Rol inválido'; END IF;

  UPDATE workspace_members SET role = p_new_role
  WHERE id = p_member_id AND workspace_id = p_workspace_id;
END; $$;


ALTER FUNCTION "public"."change_member_role"("p_workspace_id" "uuid", "p_member_id" "uuid", "p_new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirmar_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conciliadas     int;
  v_no_encontradas  int;
  v_corregidas      int;
  v_periodo         text;
  v_aseguradora     text;
BEGIN
  -- Verificar pertenencia y estado
  IF NOT EXISTS (
    SELECT 1 FROM colillas_importacion
    WHERE id = p_colilla_id
      AND workspace_id = p_workspace_id
      AND estado = 'borrador'
  ) THEN
    RAISE EXCEPTION 'Colilla no encontrada o ya confirmada';
  END IF;

  -- Obtener período y aseguradora de la colilla
  SELECT periodo, aseguradora
  INTO v_periodo, v_aseguradora
  FROM colillas_importacion
  WHERE id = p_colilla_id;

  -- Contadores por estado
  SELECT
    COUNT(*) FILTER (WHERE estado_conciliacion = 'conciliada'),
    COUNT(*) FILTER (WHERE estado_conciliacion = 'no_encontrada'),
    COUNT(*) FILTER (WHERE estado_conciliacion = 'corregida_manual')
  INTO v_conciliadas, v_no_encontradas, v_corregidas
  FROM colilla_lineas
  WHERE colilla_id = p_colilla_id;

  -- Guardar historial y actualizar comision_agencia por cada línea conciliada
  INSERT INTO historial_comisiones_poliza (
    workspace_id, poliza_id, colilla_id, colilla_linea_id,
    periodo, aseguradora, valor_anterior, valor_nuevo
  )
  SELECT
    p_workspace_id,
    cl.poliza_id,
    p_colilla_id,
    cl.id,
    v_periodo,
    v_aseguradora,
    p.comision_agencia,
    cl.valor_comision
  FROM colilla_lineas cl
  JOIN polizas p ON p.id = cl.poliza_id
  WHERE cl.colilla_id = p_colilla_id
    AND cl.poliza_id IS NOT NULL
    AND cl.estado_conciliacion IN ('conciliada', 'corregida_manual');

  -- Actualizar comision_agencia en las pólizas vinculadas
  UPDATE polizas p SET
    comision_agencia  = cl.valor_comision,
    comision_recibida = true
  FROM colilla_lineas cl
  WHERE cl.colilla_id              = p_colilla_id
    AND cl.poliza_id               = p.id
    AND cl.estado_conciliacion     IN ('conciliada', 'corregida_manual');

  -- Confirmar la colilla
  UPDATE colillas_importacion SET
    estado            = 'confirmada',
    confirmed_at      = now(),
    conciliadas       = v_conciliadas,
    no_encontradas    = v_no_encontradas,
    corregidas_manual = v_corregidas
  WHERE id = p_colilla_id;

  RETURN jsonb_build_object(
    'ok',               true,
    'conciliadas',      v_conciliadas,
    'no_encontradas',   v_no_encontradas,
    'corregidas_manual', v_corregidas
  );
END;
$$;


ALTER FUNCTION "public"."confirmar_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_workspace_invitation"("p_workspace_id" "uuid", "p_email" "text", "p_role" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_token   text;
  v_inv_id  uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = v_user_id
      AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Solo los administradores pueden invitar miembros');
  END IF;

  IF p_role NOT IN ('admin', 'supervisor', 'agente') THEN
    RETURN jsonb_build_object('error', 'Rol inválido');
  END IF;

  INSERT INTO workspace_invitations (workspace_id, email, role, created_by)
  VALUES (p_workspace_id, lower(trim(p_email)), p_role, v_user_id)
  RETURNING id, token INTO v_inv_id, v_token;

  RETURN jsonb_build_object('id', v_inv_id, 'token', v_token);
END;
$$;


ALTER FUNCTION "public"."create_workspace_invitation"("p_workspace_id" "uuid", "p_email" "text", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_assignable_members"("p_workspace_id" "uuid") RETURNS TABLE("user_id" "uuid", "nombre" "text", "email" "text", "role" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Solo miembros del workspace pueden ver el listado
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = p_workspace_id AND w.owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    wm.user_id,
    COALESCE(u.raw_user_meta_data->>'nombre', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) AS nombre,
    u.email,
    wm.role
  FROM workspace_members wm
  JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY nombre;
END;
$$;


ALTER FUNCTION "public"."get_assignable_members"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_metrics"("p_ws" "uuid", "p_uid" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
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
      AND (p_uid IS NULL OR asignado_a = p_uid::text)),
    'tareas_hoy', (SELECT count(*) FROM tareas WHERE workspace_id = p_ws
      AND completada = false AND fecha_vencimiento = v_hoy
      AND (p_uid IS NULL OR asignado_a = p_uid::text)),
    'tareas_manana', (SELECT count(*) FROM tareas WHERE workspace_id = p_ws
      AND completada = false AND fecha_vencimiento = v_manana
      AND (p_uid IS NULL OR asignado_a = p_uid::text)),

    'siniestros_pendientes', (SELECT count(*) FROM siniestros
      WHERE workspace_id = p_ws AND estado NOT IN ('cerrado', 'rechazado')),

    -- cobros usa saldo_pendiente (no existe columna `valor` en el esquema real)
    'cobros_pendiente', (SELECT coalesce(sum(saldo_pendiente), 0) FROM cobros
      WHERE workspace_id = p_ws AND estado = 'pendiente'
        AND tipo IN ('por_cobrar', 'comision_por_cobrar')),
    'cobros_vencido', (SELECT coalesce(sum(saldo_pendiente), 0) FROM cobros
      WHERE workspace_id = p_ws AND estado = 'vencido'),
    'liq_pendiente', (SELECT coalesce(sum(coalesce(total_comision, 0)), 0)
      FROM liquidaciones WHERE workspace_id = p_ws AND estado = 'pendiente'),

    'sol_nuevas', (SELECT count(*) FROM solicitudes WHERE workspace_id = p_ws
      AND estado = 'nueva' AND (p_uid IS NULL OR asignado_a = p_uid::text)),
    'sol_activas', (SELECT count(*) FROM solicitudes WHERE workspace_id = p_ws
      AND estado IN ('nueva', 'en_proceso') AND (p_uid IS NULL OR asignado_a = p_uid::text)),
    -- solicitudes no tiene columnas prioridad/fecha_limite en el esquema real;
    -- estos contadores eran siempre 0 en el dashboard anterior (query fallida y
    -- swallowed). Se dejan en 0 explícito hasta que existan esas columnas.
    'sol_urgentes', 0,
    'sol_por_vencer', 0,

    'metas_activas', (SELECT count(*) FROM metas WHERE workspace_id = p_ws
      AND fecha_inicio <= v_hoy AND fecha_fin >= v_hoy),
    -- metas no tiene valor_meta/valor_actual en el esquema real (solo
    -- meta_prima_total). El progreso no es calculable aquí; 0 hasta unificar
    -- el esquema de metas con lo que espera MetasView.
    'metas_progreso', 0,
    'metas_cumplidas', 0,

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


ALTER FUNCTION "public"."get_dashboard_metrics"("p_ws" "uuid", "p_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_estado_cuenta_vendedor"("p_workspace_id" "uuid", "p_vendedor_id" "uuid" DEFAULT NULL::"uuid", "p_periodo" "text" DEFAULT NULL::"text") RETURNS TABLE("vendedor_id" "uuid", "vendedor_nombre" "text", "periodo" "text", "aseguradora" "text", "comision_esperada" numeric, "comision_recibida" numeric, "saldo_pendiente" numeric, "asesor_pago_estado" "text", "num_polizas" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH
  -- 1. Solo líneas válidas de colillas confirmadas
  lineas_validas AS (
    SELECT
      cl.poliza_id,
      cl.valor_comision,
      ci.periodo,
      ci.aseguradora
    FROM colilla_lineas cl
    JOIN colillas_importacion ci ON ci.id = cl.colilla_id
    WHERE ci.workspace_id           = p_workspace_id
      AND ci.estado                 = 'confirmada'
      AND cl.estado_conciliacion    IN ('conciliada', 'corregida_manual')
      AND cl.poliza_id              IS NOT NULL
      AND (p_periodo IS NULL OR ci.periodo = p_periodo)
  ),
  -- 2. Comisión recibida por grupo (poliza × periodo × aseguradora)
  recibido_por_grupo AS (
    SELECT
      lv.poliza_id,
      lv.periodo,
      lv.aseguradora,
      SUM(lv.valor_comision)  AS total_recibido
    FROM lineas_validas lv
    GROUP BY lv.poliza_id, lv.periodo, lv.aseguradora
  ),
  -- 3. Comisión esperada por póliza — DISTINCT para no multiplicar
  esperado_por_poliza AS (
    SELECT DISTINCT ON (p.id, rg.periodo, rg.aseguradora)
      p.id            AS poliza_id,
      p.vendedor_id,
      p.comision_abc_periodica,
      rg.periodo,
      rg.aseguradora
    FROM recibido_por_grupo rg
    JOIN polizas p ON p.id = rg.poliza_id
    WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
  )
  SELECT
    ep.vendedor_id,
    v.nombre                                             AS vendedor_nombre,
    ep.periodo,
    ep.aseguradora,
    COALESCE(SUM(ep.comision_abc_periodica), 0)          AS comision_esperada,
    COALESCE(SUM(rg.total_recibido),         0)          AS comision_recibida,
    COALESCE(SUM(ep.comision_abc_periodica), 0)
      - COALESCE(SUM(rg.total_recibido),     0)          AS saldo_pendiente,
    -- Estado de pago al asesor más frecuente del grupo
    (SELECT p2.asesor_pago_estado
     FROM polizas p2
     WHERE p2.vendedor_id   = ep.vendedor_id
       AND p2.workspace_id  = p_workspace_id
     GROUP BY p2.asesor_pago_estado
     ORDER BY COUNT(*) DESC
     LIMIT 1)                                             AS asesor_pago_estado,
    COUNT(DISTINCT ep.poliza_id)::int                    AS num_polizas
  FROM esperado_por_poliza ep
  JOIN recibido_por_grupo rg
    ON  rg.poliza_id   = ep.poliza_id
    AND rg.periodo     = ep.periodo
    AND rg.aseguradora = ep.aseguradora
  LEFT JOIN vendedores v ON v.id = ep.vendedor_id
  GROUP BY ep.vendedor_id, v.nombre, ep.periodo, ep.aseguradora
  ORDER BY ep.periodo DESC, v.nombre;
END;
$$;


ALTER FUNCTION "public"."get_estado_cuenta_vendedor"("p_workspace_id" "uuid", "p_vendedor_id" "uuid", "p_periodo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_invitation_by_token"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_row record;
BEGIN
  SELECT wi.id, wi.workspace_id, wi.email, wi.role, wi.token,
         wi.expires_at, wi.accepted_at, wi.created_by, w.name AS workspace_name
  INTO v_row
  FROM workspace_invitations wi
  JOIN workspaces w ON w.id = wi.workspace_id
  WHERE wi.token = p_token AND wi.expires_at > now() AND wi.accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id',           v_row.id,
    'workspace_id', v_row.workspace_id,
    'email',        v_row.email,
    'role',         v_row.role,
    'token',        v_row.token,
    'expires_at',   v_row.expires_at,
    'accepted_at',  v_row.accepted_at,
    'created_by',   v_row.created_by,
    'workspace',    jsonb_build_object('id', v_row.workspace_id, 'name', v_row.workspace_name)
  );
END;
$$;


ALTER FUNCTION "public"."get_invitation_by_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_permissions"("p_workspace_id" "uuid") RETURNS TABLE("permission_key" "text", "enabled" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_is_owner boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id AND w.owner_id = v_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN QUERY
      SELECT dp.permission_key, true::boolean
      FROM default_permissions dp
      GROUP BY dp.permission_key;
    RETURN;
  END IF;

  SELECT wm.role INTO v_role
  FROM workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = v_user_id;

  IF v_role IS NULL OR v_role = 'admin' THEN
    RETURN QUERY
      SELECT dp.permission_key, true::boolean
      FROM default_permissions dp
      GROUP BY dp.permission_key;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dp.permission_key,
    COALESCE(wp.enabled, dp.enabled) AS enabled
  FROM default_permissions dp
  LEFT JOIN workspace_permissions wp
    ON wp.workspace_id = p_workspace_id
    AND wp.role = dp.role
    AND wp.permission_key = dp.permission_key
  WHERE dp.role = v_role;
END;
$$;


ALTER FUNCTION "public"."get_my_permissions"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_polizas_por_vencer"("dias_max" integer DEFAULT 30) RETURNS TABLE("poliza_id" "uuid", "numero_poliza" "text", "aseguradora" "text", "ramo" "text", "prima_neta" numeric, "fecha_fin" "date", "dias_restantes" integer, "cliente_nombre" "text", "workspace_id" "uuid", "workspace_name" "text", "admin_email" "text", "admin_nombre" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id              AS poliza_id,
    p.numero_poliza,
    p.aseguradora,
    p.ramo,
    p.prima_neta,
    p.fecha_fin,
    (p.fecha_fin - CURRENT_DATE)::int AS dias_restantes,
    c.nombre           AS cliente_nombre,
    w.id               AS workspace_id,
    w.name             AS workspace_name,
    au.email           AS admin_email,
    COALESCE(au.raw_user_meta_data->>'nombre', split_part(au.email,'@',1)) AS admin_nombre
  FROM polizas p
  JOIN clientes c    ON c.id = p.client_id
  JOIN workspaces w  ON w.id = p.workspace_id
  JOIN auth.users au ON au.id = w.owner_id
  WHERE
    p.eliminada = false
    AND p.estado = 'activa'
    AND p.fecha_fin IS NOT NULL
    AND p.fecha_fin >= CURRENT_DATE
    AND p.fecha_fin <= CURRENT_DATE + dias_max
  ORDER BY p.fecha_fin ASC;
$$;


ALTER FUNCTION "public"."get_polizas_por_vencer"("dias_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_workspace_role"("ws_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_workspace_role"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_workspaces"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'role', wm.role,
    'workspace', jsonb_build_object(
      'id',              w.id,
      'name',            w.name,
      'owner_id',        w.owner_id,
      'slug',            w.slug,
      'setup_completed', w.setup_completed,
      'created_at',      w.created_at
    )
  ) ORDER BY w.created_at)
  INTO v_result
  FROM workspace_members wm
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = v_user_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_workspaces"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_invitations"("p_workspace_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = v_user_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id',         wi.id,
    'email',      wi.email,
    'role',       wi.role,
    'token',      wi.token,
    'expires_at', wi.expires_at,
    'created_at', wi.created_at
  ) ORDER BY wi.created_at DESC)
  INTO v_result
  FROM workspace_invitations wi
  WHERE wi.workspace_id = p_workspace_id
    AND wi.accepted_at IS NULL
    AND wi.expires_at > now();

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_workspace_invitations"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_members"("p_workspace_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  jsonb;
BEGIN
  -- Verificar que el solicitante es miembro del workspace
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = v_user_id
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id',        wm.id,
    'user_id',   wm.user_id,
    'role',      wm.role,
    'joined_at', wm.joined_at,
    'email',     u.email,
    'nombre',    COALESCE(u.raw_user_meta_data->>'nombre', split_part(u.email,'@',1))
  ) ORDER BY wm.joined_at)
  INTO v_result
  FROM workspace_members wm
  JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_workspace_members"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_workspace_permissions"("p_workspace_id" "uuid") RETURNS TABLE("role" "text", "permission_key" "text", "enabled" boolean, "label" "text", "category" "text", "description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
BEGIN
  SELECT wm.role INTO v_role
  FROM workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = v_user_id;

  IF v_role IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id AND w.owner_id = v_user_id) THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    dp.role,
    dp.permission_key,
    COALESCE(wp.enabled, dp.enabled) AS enabled,
    dp.label,
    dp.category,
    dp.description
  FROM default_permissions dp
  LEFT JOIN workspace_permissions wp
    ON wp.workspace_id = p_workspace_id
    AND wp.role = dp.role
    AND wp.permission_key = dp.permission_key
  ORDER BY dp.role, dp.category, dp.permission_key;
END;
$$;


ALTER FUNCTION "public"."get_workspace_permissions"("p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  new_workspace_id uuid;
  default_name     text;
BEGIN
  default_name := coalesce(
    new.raw_user_meta_data->>'nombre',
    split_part(new.email, '@', 1)
  ) || ' Workspace';

  INSERT INTO workspaces (name, owner_id, setup_completed)
  VALUES (default_name, new.id, false)
  RETURNING id INTO new_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, new.id, 'admin');

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("ws_id" "uuid", "perm_key" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_role text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  -- Owner del workspace = admin implícito
  IF EXISTS (SELECT 1 FROM workspaces w WHERE w.id = ws_id AND w.owner_id = v_uid) THEN
    RETURN true;
  END IF;

  SELECT wm.role INTO v_role
  FROM workspace_members wm
  WHERE wm.workspace_id = ws_id AND wm.user_id = v_uid
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;          -- no es miembro
  END IF;

  IF v_role = 'admin' THEN
    RETURN true;           -- admin nunca se restringe
  END IF;

  -- Supervisor / agente: override del workspace o default del rol.
  -- Si la clave no existe en default_permissions para ese rol → false
  -- (fail-closed: un permiso no definido no se concede).
  RETURN COALESCE(
    (
      SELECT COALESCE(wp.enabled, dp.enabled)
      FROM default_permissions dp
      LEFT JOIN workspace_permissions wp
        ON wp.workspace_id   = ws_id
       AND wp.role           = dp.role
       AND wp.permission_key = dp.permission_key
      WHERE dp.role = v_role AND dp.permission_key = perm_key
    ),
    false
  );
END;
$$;


ALTER FUNCTION "public"."has_permission"("ws_id" "uuid", "perm_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_admin"("ws_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_workspace_admin"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_member"("ws_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_workspace_member"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_workspace_supervisor"("ws_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role IN ('admin','supervisor')
  );
$$;


ALTER FUNCTION "public"."is_workspace_supervisor"("ws_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_workspace_member"("p_workspace_id" "uuid", "p_member_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'admin')
  THEN RAISE EXCEPTION 'Solo administradores pueden remover miembros'; END IF;

  DELETE FROM workspace_members
  WHERE id = p_member_id AND workspace_id = p_workspace_id
    AND user_id != auth.uid(); -- No puede removerse a sí mismo
END; $$;


ALTER FUNCTION "public"."remove_workspace_member"("p_workspace_id" "uuid", "p_member_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_role_permissions"("p_workspace_id" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_role text;
  v_is_owner boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id AND w.owner_id = v_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    SELECT wm.role INTO v_caller_role
    FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_user_id;

    IF v_caller_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Solo los administradores pueden resetear permisos';
    END IF;
  END IF;

  DELETE FROM workspace_permissions
  WHERE workspace_id = p_workspace_id AND role = p_role;
END;
$$;


ALTER FUNCTION "public"."reset_role_permissions"("p_workspace_id" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revertir_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_revertidas int := 0;
BEGIN
  -- Verificar pertenencia
  IF NOT EXISTS (
    SELECT 1 FROM colillas_importacion
    WHERE id = p_colilla_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Colilla no encontrada';
  END IF;

  -- Restaurar comision_agencia al valor anterior usando el historial
  -- Solo toca pólizas que tengan historial de esta colilla
  UPDATE polizas p SET
    comision_agencia  = h.valor_anterior,
    -- Solo quitar comision_recibida si NO hay otra colilla confirmada vinculada
    comision_recibida = EXISTS (
      SELECT 1
      FROM colilla_lineas cl2
      JOIN colillas_importacion ci2 ON ci2.id = cl2.colilla_id
      WHERE cl2.poliza_id = p.id
        AND ci2.estado    = 'confirmada'
        AND ci2.id        <> p_colilla_id
    )
  FROM historial_comisiones_poliza h
  WHERE h.colilla_id   = p_colilla_id
    AND h.poliza_id    = p.id;

  GET DIAGNOSTICS v_revertidas = ROW_COUNT;

  -- Eliminar la colilla (cascadea a colilla_lineas e historial)
  DELETE FROM colillas_importacion
  WHERE id = p_colilla_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'revertidas', v_revertidas
  );
END;
$$;


ALTER FUNCTION "public"."revertir_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."setup_user_workspace"("p_name" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ws_id   uuid;
BEGIN
  -- Buscar workspace propio (owner), NO membresías de otros workspaces
  SELECT id INTO v_ws_id
  FROM workspaces
  WHERE owner_id = v_user_id
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    -- Crear workspace nuevo solo si no existe uno propio
    INSERT INTO workspaces (name, owner_id, setup_completed)
    VALUES (p_name, v_user_id, true)
    RETURNING id INTO v_ws_id;

    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_ws_id, v_user_id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  ELSE
    -- Solo actualizar nombre y marcar como configurado
    UPDATE workspaces
    SET name = p_name, setup_completed = true, updated_at = now()
    WHERE id = v_ws_id;
  END IF;

  RETURN jsonb_build_object('workspace_id', v_ws_id);
END;
$$;


ALTER FUNCTION "public"."setup_user_workspace"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_campanas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_campanas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_poliza_afiliados_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_poliza_afiliados_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_poliza_planes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."update_poliza_planes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_workspace_permission"("p_workspace_id" "uuid", "p_role" "text", "p_permission_key" "text", "p_enabled" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_role text;
  v_is_owner boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id AND w.owner_id = v_user_id
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    SELECT wm.role INTO v_caller_role
    FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_user_id;

    IF v_caller_role IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Solo los administradores pueden modificar permisos';
    END IF;
  END IF;

  INSERT INTO workspace_permissions (workspace_id, role, permission_key, enabled, updated_at)
  VALUES (p_workspace_id, p_role, p_permission_key, p_enabled, now())
  ON CONFLICT (workspace_id, role, permission_key)
  DO UPDATE SET enabled = p_enabled, updated_at = now();
END;
$$;


ALTER FUNCTION "public"."update_workspace_permission"("p_workspace_id" "uuid", "p_role" "text", "p_permission_key" "text", "p_enabled" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_workspace"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
    AND w.setup_completed = true
  );
END;
$$;


ALTER FUNCTION "public"."user_has_workspace"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."actividades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "descripcion" "text" NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "actividades_tipo_check" CHECK (("tipo" = ANY (ARRAY['llamada'::"text", 'email'::"text", 'reunion'::"text", 'nota'::"text"])))
);


ALTER TABLE "public"."actividades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."afiliado_cambios_plan" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "afiliado_id" "uuid" NOT NULL,
    "plan_anterior_id" "uuid",
    "plan_nuevo_id" "uuid",
    "prima_anterior" numeric(14,2),
    "prima_nueva" numeric(14,2),
    "fecha_cambio" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."afiliado_cambios_plan" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agenda_eventos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "fecha_inicio" timestamp with time zone NOT NULL,
    "fecha_fin" timestamp with time zone NOT NULL,
    "todo_el_dia" boolean DEFAULT false NOT NULL,
    "color" "text" DEFAULT '#10b981'::"text" NOT NULL,
    "tipo" "text" DEFAULT 'evento'::"text" NOT NULL,
    "notas" "text",
    "client_id" "uuid",
    "poliza_id" "uuid",
    "prospecto_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "agenda_eventos_tipo_check" CHECK (("tipo" = ANY (ARRAY['evento'::"text", 'reunion'::"text", 'llamada'::"text", 'recordatorio'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."agenda_eventos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amparos_siniestro" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "siniestro_id" "uuid" NOT NULL,
    "nombre_reclamante" "text" NOT NULL,
    "amparo" "text" NOT NULL,
    "valor" numeric(15,2) DEFAULT 0 NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."amparos_siniestro" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."archivos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_archivo" "text",
    "entidad_tipo" "text",
    "entidad_id" "uuid",
    "url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    "nombre_original" "text",
    "tipo_mime" "text",
    "tamano" integer,
    "descripcion" "text",
    "client_id" "uuid",
    "poliza_id" "uuid",
    "prospecto_id" "uuid"
);


ALTER TABLE "public"."archivos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campanas_renovacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "fecha_inicio_periodo" "date" NOT NULL,
    "fecha_fin_periodo" "date" NOT NULL,
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "aseguradora" "text",
    "ramo" "text",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "campanas_renovacion_estado_check" CHECK (("estado" = ANY (ARRAY['activa'::"text", 'cerrada'::"text"])))
);


ALTER TABLE "public"."campanas_renovacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text",
    "telefono" "text",
    "cedula" "text",
    "ciudad" "text",
    "departamento" "text",
    "etapa" "text" DEFAULT 'nuevo'::"text" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_cliente" "text" DEFAULT 'persona_natural'::"text" NOT NULL,
    "razon_social" "text",
    "sobrenombre" "text",
    "nit" "text",
    "fecha_constitucion" "date",
    "fecha_nacimiento" "date",
    "genero" "text",
    "fecha_expedicion_cedula" "date",
    "estado_civil" "text",
    "tiene_vehiculo" boolean DEFAULT false NOT NULL,
    "tiene_hijos" boolean DEFAULT false NOT NULL,
    "num_hijos" integer,
    "ocupacion" "text",
    "empresa_trabajo" "text",
    "ingresos_aprox" numeric(14,2),
    "categoria" "text",
    "autoriza_datos" boolean DEFAULT false NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    "assigned_to" "uuid",
    "tipo_documento" "text",
    CONSTRAINT "clientes_etapa_check" CHECK (("etapa" = ANY (ARRAY['nuevo'::"text", 'contactado'::"text", 'cotizacion'::"text", 'cerrado'::"text"]))),
    CONSTRAINT "clientes_tipo_cliente_check" CHECK (("tipo_cliente" = ANY (ARRAY['persona_natural'::"text", 'empresa'::"text", 'consorcio'::"text", 'grupo_familiar'::"text"])))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes_historial" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "campo" "text",
    "label_campo" "text",
    "valor_anterior" "text",
    "valor_nuevo" "text",
    "usuario_id" "uuid",
    "usuario_nombre" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "clientes_historial_tipo_check" CHECK (("tipo" = ANY (ARRAY['creacion'::"text", 'actualizacion'::"text"])))
);


ALTER TABLE "public"."clientes_historial" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cobros_num_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cobros_num_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cobros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poliza_id" "uuid",
    "cuota" integer,
    "anexo" "text",
    "valor_neto" numeric(15,2) DEFAULT 0,
    "prima_neta" numeric(15,2) DEFAULT 0,
    "prima_total" numeric(15,2) DEFAULT 0,
    "valor_a_pagar" numeric(15,2) DEFAULT 0,
    "saldo_pendiente" numeric(15,2) DEFAULT 0,
    "pagado_oficina" numeric(15,2) DEFAULT 0,
    "pagado_aseguradora" numeric(15,2) DEFAULT 0,
    "dias_vencidos" integer DEFAULT 0,
    "fecha_pago" "date",
    "compromiso_pago" "date",
    "vendedor" "text",
    "comision_vendedor" numeric(15,2) DEFAULT 0,
    "estado" "text" DEFAULT 'por_cobrar'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo" "text" DEFAULT 'por_cobrar'::"text" NOT NULL,
    "aseguradora" "text",
    "ramo" "text",
    "numero_poliza" "text",
    "numero_cobro" integer DEFAULT "nextval"('"public"."cobros_num_seq"'::"regclass"),
    "fecha_emision" "date",
    "porcentaje_comision" numeric(5,2),
    "vendedor_id" "uuid",
    "workspace_id" "uuid",
    "created_by" "uuid",
    "periodo" "text",
    CONSTRAINT "cobros_estado_check" CHECK (("estado" = ANY (ARRAY['por_cobrar'::"text", 'por_pagar'::"text", 'comision_por_cobrar'::"text", 'comision_recibida'::"text"]))),
    CONSTRAINT "cobros_tipo_check" CHECK (("tipo" = ANY (ARRAY['por_cobrar'::"text", 'por_pagar'::"text", 'comision_por_cobrar'::"text", 'comision_recibida'::"text"])))
);


ALTER TABLE "public"."cobros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."colilla_lineas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "colilla_id" "uuid" NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "poliza_id" "uuid",
    "numero_poliza_raw" "text" NOT NULL,
    "nombre_tomador" "text",
    "valor_prima" numeric(15,2),
    "valor_comision" numeric(15,2),
    "porcentaje_comision" numeric(5,2),
    "fecha_pago" "date",
    "fecha_recaudo" "date",
    "retefuente" numeric(15,2),
    "estado_conciliacion" "text" DEFAULT 'no_encontrada'::"text" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "colilla_lineas_estado_conciliacion_check" CHECK (("estado_conciliacion" = ANY (ARRAY['conciliada'::"text", 'no_encontrada'::"text", 'corregida_manual'::"text"])))
);


ALTER TABLE "public"."colilla_lineas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."colillas_importacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "aseguradora" "text" NOT NULL,
    "periodo" "text" NOT NULL,
    "archivo_nombre" "text" NOT NULL,
    "total_lineas" integer DEFAULT 0 NOT NULL,
    "conciliadas" integer DEFAULT 0 NOT NULL,
    "no_encontradas" integer DEFAULT 0 NOT NULL,
    "corregidas_manual" integer DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "creado_por" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    CONSTRAINT "colillas_importacion_estado_check" CHECK (("estado" = ANY (ARRAY['borrador'::"text", 'confirmada'::"text"])))
);


ALTER TABLE "public"."colillas_importacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "valor" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."configuracion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contactos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo_documento" "text",
    "numero_documento" "text",
    "cargo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."contactos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboards_custom" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "config_json" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."dashboards_custom" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."default_permissions" (
    "role" "text" NOT NULL,
    "permission_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "label" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    CONSTRAINT "default_permissions_role_check" CHECK (("role" = ANY (ARRAY['agente'::"text", 'supervisor'::"text"])))
);


ALTER TABLE "public"."default_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diligencia_tareas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "diligencia_id" "uuid" NOT NULL,
    "contacto" "text",
    "telefono" "text",
    "direccion" "text" NOT NULL,
    "hora" time without time zone NOT NULL,
    "descripcion" "text" NOT NULL,
    "completada" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."diligencia_tareas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."diligencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_diligencia" integer NOT NULL,
    "mensajero" "text" NOT NULL,
    "fecha" "date" NOT NULL,
    "asunto" "text" NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "sede" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "diligencias_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'terminada'::"text"])))
);


ALTER TABLE "public"."diligencias" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."diligencias_num_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."diligencias_num_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facturas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_factura" integer,
    "fecha_expedicion" "date" NOT NULL,
    "fecha_corte" "date" NOT NULL,
    "aseguradora" "text",
    "concepto" "text" DEFAULT 'Comisión'::"text",
    "comision_gravada" numeric(15,2) DEFAULT 0,
    "comision_no_gravada" numeric(15,2) DEFAULT 0,
    "pct_iva" numeric(8,4) DEFAULT 19.0000,
    "iva" numeric(15,2) DEFAULT 0,
    "pct_ret_iva" numeric(8,4) DEFAULT 15.0000,
    "ret_iva" numeric(15,2) DEFAULT 0,
    "pct_ret_ica" numeric(8,4) DEFAULT 0.0000,
    "ret_ica" numeric(15,2) DEFAULT 0,
    "pct_ret_fuente" numeric(8,4) DEFAULT 11.0000,
    "ret_fuente" numeric(15,2) DEFAULT 0,
    "otros" numeric(15,2) DEFAULT 0,
    "gran_total" numeric(15,2) DEFAULT 0,
    "observaciones" "text",
    "estado" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "sede" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "es_borrador" boolean DEFAULT false,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "facturas_estado_check" CHECK (("estado" = ANY (ARRAY['por_cobrar'::"text", 'recibida'::"text", 'anulada'::"text", 'borrador'::"text", 'nota_credito'::"text", 'nota_debito'::"text"])))
);


ALTER TABLE "public"."facturas" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."facturas_num_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."facturas_num_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gestiones_renovacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poliza_id" "uuid" NOT NULL,
    "estado" "text" NOT NULL,
    "notas" "text",
    "fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "asignado_a" "text",
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "gestiones_renovacion_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'contactado'::"text", 'en_negociacion'::"text", 'renovado'::"text", 'no_renueva'::"text"])))
);


ALTER TABLE "public"."gestiones_renovacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historial_comisiones_poliza" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "poliza_id" "uuid" NOT NULL,
    "colilla_id" "uuid" NOT NULL,
    "colilla_linea_id" "uuid",
    "periodo" "text" NOT NULL,
    "aseguradora" "text" NOT NULL,
    "valor_anterior" numeric(15,2),
    "valor_nuevo" numeric(15,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."historial_comisiones_poliza" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."liquidaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "vendedor_id" "uuid" NOT NULL,
    "periodo" "text" NOT NULL,
    "total_primas" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_comision" numeric(14,2) DEFAULT 0 NOT NULL,
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "fecha_pago" "date",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "liquidaciones_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'pagado'::"text", 'anulado'::"text"])))
);


ALTER TABLE "public"."liquidaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."metas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "text" DEFAULT 'nuevas'::"text" NOT NULL,
    "meta_prima_total" numeric(15,2) DEFAULT 0,
    "fecha_inicio" "date" NOT NULL,
    "fecha_fin" "date" NOT NULL,
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "metas_tipo_check" CHECK (("tipo" = ANY (ARRAY['nuevas'::"text", 'renovadas'::"text"])))
);


ALTER TABLE "public"."metas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones_renovacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "poliza_id" "uuid" NOT NULL,
    "dias_alerta" integer NOT NULL,
    "fecha_envio" "date" DEFAULT CURRENT_DATE NOT NULL,
    "enviada_at" timestamp with time zone DEFAULT "now"(),
    "email_destino" "text" NOT NULL
);


ALTER TABLE "public"."notificaciones_renovacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poliza_afiliados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "poliza_id" "uuid" NOT NULL,
    "cliente_id" "uuid",
    "nombre_completo" "text" NOT NULL,
    "numero_documento" "text" NOT NULL,
    "fecha_nacimiento" "date",
    "fecha_inicio" "date" NOT NULL,
    "fecha_retiro" "date",
    "numero_poliza_individual" "text",
    "parentesco" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "plan_id" "uuid",
    "prima_individual" numeric(14,2),
    "tipo_documento" "text" DEFAULT 'CC'::"text" NOT NULL
);


ALTER TABLE "public"."poliza_afiliados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poliza_anexos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poliza_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "numero_anexo" "text",
    "estado" "text" DEFAULT 'activo'::"text" NOT NULL,
    "documento" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "poliza_anexos_estado_check" CHECK (("estado" = ANY (ARRAY['activo'::"text", 'inactivo'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."poliza_anexos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poliza_planes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "poliza_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "valor_cobertura" numeric(14,2),
    "prima_plan" numeric(14,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."poliza_planes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."poliza_vinculados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poliza_id" "uuid" NOT NULL,
    "numero_anexo_pago" "text",
    "numero_afiliado_objeto" "text",
    "fecha_inicio" "date",
    "beneficiario" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."poliza_vinculados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."polizas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "numero_poliza" "text",
    "aseguradora" "text" NOT NULL,
    "ramo" "text" NOT NULL,
    "prima" numeric(12,2),
    "fecha_inicio" "date",
    "fecha_fin" "date",
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tipo_poliza" "text",
    "riesgo" "text",
    "eliminada" boolean DEFAULT false NOT NULL,
    "fecha_eliminacion" timestamp with time zone,
    "nombre_tomador" "text",
    "comision" numeric(14,2) DEFAULT 0,
    "recaudado_oficina" numeric(14,2) DEFAULT 0,
    "recaudado_aseguradora" numeric(14,2) DEFAULT 0,
    "vendedor_id" "uuid",
    "tipo_modalidad" "text",
    "fecha_expedicion" "date",
    "fecha_recepcion" "date",
    "asegurado_nombre" "text",
    "asegurado_documento" "text",
    "beneficiario_nombre" "text",
    "beneficiario_documento" "text",
    "beneficiario_oneroso" boolean DEFAULT false NOT NULL,
    "beneficiario_en_remision" boolean DEFAULT false NOT NULL,
    "prima_neta" numeric(14,2),
    "porcentaje_iva" numeric(5,2) DEFAULT 19,
    "iva" numeric(14,2),
    "gastos" numeric(14,2) DEFAULT 0,
    "porcentaje_comision_agencia" numeric(7,2),
    "comision_agencia" numeric(14,2),
    "total_prima" numeric(14,2),
    "porcentaje_comision_vendedor" numeric(7,2),
    "retencion_vendedor" numeric(14,2) DEFAULT 10,
    "comision_vendedor" numeric(14,2),
    "periodicidad_pago" "text",
    "forma_pago" "text",
    "medio_pago" "text",
    "banco_pago" "text",
    "valor_asegurado" numeric(14,2),
    "workspace_id" "uuid",
    "created_by" "uuid",
    "es_renovacion" boolean DEFAULT false NOT NULL,
    "mes_emision" "text",
    "cancelada_anterior" boolean DEFAULT false NOT NULL,
    "aseguradora_anterior" "text",
    "endoso_enviado" boolean DEFAULT false NOT NULL,
    "prima_periodica" numeric(14,2),
    "retencion_agencia" numeric(14,2),
    "comision_periodica" numeric(14,2),
    "intermediario" "text",
    "pct_comision_int" numeric(7,2),
    "comision_intermediario" numeric(14,2),
    "referido" "text",
    "pct_comision_referido" numeric(7,2),
    "retencion_referido" numeric(14,2),
    "comision_referido" numeric(14,2),
    "comision_abc_periodica" numeric(14,2),
    "pct_comision_abc" numeric(7,2),
    "retencion_abc" numeric(14,2),
    "comision_abc_anual" numeric(14,2),
    "comision_abc_recibida" numeric(14,2),
    "fecha_pago_abc" "date",
    "comision_asesor_pagada" numeric(14,2),
    "fecha_pago_asesor" "date",
    "pct_comision_negocio" numeric(7,2),
    "comision_negocio_anual" numeric,
    "es_colectiva" boolean DEFAULT false,
    "prima_por_afiliado" numeric(14,2),
    "prima_mensual" numeric(14,2) DEFAULT NULL::numeric,
    "financiera" "text",
    "num_cuotas" integer,
    "comision_recibida" boolean DEFAULT false,
    "asesor_pago_estado" "text",
    CONSTRAINT "polizas_estado_check" CHECK (("estado" = ANY (ARRAY['activa'::"text", 'vencida'::"text", 'cancelada'::"text", 'pendiente'::"text"]))),
    CONSTRAINT "polizas_tipo_modalidad_check" CHECK (("tipo_modalidad" = ANY (ARRAY['individual'::"text", 'colectiva'::"text", 'agrupadora'::"text"])))
);


ALTER TABLE "public"."polizas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospecto_actividades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "prospecto_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "descripcion" "text" NOT NULL,
    "fecha" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "prospecto_actividades_tipo_check" CHECK (("tipo" = ANY (ARRAY['llamada'::"text", 'email'::"text", 'reunion'::"text", 'nota'::"text", 'cotizacion'::"text"])))
);


ALTER TABLE "public"."prospecto_actividades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospectos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_negocio" "text",
    "nombre_negocio" "text" NOT NULL,
    "client_id" "uuid",
    "vendedor" "text",
    "ramo" "text",
    "riesgo" "text",
    "monto" numeric(15,2) DEFAULT 0,
    "estado_pipeline" "text" DEFAULT 'no_gestionado'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "prospectos_estado_pipeline_check" CHECK (("estado_pipeline" = ANY (ARRAY['no_gestionado'::"text", 'contactado'::"text", 'cotizacion_enviada'::"text", 'pendiente_por_cerrar'::"text", 'vendido'::"text", 'perdido'::"text"])))
);


ALTER TABLE "public"."prospectos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recibos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cobro_id" "uuid",
    "tipo" "text" DEFAULT 'activo'::"text" NOT NULL,
    "valor_recaudado" numeric(15,2) DEFAULT 0,
    "fecha" "date",
    "forma_pago" "text",
    "usuario" "text",
    "observacion" "text",
    "anulado_por" "text",
    "fecha_anulacion" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "numero_certificado" "text",
    "poliza_id" "uuid",
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "recibos_tipo_check" CHECK (("tipo" = ANY (ARRAY['anticipo'::"text", 'activo'::"text", 'pago_directo'::"text", 'anulado'::"text"])))
);


ALTER TABLE "public"."recibos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."remisiones_num_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."remisiones_num_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."remisiones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "poliza_id" "uuid",
    "aseguradora" "text" NOT NULL,
    "ramo" "text" NOT NULL,
    "descripcion" "text",
    "estado" "text" DEFAULT 'borrador'::"text" NOT NULL,
    "fecha" "date",
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "numero_remision" integer DEFAULT "nextval"('"public"."remisiones_num_seq"'::"regclass"),
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "remisiones_estado_check" CHECK (("estado" = ANY (ARRAY['borrador'::"text", 'enviada'::"text", 'recibida'::"text", 'aprobada'::"text", 'rechazada'::"text", 'anulada'::"text"])))
);


ALTER TABLE "public"."remisiones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."siniestro_amparos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "siniestro_id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "valor" numeric(14,2),
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "siniestro_amparos_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'aprobado'::"text", 'rechazado'::"text"])))
);


ALTER TABLE "public"."siniestro_amparos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."siniestros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "poliza_id" "uuid",
    "numero_siniestro" "text",
    "numero_siniestro_compania" "text",
    "tipo_siniestro" "text" NOT NULL,
    "fecha_siniestro" "date",
    "fecha_aviso" "date",
    "fecha_notificacion" "date",
    "responsable" "text" NOT NULL,
    "proveedor_asignado" "text",
    "descripcion" "text",
    "valor_indemnizacion" numeric(15,2) DEFAULT 0,
    "deducible" numeric(15,2) DEFAULT 0,
    "monto_reclamo" numeric(15,2) DEFAULT 0,
    "coaseguros" numeric(15,2) DEFAULT 0,
    "estado" "text" DEFAULT 'en_proceso'::"text" NOT NULL,
    "finalizado" boolean DEFAULT false NOT NULL,
    "fecha_finalizacion" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    "afiliado_id" "uuid",
    CONSTRAINT "siniestros_estado_check" CHECK (("estado" = ANY (ARRAY['en_proceso'::"text", 'objetado'::"text", 'pagado'::"text", 'solicitado'::"text"])))
);


ALTER TABLE "public"."siniestros" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."siniestros_num_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."siniestros_num_seq" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."solicitudes_num_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."solicitudes_num_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitudes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_solicitud" "text" DEFAULT "nextval"('"public"."solicitudes_num_seq"'::"regclass"),
    "client_id" "uuid",
    "tipo" "text" DEFAULT 'cotizacion'::"text" NOT NULL,
    "estado" "text" DEFAULT 'activa'::"text" NOT NULL,
    "observaciones" "text",
    "asignado_a" "text",
    "ramo" "text",
    "riesgo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "solicitudes_estado_check" CHECK (("estado" = ANY (ARRAY['nueva'::"text", 'en_proceso'::"text", 'resuelta'::"text", 'cancelada'::"text", 'inactiva'::"text"]))),
    CONSTRAINT "solicitudes_tipo_check" CHECK (("tipo" = ANY (ARRAY['cotizacion'::"text", 'expedicion'::"text", 'endoso'::"text", 'renovacion'::"text", 'cancelacion'::"text", 'certificado'::"text", 'siniestro'::"text", 'inclusion'::"text", 'exclusion'::"text", 'otro'::"text"])))
);


ALTER TABLE "public"."solicitudes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tareas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "tipo_tarea" "text",
    "client_id" "uuid",
    "poliza_id" "uuid",
    "asignado_a" "text",
    "fecha_vencimiento" "date",
    "completada" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "descripcion" "text",
    "prioridad" "text" DEFAULT 'normal'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid",
    CONSTRAINT "tareas_prioridad_check" CHECK (("prioridad" = ANY (ARRAY['normal'::"text", 'alta'::"text", 'urgente'::"text"])))
);


ALTER TABLE "public"."tareas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text",
    "telefono" "text",
    "cedula" "text",
    "porcentaje_comision" numeric(5,2) DEFAULT 0 NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "banco" "text",
    "numero_cuenta" "text",
    "tipo_cuenta" "text",
    "comisiones_por_anio" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "workspace_id" "uuid",
    "created_by" "uuid"
);


ALTER TABLE "public"."vendedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "provider" "text" NOT NULL,
    "credentials" "jsonb",
    "is_active" boolean DEFAULT false,
    "connected_by" "uuid",
    "connected_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workspace_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "token" "text" DEFAULT ("gen_random_uuid"())::"text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "accepted_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workspace_invitations_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'agente'::"text"])))
);


ALTER TABLE "public"."workspace_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid",
    "user_id" "uuid",
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workspace_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'supervisor'::"text", 'agente'::"text"])))
);


ALTER TABLE "public"."workspace_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "workspace_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "permission_key" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "workspace_permissions_role_check" CHECK (("role" = ANY (ARRAY['agente'::"text", 'supervisor'::"text"])))
);


ALTER TABLE "public"."workspace_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "owner_id" "uuid",
    "slug" "text",
    "setup_completed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."workspaces" OWNER TO "postgres";


ALTER TABLE ONLY "public"."actividades"
    ADD CONSTRAINT "actividades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."afiliado_cambios_plan"
    ADD CONSTRAINT "afiliado_cambios_plan_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_eventos"
    ADD CONSTRAINT "agenda_eventos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amparos_siniestro"
    ADD CONSTRAINT "amparos_siniestro_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campanas_renovacion"
    ADD CONSTRAINT "campanas_renovacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes_historial"
    ADD CONSTRAINT "clientes_historial_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colilla_lineas"
    ADD CONSTRAINT "colilla_lineas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."colillas_importacion"
    ADD CONSTRAINT "colillas_importacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contactos"
    ADD CONSTRAINT "contactos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboards_custom"
    ADD CONSTRAINT "dashboards_custom_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."default_permissions"
    ADD CONSTRAINT "default_permissions_pkey" PRIMARY KEY ("role", "permission_key");



ALTER TABLE ONLY "public"."diligencia_tareas"
    ADD CONSTRAINT "diligencia_tareas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."diligencias"
    ADD CONSTRAINT "diligencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facturas"
    ADD CONSTRAINT "facturas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gestiones_renovacion"
    ADD CONSTRAINT "gestiones_renovacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_comisiones_poliza"
    ADD CONSTRAINT "historial_comisiones_poliza_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones_renovacion"
    ADD CONSTRAINT "notificaciones_renovacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones_renovacion"
    ADD CONSTRAINT "notificaciones_renovacion_poliza_id_dias_alerta_fecha_envio_key" UNIQUE ("poliza_id", "dias_alerta", "fecha_envio");



ALTER TABLE ONLY "public"."poliza_afiliados"
    ADD CONSTRAINT "poliza_afiliados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poliza_anexos"
    ADD CONSTRAINT "poliza_anexos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poliza_planes"
    ADD CONSTRAINT "poliza_planes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."poliza_vinculados"
    ADD CONSTRAINT "poliza_vinculados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."polizas"
    ADD CONSTRAINT "polizas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prospecto_actividades"
    ADD CONSTRAINT "prospecto_actividades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prospectos"
    ADD CONSTRAINT "prospectos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recibos"
    ADD CONSTRAINT "recibos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."remisiones"
    ADD CONSTRAINT "remisiones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."siniestro_amparos"
    ADD CONSTRAINT "siniestro_amparos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."siniestros"
    ADD CONSTRAINT "siniestros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitudes"
    ADD CONSTRAINT "solicitudes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tareas"
    ADD CONSTRAINT "tareas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_integrations"
    ADD CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_user_id_key" UNIQUE ("workspace_id", "user_id");



ALTER TABLE ONLY "public"."workspace_permissions"
    ADD CONSTRAINT "workspace_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspace_permissions"
    ADD CONSTRAINT "workspace_permissions_workspace_id_role_permission_key_key" UNIQUE ("workspace_id", "role", "permission_key");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_slug_key" UNIQUE ("slug");



CREATE INDEX "idx_actividades_client_id" ON "public"."actividades" USING "btree" ("client_id");



CREATE INDEX "idx_actividades_fecha" ON "public"."actividades" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_actividades_workspace" ON "public"."actividades" USING "btree" ("workspace_id");



CREATE INDEX "idx_agenda_eventos_workspace" ON "public"."agenda_eventos" USING "btree" ("workspace_id");



CREATE INDEX "idx_amparos_siniestro_id" ON "public"."amparos_siniestro" USING "btree" ("siniestro_id");



CREATE INDEX "idx_archivos_client" ON "public"."archivos" USING "btree" ("client_id");



CREATE INDEX "idx_archivos_entidad" ON "public"."archivos" USING "btree" ("entidad_tipo", "entidad_id");



CREATE INDEX "idx_archivos_poliza" ON "public"."archivos" USING "btree" ("poliza_id");



CREATE INDEX "idx_archivos_workspace" ON "public"."archivos" USING "btree" ("workspace_id");



CREATE INDEX "idx_cambios_plan_afiliado" ON "public"."afiliado_cambios_plan" USING "btree" ("afiliado_id");



CREATE INDEX "idx_campanas_renovacion_workspace" ON "public"."campanas_renovacion" USING "btree" ("workspace_id");



CREATE INDEX "idx_clientes_etapa" ON "public"."clientes" USING "btree" ("etapa");



CREATE INDEX "idx_clientes_historial_cliente" ON "public"."clientes_historial" USING "btree" ("cliente_id");



CREATE INDEX "idx_clientes_historial_fecha" ON "public"."clientes_historial" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_clientes_tipo_documento" ON "public"."clientes" USING "btree" ("tipo_documento");



CREATE INDEX "idx_clientes_workspace" ON "public"."clientes" USING "btree" ("workspace_id");



CREATE INDEX "idx_cobros_estado" ON "public"."cobros" USING "btree" ("estado");



CREATE INDEX "idx_cobros_fecha_pago" ON "public"."cobros" USING "btree" ("fecha_pago");



CREATE INDEX "idx_cobros_poliza_id" ON "public"."cobros" USING "btree" ("poliza_id");



CREATE INDEX "idx_cobros_workspace" ON "public"."cobros" USING "btree" ("workspace_id");



CREATE INDEX "idx_colillas_estado" ON "public"."colillas_importacion" USING "btree" ("workspace_id", "estado");



CREATE INDEX "idx_colillas_workspace" ON "public"."colillas_importacion" USING "btree" ("workspace_id");



CREATE INDEX "idx_contactos_client_id" ON "public"."contactos" USING "btree" ("client_id");



CREATE INDEX "idx_contactos_workspace" ON "public"."contactos" USING "btree" ("workspace_id");



CREATE INDEX "idx_diligencia_tareas_diligencia_id" ON "public"."diligencia_tareas" USING "btree" ("diligencia_id");



CREATE INDEX "idx_diligencias_estado" ON "public"."diligencias" USING "btree" ("estado");



CREATE INDEX "idx_diligencias_fecha" ON "public"."diligencias" USING "btree" ("fecha");



CREATE INDEX "idx_diligencias_workspace" ON "public"."diligencias" USING "btree" ("workspace_id");



CREATE INDEX "idx_facturas_estado" ON "public"."facturas" USING "btree" ("estado");



CREATE INDEX "idx_facturas_fecha_expedicion" ON "public"."facturas" USING "btree" ("fecha_expedicion");



CREATE INDEX "idx_facturas_workspace" ON "public"."facturas" USING "btree" ("workspace_id");



CREATE INDEX "idx_historial_colilla" ON "public"."historial_comisiones_poliza" USING "btree" ("colilla_id");



CREATE INDEX "idx_historial_poliza" ON "public"."historial_comisiones_poliza" USING "btree" ("poliza_id");



CREATE INDEX "idx_historial_workspace" ON "public"."historial_comisiones_poliza" USING "btree" ("workspace_id");



CREATE INDEX "idx_lineas_colilla" ON "public"."colilla_lineas" USING "btree" ("colilla_id");



CREATE INDEX "idx_lineas_poliza" ON "public"."colilla_lineas" USING "btree" ("poliza_id");



CREATE INDEX "idx_lineas_workspace" ON "public"."colilla_lineas" USING "btree" ("workspace_id");



CREATE INDEX "idx_liquidaciones_workspace" ON "public"."liquidaciones" USING "btree" ("workspace_id");



CREATE INDEX "idx_metas_workspace" ON "public"."metas" USING "btree" ("workspace_id");



CREATE INDEX "idx_notif_renovacion_poliza" ON "public"."notificaciones_renovacion" USING "btree" ("poliza_id", "dias_alerta");



CREATE INDEX "idx_notif_renovacion_ws" ON "public"."notificaciones_renovacion" USING "btree" ("workspace_id");



CREATE INDEX "idx_poliza_afiliados_activo" ON "public"."poliza_afiliados" USING "btree" ("activo");



CREATE INDEX "idx_poliza_afiliados_cliente" ON "public"."poliza_afiliados" USING "btree" ("cliente_id");



CREATE INDEX "idx_poliza_afiliados_documento" ON "public"."poliza_afiliados" USING "btree" ("numero_documento");



CREATE INDEX "idx_poliza_afiliados_plan" ON "public"."poliza_afiliados" USING "btree" ("plan_id");



CREATE INDEX "idx_poliza_afiliados_poliza" ON "public"."poliza_afiliados" USING "btree" ("poliza_id");



CREATE INDEX "idx_poliza_afiliados_workspace" ON "public"."poliza_afiliados" USING "btree" ("workspace_id");



CREATE INDEX "idx_poliza_planes_poliza" ON "public"."poliza_planes" USING "btree" ("poliza_id");



CREATE INDEX "idx_poliza_planes_workspace" ON "public"."poliza_planes" USING "btree" ("workspace_id");



CREATE INDEX "idx_polizas_client_id" ON "public"."polizas" USING "btree" ("client_id");



CREATE INDEX "idx_polizas_es_renovacion" ON "public"."polizas" USING "btree" ("es_renovacion");



CREATE INDEX "idx_polizas_estado" ON "public"."polizas" USING "btree" ("estado");



CREATE INDEX "idx_polizas_fecha_fin" ON "public"."polizas" USING "btree" ("fecha_fin");



CREATE INDEX "idx_polizas_fecha_pago_abc" ON "public"."polizas" USING "btree" ("fecha_pago_abc");



CREATE INDEX "idx_polizas_fecha_pago_asesor" ON "public"."polizas" USING "btree" ("fecha_pago_asesor");



CREATE INDEX "idx_polizas_mes_emision" ON "public"."polizas" USING "btree" ("mes_emision");



CREATE INDEX "idx_polizas_workspace" ON "public"."polizas" USING "btree" ("workspace_id");



CREATE INDEX "idx_prospectos_client_id" ON "public"."prospectos" USING "btree" ("client_id");



CREATE INDEX "idx_prospectos_estado_pipeline" ON "public"."prospectos" USING "btree" ("estado_pipeline");



CREATE INDEX "idx_prospectos_workspace" ON "public"."prospectos" USING "btree" ("workspace_id");



CREATE INDEX "idx_recibos_cobro_id" ON "public"."recibos" USING "btree" ("cobro_id");



CREATE INDEX "idx_recibos_tipo" ON "public"."recibos" USING "btree" ("tipo");



CREATE INDEX "idx_recibos_workspace" ON "public"."recibos" USING "btree" ("workspace_id");



CREATE INDEX "idx_remisiones_workspace" ON "public"."remisiones" USING "btree" ("workspace_id");



CREATE INDEX "idx_siniestros_estado" ON "public"."siniestros" USING "btree" ("estado");



CREATE INDEX "idx_siniestros_poliza_id" ON "public"."siniestros" USING "btree" ("poliza_id");



CREATE INDEX "idx_siniestros_workspace" ON "public"."siniestros" USING "btree" ("workspace_id");



CREATE INDEX "idx_solicitudes_client_id" ON "public"."solicitudes" USING "btree" ("client_id");



CREATE INDEX "idx_solicitudes_estado" ON "public"."solicitudes" USING "btree" ("estado");



CREATE INDEX "idx_solicitudes_tipo" ON "public"."solicitudes" USING "btree" ("tipo");



CREATE INDEX "idx_solicitudes_workspace" ON "public"."solicitudes" USING "btree" ("workspace_id");



CREATE INDEX "idx_tareas_client_id" ON "public"."tareas" USING "btree" ("client_id");



CREATE INDEX "idx_tareas_completada" ON "public"."tareas" USING "btree" ("completada");



CREATE INDEX "idx_tareas_fecha_vencimiento" ON "public"."tareas" USING "btree" ("fecha_vencimiento");



CREATE INDEX "idx_tareas_poliza_id" ON "public"."tareas" USING "btree" ("poliza_id");



CREATE INDEX "idx_tareas_workspace" ON "public"."tareas" USING "btree" ("workspace_id");



CREATE INDEX "idx_vendedores_workspace" ON "public"."vendedores" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspace_invitations_tok" ON "public"."workspace_invitations" USING "btree" ("token");



CREATE INDEX "idx_workspace_invitations_ws" ON "public"."workspace_invitations" USING "btree" ("workspace_id");



CREATE INDEX "idx_workspace_members_user" ON "public"."workspace_members" USING "btree" ("user_id");



CREATE INDEX "idx_workspace_members_ws" ON "public"."workspace_members" USING "btree" ("workspace_id");



CREATE OR REPLACE TRIGGER "agenda_eventos_updated_at" BEFORE UPDATE ON "public"."agenda_eventos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "diligencias_updated_at" BEFORE UPDATE ON "public"."diligencias" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "facturas_updated_at" BEFORE UPDATE ON "public"."facturas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "liquidaciones_updated_at" BEFORE UPDATE ON "public"."liquidaciones" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "metas_updated_at" BEFORE UPDATE ON "public"."metas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "poliza_afiliados_updated_at" BEFORE UPDATE ON "public"."poliza_afiliados" FOR EACH ROW EXECUTE FUNCTION "public"."update_poliza_afiliados_updated_at"();



CREATE OR REPLACE TRIGGER "poliza_planes_updated_at" BEFORE UPDATE ON "public"."poliza_planes" FOR EACH ROW EXECUTE FUNCTION "public"."update_poliza_planes_updated_at"();



CREATE OR REPLACE TRIGGER "prospectos_updated_at" BEFORE UPDATE ON "public"."prospectos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "remisiones_updated_at" BEFORE UPDATE ON "public"."remisiones" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "siniestros_updated_at" BEFORE UPDATE ON "public"."siniestros" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "solicitudes_updated_at" BEFORE UPDATE ON "public"."solicitudes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tareas_updated_at" BEFORE UPDATE ON "public"."tareas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_campanas_updated_at" BEFORE UPDATE ON "public"."campanas_renovacion" FOR EACH ROW EXECUTE FUNCTION "public"."update_campanas_updated_at"();



CREATE OR REPLACE TRIGGER "update_clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."actividades"
    ADD CONSTRAINT "actividades_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."actividades"
    ADD CONSTRAINT "actividades_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."actividades"
    ADD CONSTRAINT "actividades_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."afiliado_cambios_plan"
    ADD CONSTRAINT "afiliado_cambios_plan_afiliado_id_fkey" FOREIGN KEY ("afiliado_id") REFERENCES "public"."poliza_afiliados"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."afiliado_cambios_plan"
    ADD CONSTRAINT "afiliado_cambios_plan_plan_anterior_id_fkey" FOREIGN KEY ("plan_anterior_id") REFERENCES "public"."poliza_planes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."afiliado_cambios_plan"
    ADD CONSTRAINT "afiliado_cambios_plan_plan_nuevo_id_fkey" FOREIGN KEY ("plan_nuevo_id") REFERENCES "public"."poliza_planes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_eventos"
    ADD CONSTRAINT "agenda_eventos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_eventos"
    ADD CONSTRAINT "agenda_eventos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agenda_eventos"
    ADD CONSTRAINT "agenda_eventos_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_eventos"
    ADD CONSTRAINT "agenda_eventos_prospecto_id_fkey" FOREIGN KEY ("prospecto_id") REFERENCES "public"."prospectos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agenda_eventos"
    ADD CONSTRAINT "agenda_eventos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."amparos_siniestro"
    ADD CONSTRAINT "amparos_siniestro_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."amparos_siniestro"
    ADD CONSTRAINT "amparos_siniestro_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "public"."siniestros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."amparos_siniestro"
    ADD CONSTRAINT "amparos_siniestro_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_prospecto_id_fkey" FOREIGN KEY ("prospecto_id") REFERENCES "public"."prospectos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."archivos"
    ADD CONSTRAINT "archivos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."campanas_renovacion"
    ADD CONSTRAINT "campanas_renovacion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."campanas_renovacion"
    ADD CONSTRAINT "campanas_renovacion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."clientes_historial"
    ADD CONSTRAINT "clientes_historial_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes_historial"
    ADD CONSTRAINT "clientes_historial_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cobros"
    ADD CONSTRAINT "cobros_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."colilla_lineas"
    ADD CONSTRAINT "colilla_lineas_colilla_id_fkey" FOREIGN KEY ("colilla_id") REFERENCES "public"."colillas_importacion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."colilla_lineas"
    ADD CONSTRAINT "colilla_lineas_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id");



ALTER TABLE ONLY "public"."colilla_lineas"
    ADD CONSTRAINT "colilla_lineas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."colillas_importacion"
    ADD CONSTRAINT "colillas_importacion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."colillas_importacion"
    ADD CONSTRAINT "colillas_importacion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."contactos"
    ADD CONSTRAINT "contactos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contactos"
    ADD CONSTRAINT "contactos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contactos"
    ADD CONSTRAINT "contactos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."dashboards_custom"
    ADD CONSTRAINT "dashboards_custom_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."dashboards_custom"
    ADD CONSTRAINT "dashboards_custom_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."diligencia_tareas"
    ADD CONSTRAINT "diligencia_tareas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."diligencia_tareas"
    ADD CONSTRAINT "diligencia_tareas_diligencia_id_fkey" FOREIGN KEY ("diligencia_id") REFERENCES "public"."diligencias"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."diligencia_tareas"
    ADD CONSTRAINT "diligencia_tareas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."diligencias"
    ADD CONSTRAINT "diligencias_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."diligencias"
    ADD CONSTRAINT "diligencias_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."facturas"
    ADD CONSTRAINT "facturas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."facturas"
    ADD CONSTRAINT "facturas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."gestiones_renovacion"
    ADD CONSTRAINT "gestiones_renovacion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."gestiones_renovacion"
    ADD CONSTRAINT "gestiones_renovacion_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gestiones_renovacion"
    ADD CONSTRAINT "gestiones_renovacion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."historial_comisiones_poliza"
    ADD CONSTRAINT "historial_comisiones_poliza_colilla_id_fkey" FOREIGN KEY ("colilla_id") REFERENCES "public"."colillas_importacion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_comisiones_poliza"
    ADD CONSTRAINT "historial_comisiones_poliza_colilla_linea_id_fkey" FOREIGN KEY ("colilla_linea_id") REFERENCES "public"."colilla_lineas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historial_comisiones_poliza"
    ADD CONSTRAINT "historial_comisiones_poliza_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_comisiones_poliza"
    ADD CONSTRAINT "historial_comisiones_poliza_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."metas"
    ADD CONSTRAINT "metas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."notificaciones_renovacion"
    ADD CONSTRAINT "notificaciones_renovacion_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones_renovacion"
    ADD CONSTRAINT "notificaciones_renovacion_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poliza_afiliados"
    ADD CONSTRAINT "poliza_afiliados_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poliza_afiliados"
    ADD CONSTRAINT "poliza_afiliados_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."poliza_planes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poliza_afiliados"
    ADD CONSTRAINT "poliza_afiliados_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poliza_afiliados"
    ADD CONSTRAINT "poliza_afiliados_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poliza_anexos"
    ADD CONSTRAINT "poliza_anexos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."poliza_anexos"
    ADD CONSTRAINT "poliza_anexos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."poliza_anexos"
    ADD CONSTRAINT "poliza_anexos_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poliza_anexos"
    ADD CONSTRAINT "poliza_anexos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."poliza_planes"
    ADD CONSTRAINT "poliza_planes_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poliza_planes"
    ADD CONSTRAINT "poliza_planes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poliza_vinculados"
    ADD CONSTRAINT "poliza_vinculados_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."poliza_vinculados"
    ADD CONSTRAINT "poliza_vinculados_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."poliza_vinculados"
    ADD CONSTRAINT "poliza_vinculados_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."polizas"
    ADD CONSTRAINT "polizas_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."polizas"
    ADD CONSTRAINT "polizas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."polizas"
    ADD CONSTRAINT "polizas_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."polizas"
    ADD CONSTRAINT "polizas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."prospecto_actividades"
    ADD CONSTRAINT "prospecto_actividades_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."prospecto_actividades"
    ADD CONSTRAINT "prospecto_actividades_prospecto_id_fkey" FOREIGN KEY ("prospecto_id") REFERENCES "public"."prospectos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prospecto_actividades"
    ADD CONSTRAINT "prospecto_actividades_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."prospectos"
    ADD CONSTRAINT "prospectos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prospectos"
    ADD CONSTRAINT "prospectos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."prospectos"
    ADD CONSTRAINT "prospectos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."recibos"
    ADD CONSTRAINT "recibos_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "public"."cobros"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recibos"
    ADD CONSTRAINT "recibos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recibos"
    ADD CONSTRAINT "recibos_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recibos"
    ADD CONSTRAINT "recibos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."remisiones"
    ADD CONSTRAINT "remisiones_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."remisiones"
    ADD CONSTRAINT "remisiones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."remisiones"
    ADD CONSTRAINT "remisiones_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."remisiones"
    ADD CONSTRAINT "remisiones_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."siniestro_amparos"
    ADD CONSTRAINT "siniestro_amparos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."siniestro_amparos"
    ADD CONSTRAINT "siniestro_amparos_siniestro_id_fkey" FOREIGN KEY ("siniestro_id") REFERENCES "public"."siniestros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."siniestro_amparos"
    ADD CONSTRAINT "siniestro_amparos_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."siniestros"
    ADD CONSTRAINT "siniestros_afiliado_id_fkey" FOREIGN KEY ("afiliado_id") REFERENCES "public"."poliza_afiliados"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."siniestros"
    ADD CONSTRAINT "siniestros_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."siniestros"
    ADD CONSTRAINT "siniestros_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."siniestros"
    ADD CONSTRAINT "siniestros_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."solicitudes"
    ADD CONSTRAINT "solicitudes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitudes"
    ADD CONSTRAINT "solicitudes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."solicitudes"
    ADD CONSTRAINT "solicitudes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."tareas"
    ADD CONSTRAINT "tareas_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clientes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tareas"
    ADD CONSTRAINT "tareas_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tareas"
    ADD CONSTRAINT "tareas_poliza_id_fkey" FOREIGN KEY ("poliza_id") REFERENCES "public"."polizas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tareas"
    ADD CONSTRAINT "tareas_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id");



ALTER TABLE ONLY "public"."workspace_integrations"
    ADD CONSTRAINT "workspace_integrations_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspace_integrations"
    ADD CONSTRAINT "workspace_integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspace_invitations"
    ADD CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_members"
    ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_permissions"
    ADD CONSTRAINT "workspace_permissions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspaces"
    ADD CONSTRAINT "workspaces_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE "public"."actividades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "actividades_auth_all" ON "public"."actividades" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."afiliado_cambios_plan" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "afiliados_delete" ON "public"."poliza_afiliados" FOR DELETE USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "afiliados_insert" ON "public"."poliza_afiliados" FOR INSERT WITH CHECK ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "afiliados_select" ON "public"."poliza_afiliados" FOR SELECT USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "afiliados_update" ON "public"."poliza_afiliados" FOR UPDATE USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."agenda_eventos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agenda_eventos_auth_all" ON "public"."agenda_eventos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "allow_all" ON "public"."campanas_renovacion" USING (true) WITH CHECK (true);



ALTER TABLE "public"."archivos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "archivos_auth_all" ON "public"."archivos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "archivos_delete" ON "public"."archivos" FOR DELETE USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "archivos_insert" ON "public"."archivos" FOR INSERT WITH CHECK ((("workspace_id" IS NOT NULL) AND "public"."is_workspace_member"("workspace_id")));



CREATE POLICY "archivos_select" ON "public"."archivos" FOR SELECT USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "archivos_update" ON "public"."archivos" FOR UPDATE USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "cambios_plan_insert" ON "public"."afiliado_cambios_plan" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."poliza_afiliados" "pa"
     JOIN "public"."polizas" "p" ON (("p"."id" = "pa"."poliza_id")))
  WHERE (("pa"."id" = "afiliado_cambios_plan"."afiliado_id") AND "public"."is_workspace_member"("p"."workspace_id")))));



CREATE POLICY "cambios_plan_select" ON "public"."afiliado_cambios_plan" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."poliza_afiliados" "pa"
     JOIN "public"."polizas" "p" ON (("p"."id" = "pa"."poliza_id")))
  WHERE (("pa"."id" = "afiliado_cambios_plan"."afiliado_id") AND "public"."is_workspace_member"("p"."workspace_id")))));



ALTER TABLE "public"."campanas_renovacion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_auth_all" ON "public"."clientes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "clientes_delete" ON "public"."clientes" FOR DELETE USING ("public"."has_permission"("workspace_id", 'clientes_eliminar'::"text"));



ALTER TABLE "public"."clientes_historial" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_update" ON "public"."clientes" FOR UPDATE USING (("public"."has_permission"("workspace_id", 'clientes_editar_todos'::"text") OR ("public"."has_permission"("workspace_id", 'clientes_editar_propios'::"text") AND (("created_by" = "auth"."uid"()) OR ("created_by" IS NULL)))));



ALTER TABLE "public"."cobros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cobros_auth_all" ON "public"."cobros" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "cobros_delete" ON "public"."cobros" FOR DELETE USING ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "cobros_insert" ON "public"."cobros" FOR INSERT WITH CHECK ("public"."has_permission"("workspace_id", 'finanzas_cobros_registrar'::"text"));



CREATE POLICY "cobros_select" ON "public"."cobros" FOR SELECT USING ("public"."has_permission"("workspace_id", 'finanzas_cobros_ver'::"text"));



ALTER TABLE "public"."colilla_lineas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "colilla_lineas_workspace_member" ON "public"."colilla_lineas" USING ("public"."is_workspace_member"("workspace_id")) WITH CHECK ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."colillas_importacion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "colillas_importacion_workspace_member" ON "public"."colillas_importacion" USING ("public"."is_workspace_member"("workspace_id")) WITH CHECK ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."configuracion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "configuracion_auth_all" ON "public"."configuracion" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "configuracion_delete" ON "public"."configuracion" FOR DELETE USING ("public"."has_permission"("workspace_id", 'configuracion_editar_agencia'::"text"));



CREATE POLICY "configuracion_insert" ON "public"."configuracion" FOR INSERT WITH CHECK ("public"."has_permission"("workspace_id", 'configuracion_editar_agencia'::"text"));



CREATE POLICY "configuracion_update" ON "public"."configuracion" FOR UPDATE USING ("public"."has_permission"("workspace_id", 'configuracion_editar_agencia'::"text"));



ALTER TABLE "public"."default_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."diligencias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "diligencias_auth_all" ON "public"."diligencias" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."facturas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facturas_auth_all" ON "public"."facturas" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."historial_comisiones_poliza" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "historial_comisiones_workspace_member" ON "public"."historial_comisiones_poliza" USING ("public"."is_workspace_member"("workspace_id")) WITH CHECK ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "historial_insert" ON "public"."clientes_historial" FOR INSERT WITH CHECK (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "historial_select" ON "public"."clientes_historial" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."liquidaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "liquidaciones_auth_all" ON "public"."liquidaciones" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "liquidaciones_delete" ON "public"."liquidaciones" FOR DELETE USING ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "liquidaciones_insert" ON "public"."liquidaciones" FOR INSERT WITH CHECK ("public"."has_permission"("workspace_id", 'finanzas_liquidaciones_crear'::"text"));



CREATE POLICY "liquidaciones_select" ON "public"."liquidaciones" FOR SELECT USING ("public"."has_permission"("workspace_id", 'finanzas_liquidaciones_ver'::"text"));



CREATE POLICY "liquidaciones_update" ON "public"."liquidaciones" FOR UPDATE USING ("public"."has_permission"("workspace_id", 'finanzas_liquidaciones_crear'::"text"));



ALTER TABLE "public"."metas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "metas_auth_all" ON "public"."metas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "notif_select" ON "public"."notificaciones_renovacion" FOR SELECT USING (("workspace_id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."notificaciones_renovacion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "planes_delete" ON "public"."poliza_planes" FOR DELETE USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "planes_insert" ON "public"."poliza_planes" FOR INSERT WITH CHECK ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "planes_select" ON "public"."poliza_planes" FOR SELECT USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "planes_update" ON "public"."poliza_planes" FOR UPDATE USING ("public"."is_workspace_member"("workspace_id"));



ALTER TABLE "public"."poliza_afiliados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poliza_anexos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "poliza_anexos_auth_all" ON "public"."poliza_anexos" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."poliza_planes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."poliza_vinculados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "poliza_vinculados_auth_all" ON "public"."poliza_vinculados" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."polizas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "polizas_auth_all" ON "public"."polizas" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "polizas_delete" ON "public"."polizas" FOR DELETE USING ("public"."has_permission"("workspace_id", 'polizas_eliminar'::"text"));



CREATE POLICY "polizas_update" ON "public"."polizas" FOR UPDATE USING ("public"."has_permission"("workspace_id", 'polizas_editar'::"text"));



ALTER TABLE "public"."prospecto_actividades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prospecto_actividades_auth_all" ON "public"."prospecto_actividades" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."prospectos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prospectos_auth_all" ON "public"."prospectos" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "prospectos_delete" ON "public"."prospectos" FOR DELETE USING (("public"."has_permission"("workspace_id", 'pipeline_eliminar_todos'::"text") OR ("public"."has_permission"("workspace_id", 'pipeline_eliminar_propios'::"text") AND ("created_by" = "auth"."uid"()))));



ALTER TABLE "public"."recibos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recibos_auth_all" ON "public"."recibos" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."remisiones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "remisiones_auth_all" ON "public"."remisiones" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."siniestro_amparos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "siniestro_amparos_auth_all" ON "public"."siniestro_amparos" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."siniestros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "siniestros_auth_all" ON "public"."siniestros" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."solicitudes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "solicitudes_auth_all" ON "public"."solicitudes" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."tareas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tareas_auth_all" ON "public"."tareas" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."vendedores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vendedores_auth_all" ON "public"."vendedores" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "wi_delete" ON "public"."workspace_invitations" FOR DELETE USING ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "wi_insert" ON "public"."workspace_invitations" FOR INSERT WITH CHECK ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "wi_select" ON "public"."workspace_invitations" FOR SELECT USING (("public"."is_workspace_member"("workspace_id") OR ("email" = "auth"."email"())));



CREATE POLICY "wi_update" ON "public"."workspace_invitations" FOR UPDATE USING (("public"."is_workspace_admin"("workspace_id") OR ("email" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



CREATE POLICY "wint_delete" ON "public"."workspace_integrations" FOR DELETE USING ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "wint_insert" ON "public"."workspace_integrations" FOR INSERT WITH CHECK ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "wint_select" ON "public"."workspace_integrations" FOR SELECT USING ("public"."is_workspace_member"("workspace_id"));



CREATE POLICY "wint_update" ON "public"."workspace_integrations" FOR UPDATE USING ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "wm_delete" ON "public"."workspace_members" FOR DELETE USING ("public"."is_workspace_admin"("workspace_id"));



CREATE POLICY "wm_insert" ON "public"."workspace_members" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_workspace_admin"("workspace_id") OR (("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."workspaces"
  WHERE (("workspaces"."id" = "workspace_members"."workspace_id") AND ("workspaces"."owner_id" = "auth"."uid"())))))));



CREATE POLICY "wm_select" ON "public"."workspace_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "wm_update" ON "public"."workspace_members" FOR UPDATE USING ("public"."is_workspace_admin"("workspace_id"));



ALTER TABLE "public"."workspace_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspace_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."workspaces" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wp_admin_all" ON "public"."workspace_permissions" USING (false) WITH CHECK (false);



CREATE POLICY "ws_delete" ON "public"."workspaces" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "ws_insert" ON "public"."workspaces" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "ws_select" ON "public"."workspaces" FOR SELECT USING (("id" IN ( SELECT "workspace_members"."workspace_id"
   FROM "public"."workspace_members"
  WHERE ("workspace_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "ws_update" ON "public"."workspaces" FOR UPDATE USING ("public"."is_workspace_admin"("id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."accept_workspace_invitation"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_workspace_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_workspace_invitation"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_workspace_invitation"("p_workspace_id" "uuid", "p_invitation_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_workspace_invitation"("p_workspace_id" "uuid", "p_invitation_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_workspace_invitation"("p_workspace_id" "uuid", "p_invitation_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."change_member_role"("p_workspace_id" "uuid", "p_member_id" "uuid", "p_new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."change_member_role"("p_workspace_id" "uuid", "p_member_id" "uuid", "p_new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_member_role"("p_workspace_id" "uuid", "p_member_id" "uuid", "p_new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirmar_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirmar_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirmar_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_workspace_invitation"("p_workspace_id" "uuid", "p_email" "text", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_workspace_invitation"("p_workspace_id" "uuid", "p_email" "text", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_workspace_invitation"("p_workspace_id" "uuid", "p_email" "text", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_assignable_members"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_assignable_members"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_assignable_members"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"("p_ws" "uuid", "p_uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"("p_ws" "uuid", "p_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_metrics"("p_ws" "uuid", "p_uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_estado_cuenta_vendedor"("p_workspace_id" "uuid", "p_vendedor_id" "uuid", "p_periodo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_estado_cuenta_vendedor"("p_workspace_id" "uuid", "p_vendedor_id" "uuid", "p_periodo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_estado_cuenta_vendedor"("p_workspace_id" "uuid", "p_vendedor_id" "uuid", "p_periodo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invitation_by_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_permissions"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_permissions"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_permissions"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_polizas_por_vencer"("dias_max" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_polizas_por_vencer"("dias_max" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_polizas_por_vencer"("dias_max" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_workspace_role"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_workspace_role"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_workspace_role"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_workspaces"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_workspaces"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_workspaces"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_invitations"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_invitations"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_invitations"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_members"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_members"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_members"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_workspace_permissions"("p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_workspace_permissions"("p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_workspace_permissions"("p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("ws_id" "uuid", "perm_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("ws_id" "uuid", "perm_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("ws_id" "uuid", "perm_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_admin"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_admin"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_admin"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_member"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_member"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_workspace_supervisor"("ws_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_workspace_supervisor"("ws_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_workspace_supervisor"("ws_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_workspace_member"("p_workspace_id" "uuid", "p_member_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_workspace_member"("p_workspace_id" "uuid", "p_member_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_workspace_member"("p_workspace_id" "uuid", "p_member_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_role_permissions"("p_workspace_id" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reset_role_permissions"("p_workspace_id" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_role_permissions"("p_workspace_id" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."revertir_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revertir_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revertir_colilla"("p_colilla_id" "uuid", "p_workspace_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."setup_user_workspace"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."setup_user_workspace"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."setup_user_workspace"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_campanas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_campanas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_campanas_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_poliza_afiliados_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_poliza_afiliados_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_poliza_afiliados_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_poliza_planes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_poliza_planes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_poliza_planes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_workspace_permission"("p_workspace_id" "uuid", "p_role" "text", "p_permission_key" "text", "p_enabled" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."update_workspace_permission"("p_workspace_id" "uuid", "p_role" "text", "p_permission_key" "text", "p_enabled" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_workspace_permission"("p_workspace_id" "uuid", "p_role" "text", "p_permission_key" "text", "p_enabled" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_workspace"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_workspace"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_workspace"() TO "service_role";


















GRANT ALL ON TABLE "public"."actividades" TO "anon";
GRANT ALL ON TABLE "public"."actividades" TO "authenticated";
GRANT ALL ON TABLE "public"."actividades" TO "service_role";



GRANT ALL ON TABLE "public"."afiliado_cambios_plan" TO "anon";
GRANT ALL ON TABLE "public"."afiliado_cambios_plan" TO "authenticated";
GRANT ALL ON TABLE "public"."afiliado_cambios_plan" TO "service_role";



GRANT ALL ON TABLE "public"."agenda_eventos" TO "anon";
GRANT ALL ON TABLE "public"."agenda_eventos" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_eventos" TO "service_role";



GRANT ALL ON TABLE "public"."amparos_siniestro" TO "anon";
GRANT ALL ON TABLE "public"."amparos_siniestro" TO "authenticated";
GRANT ALL ON TABLE "public"."amparos_siniestro" TO "service_role";



GRANT ALL ON TABLE "public"."archivos" TO "anon";
GRANT ALL ON TABLE "public"."archivos" TO "authenticated";
GRANT ALL ON TABLE "public"."archivos" TO "service_role";



GRANT ALL ON TABLE "public"."campanas_renovacion" TO "anon";
GRANT ALL ON TABLE "public"."campanas_renovacion" TO "authenticated";
GRANT ALL ON TABLE "public"."campanas_renovacion" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."clientes_historial" TO "anon";
GRANT ALL ON TABLE "public"."clientes_historial" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes_historial" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cobros_num_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cobros_num_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cobros_num_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cobros" TO "anon";
GRANT ALL ON TABLE "public"."cobros" TO "authenticated";
GRANT ALL ON TABLE "public"."cobros" TO "service_role";



GRANT ALL ON TABLE "public"."colilla_lineas" TO "anon";
GRANT ALL ON TABLE "public"."colilla_lineas" TO "authenticated";
GRANT ALL ON TABLE "public"."colilla_lineas" TO "service_role";



GRANT ALL ON TABLE "public"."colillas_importacion" TO "anon";
GRANT ALL ON TABLE "public"."colillas_importacion" TO "authenticated";
GRANT ALL ON TABLE "public"."colillas_importacion" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion" TO "anon";
GRANT ALL ON TABLE "public"."configuracion" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion" TO "service_role";



GRANT ALL ON TABLE "public"."contactos" TO "anon";
GRANT ALL ON TABLE "public"."contactos" TO "authenticated";
GRANT ALL ON TABLE "public"."contactos" TO "service_role";



GRANT ALL ON TABLE "public"."dashboards_custom" TO "anon";
GRANT ALL ON TABLE "public"."dashboards_custom" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboards_custom" TO "service_role";



GRANT ALL ON TABLE "public"."default_permissions" TO "anon";
GRANT ALL ON TABLE "public"."default_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."default_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."diligencia_tareas" TO "anon";
GRANT ALL ON TABLE "public"."diligencia_tareas" TO "authenticated";
GRANT ALL ON TABLE "public"."diligencia_tareas" TO "service_role";



GRANT ALL ON TABLE "public"."diligencias" TO "anon";
GRANT ALL ON TABLE "public"."diligencias" TO "authenticated";
GRANT ALL ON TABLE "public"."diligencias" TO "service_role";



GRANT ALL ON SEQUENCE "public"."diligencias_num_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."diligencias_num_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."diligencias_num_seq" TO "service_role";



GRANT ALL ON TABLE "public"."facturas" TO "anon";
GRANT ALL ON TABLE "public"."facturas" TO "authenticated";
GRANT ALL ON TABLE "public"."facturas" TO "service_role";



GRANT ALL ON SEQUENCE "public"."facturas_num_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."facturas_num_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."facturas_num_seq" TO "service_role";



GRANT ALL ON TABLE "public"."gestiones_renovacion" TO "anon";
GRANT ALL ON TABLE "public"."gestiones_renovacion" TO "authenticated";
GRANT ALL ON TABLE "public"."gestiones_renovacion" TO "service_role";



GRANT ALL ON TABLE "public"."historial_comisiones_poliza" TO "anon";
GRANT ALL ON TABLE "public"."historial_comisiones_poliza" TO "authenticated";
GRANT ALL ON TABLE "public"."historial_comisiones_poliza" TO "service_role";



GRANT ALL ON TABLE "public"."liquidaciones" TO "anon";
GRANT ALL ON TABLE "public"."liquidaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."liquidaciones" TO "service_role";



GRANT ALL ON TABLE "public"."metas" TO "anon";
GRANT ALL ON TABLE "public"."metas" TO "authenticated";
GRANT ALL ON TABLE "public"."metas" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones_renovacion" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones_renovacion" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones_renovacion" TO "service_role";



GRANT ALL ON TABLE "public"."poliza_afiliados" TO "anon";
GRANT ALL ON TABLE "public"."poliza_afiliados" TO "authenticated";
GRANT ALL ON TABLE "public"."poliza_afiliados" TO "service_role";



GRANT ALL ON TABLE "public"."poliza_anexos" TO "anon";
GRANT ALL ON TABLE "public"."poliza_anexos" TO "authenticated";
GRANT ALL ON TABLE "public"."poliza_anexos" TO "service_role";



GRANT ALL ON TABLE "public"."poliza_planes" TO "anon";
GRANT ALL ON TABLE "public"."poliza_planes" TO "authenticated";
GRANT ALL ON TABLE "public"."poliza_planes" TO "service_role";



GRANT ALL ON TABLE "public"."poliza_vinculados" TO "anon";
GRANT ALL ON TABLE "public"."poliza_vinculados" TO "authenticated";
GRANT ALL ON TABLE "public"."poliza_vinculados" TO "service_role";



GRANT ALL ON TABLE "public"."polizas" TO "anon";
GRANT ALL ON TABLE "public"."polizas" TO "authenticated";
GRANT ALL ON TABLE "public"."polizas" TO "service_role";



GRANT ALL ON TABLE "public"."prospecto_actividades" TO "anon";
GRANT ALL ON TABLE "public"."prospecto_actividades" TO "authenticated";
GRANT ALL ON TABLE "public"."prospecto_actividades" TO "service_role";



GRANT ALL ON TABLE "public"."prospectos" TO "anon";
GRANT ALL ON TABLE "public"."prospectos" TO "authenticated";
GRANT ALL ON TABLE "public"."prospectos" TO "service_role";



GRANT ALL ON TABLE "public"."recibos" TO "anon";
GRANT ALL ON TABLE "public"."recibos" TO "authenticated";
GRANT ALL ON TABLE "public"."recibos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."remisiones_num_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."remisiones_num_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."remisiones_num_seq" TO "service_role";



GRANT ALL ON TABLE "public"."remisiones" TO "anon";
GRANT ALL ON TABLE "public"."remisiones" TO "authenticated";
GRANT ALL ON TABLE "public"."remisiones" TO "service_role";



GRANT ALL ON TABLE "public"."siniestro_amparos" TO "anon";
GRANT ALL ON TABLE "public"."siniestro_amparos" TO "authenticated";
GRANT ALL ON TABLE "public"."siniestro_amparos" TO "service_role";



GRANT ALL ON TABLE "public"."siniestros" TO "anon";
GRANT ALL ON TABLE "public"."siniestros" TO "authenticated";
GRANT ALL ON TABLE "public"."siniestros" TO "service_role";



GRANT ALL ON SEQUENCE "public"."siniestros_num_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."siniestros_num_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."siniestros_num_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."solicitudes_num_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."solicitudes_num_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."solicitudes_num_seq" TO "service_role";



GRANT ALL ON TABLE "public"."solicitudes" TO "anon";
GRANT ALL ON TABLE "public"."solicitudes" TO "authenticated";
GRANT ALL ON TABLE "public"."solicitudes" TO "service_role";



GRANT ALL ON TABLE "public"."tareas" TO "anon";
GRANT ALL ON TABLE "public"."tareas" TO "authenticated";
GRANT ALL ON TABLE "public"."tareas" TO "service_role";



GRANT ALL ON TABLE "public"."vendedores" TO "anon";
GRANT ALL ON TABLE "public"."vendedores" TO "authenticated";
GRANT ALL ON TABLE "public"."vendedores" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_integrations" TO "anon";
GRANT ALL ON TABLE "public"."workspace_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_invitations" TO "anon";
GRANT ALL ON TABLE "public"."workspace_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_members" TO "anon";
GRANT ALL ON TABLE "public"."workspace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_members" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_permissions" TO "anon";
GRANT ALL ON TABLE "public"."workspace_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."workspaces" TO "anon";
GRANT ALL ON TABLE "public"."workspaces" TO "authenticated";
GRANT ALL ON TABLE "public"."workspaces" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "archivos_storage_delete"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'archivos'::text) AND (auth.uid() IS NOT NULL)));



  create policy "archivos_storage_insert"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'archivos'::text) AND (auth.uid() IS NOT NULL)));



  create policy "archivos_storage_select"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'archivos'::text) AND (auth.uid() IS NOT NULL)));



  create policy "archivos_storage_update"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'archivos'::text) AND (auth.uid() IS NOT NULL)));



