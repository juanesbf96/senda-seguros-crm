-- ============================================================
-- Afiliados en Pólizas Colectivas
-- Aplica en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Agregar 'grupo_familiar' al CHECK constraint de clientes ──────────────

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Buscar el nombre real del constraint de tipo_cliente
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'clientes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%tipo_cliente%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE clientes DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

ALTER TABLE clientes
  ADD CONSTRAINT clientes_tipo_cliente_check
  CHECK (tipo_cliente IN ('persona_natural', 'empresa', 'consorcio', 'grupo_familiar'));


-- ── 2. Nuevas columnas en polizas ────────────────────────────────────────────

ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS es_colectiva       BOOLEAN      DEFAULT false,
  ADD COLUMN IF NOT EXISTS prima_por_afiliado NUMERIC(14,2);


-- ── 3. Nueva tabla poliza_afiliados ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS poliza_afiliados (
  id                       UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id             UUID         NOT NULL REFERENCES workspaces(id)        ON DELETE CASCADE,
  poliza_id                UUID         NOT NULL REFERENCES polizas(id)           ON DELETE CASCADE,
  cliente_id               UUID                  REFERENCES clientes(id)          ON DELETE SET NULL,

  -- Datos del afiliado
  nombre_completo          TEXT         NOT NULL,
  numero_documento         TEXT         NOT NULL,
  fecha_nacimiento         DATE,                        -- OPCIONAL
  fecha_inicio             DATE         NOT NULL,       -- OBLIGATORIO
  fecha_retiro             DATE,                        -- Se llena al inactivar
  numero_poliza_individual TEXT,                        -- Número propio del afiliado (opcional)
  parentesco               TEXT,                        -- Obligatorio para grupo_familiar, opcional para empresa
  activo                   BOOLEAN      NOT NULL DEFAULT true,
  notas                    TEXT,

  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_poliza_afiliados_poliza    ON poliza_afiliados(poliza_id);
CREATE INDEX IF NOT EXISTS idx_poliza_afiliados_workspace ON poliza_afiliados(workspace_id);
CREATE INDEX IF NOT EXISTS idx_poliza_afiliados_documento ON poliza_afiliados(numero_documento);
CREATE INDEX IF NOT EXISTS idx_poliza_afiliados_activo    ON poliza_afiliados(activo);
CREATE INDEX IF NOT EXISTS idx_poliza_afiliados_cliente   ON poliza_afiliados(cliente_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_poliza_afiliados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS poliza_afiliados_updated_at ON poliza_afiliados;
CREATE TRIGGER poliza_afiliados_updated_at
  BEFORE UPDATE ON poliza_afiliados
  FOR EACH ROW EXECUTE FUNCTION update_poliza_afiliados_updated_at();


-- ── 4. RLS en poliza_afiliados ───────────────────────────────────────────────

ALTER TABLE poliza_afiliados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS afiliados_select ON poliza_afiliados;
DROP POLICY IF EXISTS afiliados_insert ON poliza_afiliados;
DROP POLICY IF EXISTS afiliados_update ON poliza_afiliados;
DROP POLICY IF EXISTS afiliados_delete ON poliza_afiliados;

CREATE POLICY afiliados_select ON poliza_afiliados
  FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY afiliados_insert ON poliza_afiliados
  FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY afiliados_update ON poliza_afiliados
  FOR UPDATE USING (is_workspace_member(workspace_id));

CREATE POLICY afiliados_delete ON poliza_afiliados
  FOR DELETE USING (is_workspace_member(workspace_id));


-- ── 5. Campo opcional afiliado_id en siniestros ──────────────────────────────

ALTER TABLE siniestros
  ADD COLUMN IF NOT EXISTS afiliado_id UUID REFERENCES poliza_afiliados(id) ON DELETE SET NULL;


-- ── 6. Nuevos permisos RBAC ──────────────────────────────────────────────────

INSERT INTO default_permissions (role, permission_key, enabled, label, category, description)
VALUES
  ('supervisor', 'afiliados_ver',              true,  'Ver afiliados',                     'Afiliados', NULL),
  ('supervisor', 'afiliados_gestionar',         true,  'Agregar e inactivar afiliados',      'Afiliados', NULL),
  ('supervisor', 'afiliados_gestionar_propios', true,  'Gestionar afiliados propios',        'Afiliados', NULL),
  ('agente',     'afiliados_ver',              true,  'Ver afiliados',                     'Afiliados', NULL),
  ('agente',     'afiliados_gestionar',         false, 'Agregar e inactivar afiliados',      'Afiliados', NULL),
  ('agente',     'afiliados_gestionar_propios', true,  'Gestionar afiliados propios',        'Afiliados', NULL)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Propagar nuevos permisos a workspaces existentes
INSERT INTO workspace_permissions (workspace_id, role, permission_key, enabled, updated_at)
SELECT
  w.id,
  dp.role,
  dp.permission_key,
  dp.enabled,
  NOW()
FROM default_permissions dp
CROSS JOIN workspaces w
WHERE dp.permission_key IN ('afiliados_ver', 'afiliados_gestionar', 'afiliados_gestionar_propios')
ON CONFLICT (workspace_id, role, permission_key) DO NOTHING;
