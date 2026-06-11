-- ============================================================
-- Afiliados v2: Planes por póliza + prima individual + tipo_documento
-- Aplica en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Nueva tabla poliza_planes ─────────────────────────────────────────────
-- Catálogo de planes dentro de una póliza colectiva (especialmente Vida Grupo).
-- Cada plan tiene nombre y valor de cobertura.
-- La prima del plan = SUM(prima_individual) de afiliados activos en ese plan.

CREATE TABLE IF NOT EXISTS poliza_planes (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     UUID         NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  poliza_id        UUID         NOT NULL REFERENCES polizas(id)      ON DELETE CASCADE,
  nombre           TEXT         NOT NULL,
  valor_cobertura  NUMERIC(14,2),
  prima_plan       NUMERIC(14,2) DEFAULT 0,   -- calculada: SUM(prima_individual activos)
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poliza_planes_poliza    ON poliza_planes(poliza_id);
CREATE INDEX IF NOT EXISTS idx_poliza_planes_workspace ON poliza_planes(workspace_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_poliza_planes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS poliza_planes_updated_at ON poliza_planes;
CREATE TRIGGER poliza_planes_updated_at
  BEFORE UPDATE ON poliza_planes
  FOR EACH ROW EXECUTE FUNCTION update_poliza_planes_updated_at();

-- RLS
ALTER TABLE poliza_planes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planes_select ON poliza_planes;
DROP POLICY IF EXISTS planes_insert ON poliza_planes;
DROP POLICY IF EXISTS planes_update ON poliza_planes;
DROP POLICY IF EXISTS planes_delete ON poliza_planes;

CREATE POLICY planes_select ON poliza_planes FOR SELECT USING (is_workspace_member(workspace_id));
CREATE POLICY planes_insert ON poliza_planes FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY planes_update ON poliza_planes FOR UPDATE USING (is_workspace_member(workspace_id));
CREATE POLICY planes_delete ON poliza_planes FOR DELETE USING (is_workspace_member(workspace_id));


-- ── 2. Cambios en poliza_afiliados ───────────────────────────────────────────

ALTER TABLE poliza_afiliados
  -- Plan al que pertenece (solo Vida Grupo u otras con planes; NULL = sin plan)
  ADD COLUMN IF NOT EXISTS plan_id          UUID    REFERENCES poliza_planes(id) ON DELETE SET NULL,
  -- Prima propia del afiliado (puede diferir entre afiliados del mismo plan)
  ADD COLUMN IF NOT EXISTS prima_individual NUMERIC(14,2),
  -- Tipo de documento (dropdown estandarizado)
  ADD COLUMN IF NOT EXISTS tipo_documento   TEXT    NOT NULL DEFAULT 'CC';

CREATE INDEX IF NOT EXISTS idx_poliza_afiliados_plan ON poliza_afiliados(plan_id);


-- ── 3. Nueva tabla afiliado_cambios_plan ─────────────────────────────────────
-- Historial de cambios de plan de un afiliado.

CREATE TABLE IF NOT EXISTS afiliado_cambios_plan (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  afiliado_id      UUID         NOT NULL REFERENCES poliza_afiliados(id) ON DELETE CASCADE,
  plan_anterior_id UUID                  REFERENCES poliza_planes(id)    ON DELETE SET NULL,
  plan_nuevo_id    UUID                  REFERENCES poliza_planes(id)    ON DELETE SET NULL,
  prima_anterior   NUMERIC(14,2),
  prima_nueva      NUMERIC(14,2),
  fecha_cambio     DATE         NOT NULL DEFAULT CURRENT_DATE,
  notas            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cambios_plan_afiliado ON afiliado_cambios_plan(afiliado_id);

-- RLS
ALTER TABLE afiliado_cambios_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cambios_plan_select ON afiliado_cambios_plan;
DROP POLICY IF EXISTS cambios_plan_insert ON afiliado_cambios_plan;

CREATE POLICY cambios_plan_select ON afiliado_cambios_plan
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM poliza_afiliados pa
      JOIN polizas p ON p.id = pa.poliza_id
      WHERE pa.id = afiliado_cambios_plan.afiliado_id
        AND is_workspace_member(p.workspace_id)
    )
  );

CREATE POLICY cambios_plan_insert ON afiliado_cambios_plan
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM poliza_afiliados pa
      JOIN polizas p ON p.id = pa.poliza_id
      WHERE pa.id = afiliado_cambios_plan.afiliado_id
        AND is_workspace_member(p.workspace_id)
    )
  );
