-- ══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Multi-workspace para Senda Seguros CRM
-- Roles: admin | supervisor | agente
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. TABLAS NUEVAS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  owner_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  slug             text UNIQUE,
  setup_completed  boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('admin', 'supervisor', 'agente')),
  invited_by    uuid REFERENCES auth.users(id),
  joined_at     timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  email         text NOT NULL,
  role          text NOT NULL CHECK (role IN ('admin', 'supervisor', 'agente')),
  token         text UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at    timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at   timestamptz,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_integrations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  provider       text NOT NULL,
  credentials    jsonb,
  is_active      boolean DEFAULT false,
  connected_by   uuid REFERENCES auth.users(id),
  connected_at   timestamptz,
  updated_at     timestamptz DEFAULT now()
);

-- ── 2. FUNCIONES HELPER ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_admin(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_workspace_supervisor(ws_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role IN ('admin','supervisor')
  );
$$;

CREATE OR REPLACE FUNCTION get_user_workspace_role(ws_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM workspace_members
  WHERE workspace_id = ws_id AND user_id = auth.uid()
  LIMIT 1;
$$;

-- ── 3. COLUMNAS workspace_id + created_by EN TABLAS EXISTENTES ────────
-- Se agregan como NULLABLE para no romper datos actuales.
-- Después de migrar datos se pondrán NOT NULL (paso posterior).

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'actividades','agenda_eventos','amparos_siniestro','archivos',
    'campanas_renovacion','clientes','cobros','configuracion',
    'contactos','dashboards_custom','diligencia_tareas','diligencias',
    'facturas','gestiones_renovacion','liquidaciones','metas',
    'poliza_anexos','poliza_vinculados','polizas','prospecto_actividades',
    'prospectos','recibos','remisiones','siniestro_amparos','siniestros',
    'solicitudes','tareas','vendedores'
  ]
  LOOP
    -- workspace_id
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id)', t
    );
    -- created_by (quién creó el registro — necesario para rol agente)
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id)', t
    );
  END LOOP;
END $$;

-- ── 4. ÍNDICES ───────────────────────────────────────────────────────

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'actividades','agenda_eventos','archivos','campanas_renovacion',
    'clientes','cobros','contactos','diligencias','facturas',
    'liquidaciones','metas','polizas','prospectos','recibos',
    'remisiones','siniestros','solicitudes','tareas','vendedores'
  ]
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_workspace ON %I (workspace_id)', t, t
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspace_members_user    ON workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_ws      ON workspace_members (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_tok ON workspace_invitations (token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_ws  ON workspace_invitations (workspace_id);

-- ── 5. TRIGGER: workspace por defecto al registrarse ─────────────────
-- Crea workspace con nombre "[nombre] Workspace" + agrega al usuario como admin.
-- El usuario puede renombrarlo en el onboarding.

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
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── 6. RLS EN TABLAS NUEVAS ──────────────────────────────────────────

-- workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ws_select"  ON workspaces;
DROP POLICY IF EXISTS "ws_insert"  ON workspaces;
DROP POLICY IF EXISTS "ws_update"  ON workspaces;
DROP POLICY IF EXISTS "ws_delete"  ON workspaces;

CREATE POLICY "ws_select" ON workspaces FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "ws_insert" ON workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "ws_update" ON workspaces FOR UPDATE
  USING (is_workspace_admin(id));

CREATE POLICY "ws_delete" ON workspaces FOR DELETE
  USING (owner_id = auth.uid());

-- workspace_members
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wm_select" ON workspace_members;
DROP POLICY IF EXISTS "wm_insert" ON workspace_members;
DROP POLICY IF EXISTS "wm_update" ON workspace_members;
DROP POLICY IF EXISTS "wm_delete" ON workspace_members;

CREATE POLICY "wm_select" ON workspace_members FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "wm_insert" ON workspace_members FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "wm_update" ON workspace_members FOR UPDATE
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "wm_delete" ON workspace_members FOR DELETE
  USING (is_workspace_admin(workspace_id));

-- workspace_invitations
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wi_select" ON workspace_invitations;
DROP POLICY IF EXISTS "wi_insert" ON workspace_invitations;
DROP POLICY IF EXISTS "wi_update" ON workspace_invitations;
DROP POLICY IF EXISTS "wi_delete" ON workspace_invitations;

CREATE POLICY "wi_select" ON workspace_invitations FOR SELECT
  USING (is_workspace_member(workspace_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "wi_insert" ON workspace_invitations FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "wi_update" ON workspace_invitations FOR UPDATE
  USING (is_workspace_admin(workspace_id)
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "wi_delete" ON workspace_invitations FOR DELETE
  USING (is_workspace_admin(workspace_id));

-- workspace_integrations
ALTER TABLE workspace_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wint_select" ON workspace_integrations;
DROP POLICY IF EXISTS "wint_insert" ON workspace_integrations;
DROP POLICY IF EXISTS "wint_update" ON workspace_integrations;
DROP POLICY IF EXISTS "wint_delete" ON workspace_integrations;

CREATE POLICY "wint_select" ON workspace_integrations FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "wint_insert" ON workspace_integrations FOR INSERT
  WITH CHECK (is_workspace_admin(workspace_id));

CREATE POLICY "wint_update" ON workspace_integrations FOR UPDATE
  USING (is_workspace_admin(workspace_id));

CREATE POLICY "wint_delete" ON workspace_integrations FOR DELETE
  USING (is_workspace_admin(workspace_id));

-- ── 7. MIGRAR DATOS EXISTENTES ────────────────────────────────────────
-- Los datos actuales se asignan al workspace del primer admin encontrado.
-- Ajustar manualmente si hay múltiples usuarios.

DO $$
DECLARE
  target_ws uuid;
BEGIN
  -- Tomar el primer workspace existente (del admin actual)
  SELECT id INTO target_ws FROM workspaces LIMIT 1;

  IF target_ws IS NOT NULL THEN
    UPDATE actividades          SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE agenda_eventos       SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE amparos_siniestro    SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE archivos             SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE campanas_renovacion  SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE clientes             SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE cobros               SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE configuracion        SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE contactos            SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE dashboards_custom    SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE diligencia_tareas    SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE diligencias          SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE facturas             SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE gestiones_renovacion SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE liquidaciones        SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE metas                SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE poliza_anexos        SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE poliza_vinculados    SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE polizas              SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE prospecto_actividades SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE prospectos           SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE recibos              SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE remisiones           SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE siniestro_amparos    SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE siniestros           SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE solicitudes          SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE tareas               SET workspace_id = target_ws WHERE workspace_id IS NULL;
    UPDATE vendedores           SET workspace_id = target_ws WHERE workspace_id IS NULL;

    -- Marcar workspace como configurado (ya existe el admin)
    UPDATE workspaces SET setup_completed = true WHERE id = target_ws;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════════
-- FASE 2 (ejecutar DESPUÉS de que el frontend esté actualizado):
-- Activar políticas de workspace en tablas existentes.
-- Ver archivo: migration_multiworkspace_fase2.sql
-- ══════════════════════════════════════════════════════════════════════
