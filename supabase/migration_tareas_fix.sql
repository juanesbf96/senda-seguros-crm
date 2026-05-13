-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Fix tabla tareas
-- Agrega columnas faltantes: descripcion, prioridad, asignado_a, updated_at
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS descripcion  TEXT,
  ADD COLUMN IF NOT EXISTS prioridad    TEXT NOT NULL DEFAULT 'normal'
                                        CHECK (prioridad IN ('normal','alta','urgente')),
  ADD COLUMN IF NOT EXISTS asignado_a   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tareas_updated_at ON tareas;
CREATE TRIGGER tareas_updated_at
  BEFORE UPDATE ON tareas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Verificar
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tareas'
ORDER BY ordinal_position;
