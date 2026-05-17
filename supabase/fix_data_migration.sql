-- ══════════════════════════════════════════════════════════════════════
-- FIX: Migrar registros existentes (workspace_id = NULL) al workspace
--      correcto, y corregir funciones RPC del workspace.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ── PASO 1: Ver workspaces existentes (para verificar cuál es el tuyo) ──
-- Puedes correr solo esta línea primero si quieres revisar:
-- SELECT id, name, owner_id, setup_completed, created_at FROM workspaces ORDER BY created_at;

-- ── PASO 2: Migrar todos los registros NULL al workspace más antiguo ──
DO $$
DECLARE
  target_ws uuid;
  cnt int;
BEGIN
  -- Tomamos el workspace más antiguo (el de la cuenta administradora original)
  SELECT id INTO target_ws FROM workspaces ORDER BY created_at ASC LIMIT 1;

  IF target_ws IS NULL THEN
    RAISE EXCEPTION 'No existe ningún workspace. Completa el onboarding primero.';
  END IF;

  RAISE NOTICE 'Migrando registros NULL al workspace: %', target_ws;

  UPDATE actividades           SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'actividades: % filas', cnt;

  UPDATE agenda_eventos        SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'agenda_eventos: % filas', cnt;

  UPDATE amparos_siniestro     SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'amparos_siniestro: % filas', cnt;

  UPDATE archivos              SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'archivos: % filas', cnt;

  UPDATE campanas_renovacion   SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'campanas_renovacion: % filas', cnt;

  UPDATE clientes              SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'clientes: % filas', cnt;

  UPDATE cobros                SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'cobros: % filas', cnt;

  UPDATE configuracion         SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'configuracion: % filas', cnt;

  UPDATE contactos             SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'contactos: % filas', cnt;

  UPDATE dashboards_custom     SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'dashboards_custom: % filas', cnt;

  UPDATE diligencia_tareas     SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'diligencia_tareas: % filas', cnt;

  UPDATE diligencias           SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'diligencias: % filas', cnt;

  UPDATE facturas              SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'facturas: % filas', cnt;

  UPDATE gestiones_renovacion  SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'gestiones_renovacion: % filas', cnt;

  UPDATE liquidaciones         SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'liquidaciones: % filas', cnt;

  UPDATE metas                 SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'metas: % filas', cnt;

  UPDATE poliza_anexos         SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'poliza_anexos: % filas', cnt;

  UPDATE poliza_vinculados     SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'poliza_vinculados: % filas', cnt;

  UPDATE polizas               SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'polizas: % filas', cnt;

  UPDATE prospecto_actividades SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'prospecto_actividades: % filas', cnt;

  UPDATE prospectos            SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'prospectos: % filas', cnt;

  UPDATE recibos               SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'recibos: % filas', cnt;

  UPDATE remisiones            SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'remisiones: % filas', cnt;

  UPDATE siniestro_amparos     SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'siniestro_amparos: % filas', cnt;

  UPDATE siniestros            SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'siniestros: % filas', cnt;

  UPDATE solicitudes           SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'solicitudes: % filas', cnt;

  UPDATE tareas                SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'tareas: % filas', cnt;

  UPDATE vendedores            SET workspace_id = target_ws WHERE workspace_id IS NULL;
  GET DIAGNOSTICS cnt = ROW_COUNT; RAISE NOTICE 'vendedores: % filas', cnt;

  -- Asegurar que el workspace principal esté marcado como configurado
  UPDATE workspaces SET setup_completed = true WHERE id = target_ws;

  RAISE NOTICE '✅ Migración completada. Workspace activo: %', target_ws;
END $$;


-- ── PASO 3: Actualizar setup_user_workspace para migrar las 28 tablas ──
-- (Corrige el RPC que solo migraba 8 tablas)

CREATE OR REPLACE FUNCTION setup_user_workspace(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_ws_id      uuid;
BEGIN
  -- Buscar workspace existente del usuario
  SELECT wm.workspace_id INTO v_ws_id
  FROM workspace_members wm
  WHERE wm.user_id = v_user_id
  LIMIT 1;

  IF v_ws_id IS NULL THEN
    -- Crear workspace nuevo
    INSERT INTO workspaces (name, owner_id, setup_completed)
    VALUES (p_name, v_user_id, true)
    RETURNING id INTO v_ws_id;

    -- Agregar usuario como admin
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_ws_id, v_user_id, 'admin')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  ELSE
    -- Actualizar nombre y marcar como configurado
    UPDATE workspaces
    SET name = p_name, setup_completed = true, updated_at = now()
    WHERE id = v_ws_id;
  END IF;

  -- Migrar TODOS los registros sin workspace al workspace del usuario
  UPDATE actividades           SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE agenda_eventos        SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE amparos_siniestro     SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE archivos              SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE campanas_renovacion   SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE clientes              SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE cobros                SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE configuracion         SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE contactos             SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE dashboards_custom     SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE diligencia_tareas     SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE diligencias           SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE facturas              SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE gestiones_renovacion  SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE liquidaciones         SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE metas                 SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE poliza_anexos         SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE poliza_vinculados     SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE polizas               SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE prospecto_actividades SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE prospectos            SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE recibos               SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE remisiones            SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE siniestro_amparos     SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE siniestros            SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE solicitudes           SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE tareas                SET workspace_id = v_ws_id WHERE workspace_id IS NULL;
  UPDATE vendedores            SET workspace_id = v_ws_id WHERE workspace_id IS NULL;

  RETURN jsonb_build_object('workspace_id', v_ws_id);
END;
$$;


-- ── PASO 4: Crear RPC para aceptar invitaciones (evita el error de RLS) ──
-- El INSERT directo en workspace_members falla porque el usuario invitado
-- no es admin todavía. Esta función SECURITY DEFINER lo hace por él.

CREATE OR REPLACE FUNCTION accept_workspace_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_user_email text;
  v_inv       record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No autenticado');
  END IF;

  -- Obtener email del usuario actual
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Buscar invitación válida
  SELECT * INTO v_inv
  FROM workspace_invitations
  WHERE token = p_token
    AND expires_at > now()
    AND accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invitación inválida, ya usada, o expirada');
  END IF;

  -- Agregar al workspace
  INSERT INTO workspace_members (workspace_id, user_id, role, invited_by)
  VALUES (v_inv.workspace_id, v_user_id, v_inv.role, v_inv.created_by)
  ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Marcar como aceptada
  UPDATE workspace_invitations
  SET accepted_at = now()
  WHERE id = v_inv.id;

  RETURN jsonb_build_object(
    'workspace_id', v_inv.workspace_id,
    'role',         v_inv.role
  );
END;
$$;


-- ── PASO 5: Reparar handle_new_user trigger (con bloque de excepción) ──
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  -- No fallar el registro si el workspace no se puede crear
  RETURN new;
END;
$$;


-- ── PASO 6: RPC para leer invitación por token (funciona sin estar logueado) ──
-- El SELECT directo en workspace_invitations falla para usuarios no autenticados.
-- Esta función SECURITY DEFINER devuelve los datos si el token es válido.

CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  SELECT
    wi.id,
    wi.workspace_id,
    wi.email,
    wi.role,
    wi.token,
    wi.expires_at,
    wi.accepted_at,
    wi.created_by,
    w.name AS workspace_name
  INTO v_row
  FROM workspace_invitations wi
  JOIN workspaces w ON w.id = wi.workspace_id
  WHERE wi.token = p_token
    AND wi.expires_at > now()
    AND wi.accepted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id',             v_row.id,
    'workspace_id',   v_row.workspace_id,
    'email',          v_row.email,
    'role',           v_row.role,
    'token',          v_row.token,
    'expires_at',     v_row.expires_at,
    'accepted_at',    v_row.accepted_at,
    'created_by',     v_row.created_by,
    'workspace',      jsonb_build_object('id', v_row.workspace_id, 'name', v_row.workspace_name)
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- ✅ Listo. Recarga el CRM en el navegador y tus datos estarán de vuelta.
-- ══════════════════════════════════════════════════════════════════════
