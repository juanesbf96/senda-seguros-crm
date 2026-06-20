-- ============================================================
-- Nuevas columnas para estado de comisión recibida y pago asesor
-- ============================================================

ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS comision_recibida   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS asesor_pago_estado  text;   -- 'pagada' | 'pendiente' | 'no_aplica'

-- Migrar datos existentes:
-- Si fecha_pago_abc tiene valor → marcar comision_recibida = true
UPDATE polizas
  SET comision_recibida = true
  WHERE fecha_pago_abc IS NOT NULL AND comision_recibida = false;
