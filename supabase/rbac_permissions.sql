-- =============================================================
-- RBAC: Permisos por rol y workspace (configurable por admin)
-- Aplicar en Supabase SQL Editor
-- =============================================================

-- 1. Tabla de permisos
-- =============================================================
CREATE TABLE IF NOT EXISTS workspace_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('agente', 'supervisor')),
  permission_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (workspace_id, role, permission_key)
);

-- 2. RLS
-- =============================================================
ALTER TABLE workspace_permissions ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer/modificar — pero usaremos RPCs SECURITY DEFINER
-- para todo acceso, así evitamos recursividad de RLS.
CREATE POLICY "wp_admin_all" ON workspace_permissions
  FOR ALL
  USING (false)  -- bloquear acceso directo; todo va por RPC
  WITH CHECK (false);

-- 3. Tabla de permisos por defecto (inmutable — referencia)
-- =============================================================
CREATE TABLE IF NOT EXISTS default_permissions (
  role text NOT NULL CHECK (role IN ('agente', 'supervisor')),
  permission_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  label text NOT NULL,
  category text NOT NULL,
  description text,
  PRIMARY KEY (role, permission_key)
);

-- Sin RLS — es lectura pública (datos de referencia)
ALTER TABLE default_permissions DISABLE ROW LEVEL SECURITY;

-- 4. Insertar permisos por defecto
-- =============================================================
INSERT INTO default_permissions (role, permission_key, enabled, label, category, description) VALUES

-- ── CLIENTES ─────────────────────────────────────────────────
('supervisor', 'clientes_ver_todos',       true,  'Ver todos los clientes',         'Clientes', NULL),
('supervisor', 'clientes_crear',           true,  'Crear clientes',                 'Clientes', NULL),
('supervisor', 'clientes_editar_todos',    true,  'Editar cualquier cliente',        'Clientes', NULL),
('supervisor', 'clientes_eliminar',        true,  'Eliminar clientes',              'Clientes', NULL),

('agente',     'clientes_ver_todos',       true,  'Ver todos los clientes',         'Clientes', 'El agente ve clientes de toda la agencia'),
('agente',     'clientes_crear',           true,  'Crear clientes',                 'Clientes', NULL),
('agente',     'clientes_editar_propios',  true,  'Editar clientes propios',        'Clientes', 'Solo editar los que él/ella creó'),
('agente',     'clientes_editar_todos',    false, 'Editar cualquier cliente',       'Clientes', NULL),
('agente',     'clientes_eliminar',        false, 'Eliminar clientes',              'Clientes', NULL),

-- ── PÓLIZAS ──────────────────────────────────────────────────
('supervisor', 'polizas_ver',             true,  'Ver pólizas',                    'Pólizas', NULL),
('supervisor', 'polizas_crear',           true,  'Crear pólizas',                  'Pólizas', NULL),
('supervisor', 'polizas_editar',          true,  'Editar pólizas',                 'Pólizas', NULL),
('supervisor', 'polizas_eliminar',        true,  'Eliminar pólizas',               'Pólizas', NULL),

('agente',     'polizas_ver',             true,  'Ver pólizas',                    'Pólizas', NULL),
('agente',     'polizas_crear',           true,  'Crear pólizas',                  'Pólizas', NULL),
('agente',     'polizas_editar',          true,  'Editar pólizas',                 'Pólizas', NULL),
('agente',     'polizas_eliminar',        false, 'Eliminar pólizas',               'Pólizas', NULL),

-- ── TAREAS ───────────────────────────────────────────────────
('supervisor', 'tareas_ver_todas',        true,  'Ver todas las tareas',           'Tareas', NULL),
('supervisor', 'tareas_crear',            true,  'Crear tareas',                   'Tareas', NULL),
('supervisor', 'tareas_editar_todas',     true,  'Editar/completar cualquier tarea','Tareas', NULL),
('supervisor', 'tareas_asignar',          true,  'Asignar tareas a otros',         'Tareas', NULL),

('agente',     'tareas_ver_todas',        true,  'Ver todas las tareas',           'Tareas', NULL),
('agente',     'tareas_crear',            true,  'Crear tareas',                   'Tareas', NULL),
('agente',     'tareas_completar_propias',true,  'Completar tareas propias',       'Tareas', NULL),
('agente',     'tareas_editar_todas',     false, 'Editar/completar cualquier tarea','Tareas', NULL),
('agente',     'tareas_asignar',          false, 'Asignar tareas a otros',         'Tareas', NULL),

-- ── FINANZAS / COBROS ────────────────────────────────────────
('supervisor', 'finanzas_cobros_ver',         true,  'Ver cobros',                     'Finanzas', NULL),
('supervisor', 'finanzas_cobros_registrar',   true,  'Registrar cobros',               'Finanzas', NULL),
('supervisor', 'finanzas_liquidaciones_ver',  true,  'Ver liquidaciones',              'Finanzas', NULL),
('supervisor', 'finanzas_liquidaciones_crear',true,  'Crear/editar liquidaciones',     'Finanzas', NULL),
('supervisor', 'finanzas_caja_ver_todas',     true,  'Ver caja de todos',              'Finanzas', NULL),

('agente',     'finanzas_cobros_ver',         true,  'Ver cobros',                     'Finanzas', NULL),
('agente',     'finanzas_cobros_registrar',   true,  'Registrar cobros propios',       'Finanzas', 'Solo puede registrar sus propios cobros'),
('agente',     'finanzas_liquidaciones_ver',  true,  'Ver liquidaciones',              'Finanzas', NULL),
('agente',     'finanzas_liquidaciones_crear',true,  'Crear/editar liquidaciones',     'Finanzas', NULL),
('agente',     'finanzas_caja_ver_propias',   true,  'Ver su propia caja',             'Finanzas', NULL),
('agente',     'finanzas_caja_ver_todas',     false, 'Ver caja de todos',              'Finanzas', NULL),

-- ── SINIESTROS ───────────────────────────────────────────────
('supervisor', 'siniestros_ver',          true,  'Ver siniestros',                 'Siniestros', NULL),
('supervisor', 'siniestros_crear',        true,  'Crear siniestros',               'Siniestros', NULL),
('supervisor', 'siniestros_editar_todos', true,  'Editar cualquier siniestro',     'Siniestros', NULL),

('agente',     'siniestros_ver',          true,  'Ver siniestros',                 'Siniestros', NULL),
('agente',     'siniestros_crear',        true,  'Crear siniestros',               'Siniestros', NULL),
('agente',     'siniestros_editar_todos', false, 'Editar cualquier siniestro',     'Siniestros', 'Solo puede editar los propios'),

-- ── SOLICITUDES ──────────────────────────────────────────────
('supervisor', 'solicitudes_ver',              true,  'Ver solicitudes',                    'Solicitudes', NULL),
('supervisor', 'solicitudes_crear',            true,  'Crear solicitudes',                  'Solicitudes', NULL),
('supervisor', 'solicitudes_aprobar_todas',    true,  'Aprobar/cambiar estado de cualquier solicitud', 'Solicitudes', NULL),

('agente',     'solicitudes_ver',              true,  'Ver solicitudes',                    'Solicitudes', NULL),
('agente',     'solicitudes_crear',            true,  'Crear solicitudes',                  'Solicitudes', NULL),
('agente',     'solicitudes_aprobar_propias',  true,  'Aprobar/cambiar estado de las propias','Solicitudes', NULL),
('agente',     'solicitudes_aprobar_todas',    false, 'Aprobar/cambiar estado de cualquier solicitud','Solicitudes', NULL),

-- ── METAS ────────────────────────────────────────────────────
('supervisor', 'metas_ver',              true,  'Ver metas',                      'Metas', NULL),
('supervisor', 'metas_crear_editar',     true,  'Crear/editar metas',             'Metas', NULL),
('supervisor', 'metas_ver_metricas',     true,  'Ver métricas de todos los agentes','Metas', NULL),

('agente',     'metas_ver',              true,  'Ver metas',                      'Metas', NULL),
('agente',     'metas_crear_editar',     false, 'Crear/editar metas',             'Metas', NULL),
('agente',     'metas_ver_metricas',     false, 'Ver métricas de otros agentes',  'Metas', NULL),

-- ── DASHBOARD ────────────────────────────────────────────────
('supervisor', 'dashboard_ver_global',   true,  'Ver métricas globales',          'Dashboard', NULL),
('supervisor', 'dashboard_ver_propias',  true,  'Ver métricas propias',           'Dashboard', NULL),

('agente',     'dashboard_ver_global',   true,  'Ver métricas globales',          'Dashboard', NULL),
('agente',     'dashboard_ver_propias',  true,  'Ver métricas propias',           'Dashboard', NULL),

-- ── CONFIGURACIÓN ────────────────────────────────────────────
('supervisor', 'configuracion_ver',              true,  'Ver configuración general',      'Configuración', NULL),
('supervisor', 'configuracion_editar_agencia',   false, 'Editar datos de la agencia',     'Configuración', NULL),
('supervisor', 'configuracion_workspace_miembros',true, 'Ver Workspace y Miembros',       'Configuración', NULL),

('agente',     'configuracion_ver',              true,  'Ver configuración general',      'Configuración', NULL),
('agente',     'configuracion_editar_agencia',   false, 'Editar datos de la agencia',     'Configuración', NULL),
('agente',     'configuracion_workspace_miembros',true, 'Ver Workspace y Miembros',       'Configuración', NULL),

-- ── PIPELINE / PROSPECTOS ────────────────────────────────────
('supervisor', 'pipeline_ver',              true,  'Ver prospectos/pipeline',        'Pipeline', NULL),
('supervisor', 'pipeline_mover_todos',      true,  'Mover cualquier prospecto',      'Pipeline', NULL),
('supervisor', 'pipeline_eliminar_todos',   true,  'Eliminar cualquier prospecto',   'Pipeline', NULL),

('agente',     'pipeline_ver',              true,  'Ver prospectos/pipeline',        'Pipeline', NULL),
('agente',     'pipeline_mover_propios',    true,  'Mover prospectos propios',       'Pipeline', NULL),
('agente',     'pipeline_mover_todos',      false, 'Mover cualquier prospecto',      'Pipeline', NULL),
('agente',     'pipeline_eliminar_propios', true,  'Eliminar prospectos propios',    'Pipeline', NULL),
('agente',     'pipeline_eliminar_todos',   false, 'Eliminar cualquier prospecto',   'Pipeline', NULL)

ON CONFLICT (role, permission_key) DO NOTHING;

-- 5. RPC: Obtener permisos efectivos para el workspace
-- (combina defaults con overrides del workspace)
-- =============================================================
CREATE OR REPLACE FUNCTION get_workspace_permissions(p_workspace_id uuid)
RETURNS TABLE (
  role text,
  permission_key text,
  enabled boolean,
  label text,
  category text,
  description text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
BEGIN
  -- Solo admins pueden ver/gestionar permisos
  SELECT wm.role INTO v_role
  FROM workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = v_user_id;

  IF v_role IS NULL THEN
    -- Verificar si es owner
    IF NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id AND w.owner_id = v_user_id) THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
  END IF;

  -- Retornar defaults con override del workspace aplicado
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

-- RPC: Obtener permisos del usuario actual en el workspace actual
CREATE OR REPLACE FUNCTION get_my_permissions(p_workspace_id uuid)
RETURNS TABLE (permission_key text, enabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_is_owner boolean := false;
BEGIN
  -- Verificar owner
  SELECT EXISTS(
    SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id AND w.owner_id = v_user_id
  ) INTO v_is_owner;

  IF v_is_owner THEN
    -- Admin/owner: devolver todos como enabled
    RETURN QUERY
      SELECT dp.permission_key, true::boolean
      FROM default_permissions dp
      GROUP BY dp.permission_key;
    RETURN;
  END IF;

  -- Obtener rol
  SELECT wm.role INTO v_role
  FROM workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = v_user_id;

  IF v_role IS NULL OR v_role = 'admin' THEN
    -- Admin: todo permitido
    RETURN QUERY
      SELECT dp.permission_key, true::boolean
      FROM default_permissions dp
      GROUP BY dp.permission_key;
    RETURN;
  END IF;

  -- Supervisor o Agente: retornar permisos efectivos para su rol
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

-- RPC: Actualizar permiso (solo admin)
CREATE OR REPLACE FUNCTION update_workspace_permission(
  p_workspace_id uuid,
  p_role text,
  p_permission_key text,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_caller_role text;
  v_is_owner boolean := false;
BEGIN
  -- Solo admin/owner puede modificar permisos
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

  -- Upsert permiso
  INSERT INTO workspace_permissions (workspace_id, role, permission_key, enabled, updated_at)
  VALUES (p_workspace_id, p_role, p_permission_key, p_enabled, now())
  ON CONFLICT (workspace_id, role, permission_key)
  DO UPDATE SET enabled = p_enabled, updated_at = now();
END;
$$;

-- RPC: Resetear permisos de un rol a sus defaults
CREATE OR REPLACE FUNCTION reset_role_permissions(
  p_workspace_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 6. Grants
-- =============================================================
GRANT EXECUTE ON FUNCTION get_workspace_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_workspace_permission(uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_role_permissions(uuid, text) TO authenticated;
