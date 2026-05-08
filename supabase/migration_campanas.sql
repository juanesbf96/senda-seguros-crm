-- ============================================================
-- Migration: Campañas de Renovación
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS campanas_renovacion (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               text NOT NULL,
  descripcion          text,
  fecha_inicio_periodo date NOT NULL,
  fecha_fin_periodo    date NOT NULL,
  estado               text NOT NULL DEFAULT 'activa'
                         CHECK (estado IN ('activa', 'cerrada')),
  aseguradora          text,
  ramo                 text,
  notas                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_campanas_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campanas_updated_at ON campanas_renovacion;
CREATE TRIGGER trg_campanas_updated_at
  BEFORE UPDATE ON campanas_renovacion
  FOR EACH ROW EXECUTE FUNCTION update_campanas_updated_at();

-- RLS (allow all — single user app)
ALTER TABLE campanas_renovacion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON campanas_renovacion;
CREATE POLICY "allow_all" ON campanas_renovacion FOR ALL USING (true) WITH CHECK (true);

-- Verify
SELECT table_name FROM information_schema.tables WHERE table_name = 'campanas_renovacion';
