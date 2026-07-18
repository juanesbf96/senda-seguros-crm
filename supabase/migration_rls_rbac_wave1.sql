-- ══════════════════════════════════════════════════════════════════════
-- RLS + RBAC — Ola 1: llevar los permisos configurables a la base de datos
--
-- PROBLEMA QUE RESUELVE:
--   Las políticas RLS actuales (migration_multiworkspace_fase2.sql) verifican
--   el rol hardcodeado (admin/supervisor) pero IGNORAN la tabla
--   workspace_permissions. Si el admin desactiva "Eliminar pólizas" para
--   supervisor en Configuración → Permisos, la UI oculta el botón pero el
--   supervisor puede seguir borrando directamente contra la API de Supabase
--   (el anon key es público por diseño). Además, la política de UPDATE
--   permite a cualquier agente editar registros con created_by IS NULL —
--   el estado de todos los datos importados por Excel.
--
-- ALCANCE (ola 1 — solo lo crítico):
--   - Función has_permission() que respeta defaults + overrides del workspace
--   - polizas:        UPDATE / DELETE por permiso
--   - clientes:       UPDATE / DELETE por permiso
--   - prospectos:     DELETE por permiso (todos vs propios)
--   - cobros:         SELECT / INSERT por permiso; DELETE solo admin
--   - liquidaciones:  SELECT / INSERT / UPDATE por permiso; DELETE solo admin
--   - configuracion:  INSERT / UPDATE / DELETE por permiso
--   El resto de tablas conserva las políticas de fase 2 (ola 2 pendiente).
--
-- IDEMPOTENTE: se puede ejecutar varias veces sin efectos secundarios.
-- APLICAR EN: Supabase Dashboard → SQL Editor (staging primero si existe).
-- ══════════════════════════════════════════════════════════════════════


-- ── 1. Función central: ¿tiene el usuario actual este permiso? ─────────
-- SECURITY DEFINER: bypasea RLS internamente (mismo patrón que
-- is_workspace_member), evita recursión de políticas.
-- Reglas:
--   - owner del workspace  → true (equivale a admin)
--   - rol admin            → true
--   - supervisor / agente  → COALESCE(override del workspace, default del rol)
--   - no miembro           → false

CREATE OR REPLACE FUNCTION has_permission(ws_id uuid, perm_key text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
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

GRANT EXECUTE ON FUNCTION has_permission(uuid, text) TO authenticated;


-- ── 2. PÓLIZAS ──────────────────────────────────────────────────────────
-- SELECT/INSERT quedan como en fase 2 (membresía). UPDATE/DELETE por permiso.

DROP POLICY IF EXISTS "polizas_update" ON polizas;
CREATE POLICY "polizas_update" ON polizas FOR UPDATE
  USING (has_permission(workspace_id, 'polizas_editar'));

DROP POLICY IF EXISTS "polizas_delete" ON polizas;
CREATE POLICY "polizas_delete" ON polizas FOR DELETE
  USING (has_permission(workspace_id, 'polizas_eliminar'));


-- ── 3. CLIENTES ─────────────────────────────────────────────────────────
-- UPDATE: editar_todos, o editar_propios sobre registros propios.
-- Los registros con created_by IS NULL (imports masivos, datos legacy) se
-- tratan como "sin dueño": editables por quien tenga editar_propios, para
-- no bloquear la operación diaria sobre datos importados. Endurecer en ola 2
-- si se asigna created_by en el import.

DROP POLICY IF EXISTS "clientes_update" ON clientes;
CREATE POLICY "clientes_update" ON clientes FOR UPDATE
  USING (
    has_permission(workspace_id, 'clientes_editar_todos')
    OR (
      has_permission(workspace_id, 'clientes_editar_propios')
      AND (created_by = auth.uid() OR created_by IS NULL)
    )
  );

DROP POLICY IF EXISTS "clientes_delete" ON clientes;
CREATE POLICY "clientes_delete" ON clientes FOR DELETE
  USING (has_permission(workspace_id, 'clientes_eliminar'));


-- ── 4. PROSPECTOS (pipeline) ────────────────────────────────────────────
-- DELETE: eliminar_todos, o eliminar_propios sobre los propios.

DROP POLICY IF EXISTS "prospectos_delete" ON prospectos;
CREATE POLICY "prospectos_delete" ON prospectos FOR DELETE
  USING (
    has_permission(workspace_id, 'pipeline_eliminar_todos')
    OR (
      has_permission(workspace_id, 'pipeline_eliminar_propios')
      AND created_by = auth.uid()
    )
  );


-- ── 5. COBROS ───────────────────────────────────────────────────────────
-- SELECT/INSERT por permiso (defaults actuales: true para ambos roles, así
-- que no cambia el comportamiento hasta que el admin lo desactive).
-- DELETE: no existe clave de permiso para borrar cobros → solo admin
-- (registro financiero; borrarlo es destructivo).

DROP POLICY IF EXISTS "cobros_select" ON cobros;
CREATE POLICY "cobros_select" ON cobros FOR SELECT
  USING (has_permission(workspace_id, 'finanzas_cobros_ver'));

DROP POLICY IF EXISTS "cobros_insert" ON cobros;
CREATE POLICY "cobros_insert" ON cobros FOR INSERT
  WITH CHECK (has_permission(workspace_id, 'finanzas_cobros_registrar'));

DROP POLICY IF EXISTS "cobros_delete" ON cobros;
CREATE POLICY "cobros_delete" ON cobros FOR DELETE
  USING (is_workspace_admin(workspace_id));


-- ── 6. LIQUIDACIONES ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "liquidaciones_select" ON liquidaciones;
CREATE POLICY "liquidaciones_select" ON liquidaciones FOR SELECT
  USING (has_permission(workspace_id, 'finanzas_liquidaciones_ver'));

DROP POLICY IF EXISTS "liquidaciones_insert" ON liquidaciones;
CREATE POLICY "liquidaciones_insert" ON liquidaciones FOR INSERT
  WITH CHECK (has_permission(workspace_id, 'finanzas_liquidaciones_crear'));

DROP POLICY IF EXISTS "liquidaciones_update" ON liquidaciones;
CREATE POLICY "liquidaciones_update" ON liquidaciones FOR UPDATE
  USING (has_permission(workspace_id, 'finanzas_liquidaciones_crear'));

DROP POLICY IF EXISTS "liquidaciones_delete" ON liquidaciones;
CREATE POLICY "liquidaciones_delete" ON liquidaciones FOR DELETE
  USING (is_workspace_admin(workspace_id));


-- ── 7. CONFIGURACIÓN ────────────────────────────────────────────────────
-- La política de fase 2 permitía a cualquier agente modificar registros con
-- created_by IS NULL — que es el estado normal de las filas de configuración.
-- Ahora: solo quien tenga configuracion_editar_agencia (default: solo admin).

DROP POLICY IF EXISTS "configuracion_insert" ON configuracion;
CREATE POLICY "configuracion_insert" ON configuracion FOR INSERT
  WITH CHECK (has_permission(workspace_id, 'configuracion_editar_agencia'));

DROP POLICY IF EXISTS "configuracion_update" ON configuracion;
CREATE POLICY "configuracion_update" ON configuracion FOR UPDATE
  USING (has_permission(workspace_id, 'configuracion_editar_agencia'));

DROP POLICY IF EXISTS "configuracion_delete" ON configuracion;
CREATE POLICY "configuracion_delete" ON configuracion FOR DELETE
  USING (has_permission(workspace_id, 'configuracion_editar_agencia'));


-- ══════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (ejecutar después de aplicar)
-- ══════════════════════════════════════════════════════════════════════

-- a) La función existe y las políticas quedaron instaladas:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('polizas','clientes','prospectos','cobros','liquidaciones','configuracion')
-- ORDER BY tablename, cmd;

-- b) Probar como admin (debería retornar true):
-- SELECT has_permission('<workspace_id>', 'polizas_eliminar');

-- c) Prueba funcional (la definitiva): iniciar sesión en la app con una
--    cuenta AGENTE y ejecutar en la consola del navegador:
--
--    const { error } = await window.supabase  // o el cliente que exponga la app
--      .from('polizas').delete().eq('id', '<id de una póliza>')
--
--    Antes de esta migración: el DELETE pasaba si el agente era supervisor,
--    o fallaba solo por el hardcode admin/supervisor.
--    Después: falla (0 filas afectadas) salvo que el permiso
--    'polizas_eliminar' esté activo para su rol en ese workspace.
