-- ══════════════════════════════════════════════════════════════════════
-- FIX de drift de esquema: metas + solicitudes
--
-- Causa: estas tablas se definieron dos veces con CREATE TABLE IF NOT EXISTS
-- en migraciones distintas (migration_v2.sql corrió primero y ganó;
-- migration_s2/s8 quedaron como no-op). El código de la app (MetasModal,
-- SolicitudModal) se escribió contra el esquema nuevo, así que crear una
-- meta o una solicitud falla en producción con "column does not exist".
--
-- Ambas tablas están VACÍAS (0 filas en todos los workspaces), así que
-- alinear el esquema al código es de riesgo cero para los datos.
--
-- Esta migración: agrega las columnas faltantes y reemplaza los CHECK de
-- `tipo` (v2 los limitaba a valores obsoletos). Idempotente.
-- Aplicar en Supabase SQL Editor.
-- ══════════════════════════════════════════════════════════════════════


-- ── METAS ───────────────────────────────────────────────────────────────
-- Producción (v2) tiene: nombre, tipo(CHECK nuevas/renovadas), meta_prima_total,
-- fecha_inicio, fecha_fin, estado, created_at, workspace_id, created_by.
-- El código espera además: periodo, valor_meta, valor_actual, color,
-- descripcion, auto_calcular, updated_at, y tipo con el enum nuevo.

ALTER TABLE metas ADD COLUMN IF NOT EXISTS periodo       TEXT    NOT NULL DEFAULT 'mensual';
ALTER TABLE metas ADD COLUMN IF NOT EXISTS valor_meta    NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE metas ADD COLUMN IF NOT EXISTS valor_actual  NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE metas ADD COLUMN IF NOT EXISTS color         TEXT    NOT NULL DEFAULT '#10b981';
ALTER TABLE metas ADD COLUMN IF NOT EXISTS descripcion   TEXT;
ALTER TABLE metas ADD COLUMN IF NOT EXISTS auto_calcular BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE metas ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Reemplazar el CHECK de tipo (v2: 'nuevas'/'renovadas' → enum del código)
ALTER TABLE metas DROP CONSTRAINT IF EXISTS metas_tipo_check;
ALTER TABLE metas ADD  CONSTRAINT metas_tipo_check CHECK (tipo IN (
  'prima_total','clientes_nuevos','renovaciones','polizas_activas',
  'comisiones','cobros','personalizada'));

-- El default viejo de tipo era 'nuevas' (ya no válido); el código siempre
-- envía tipo explícito, pero se ajusta el default por coherencia.
ALTER TABLE metas ALTER COLUMN tipo SET DEFAULT 'personalizada';

-- Reemplazar el CHECK de periodo por si una corrida previa lo dejó
ALTER TABLE metas DROP CONSTRAINT IF EXISTS metas_periodo_check;
ALTER TABLE metas ADD  CONSTRAINT metas_periodo_check CHECK (periodo IN (
  'mensual','trimestral','anual','personalizado'));

-- Trigger updated_at (set_updated_at ya existe de migraciones previas)
DROP TRIGGER IF EXISTS metas_updated_at ON metas;
CREATE TRIGGER metas_updated_at BEFORE UPDATE ON metas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── SOLICITUDES ─────────────────────────────────────────────────────────
-- Producción (v2) tiene: numero_solicitud, client_id, tipo(CHECK
-- cotizacion/expedicion), estado, observaciones, asignado_a, ramo, riesgo,
-- created_at, workspace_id, created_by.
-- El código espera además: poliza_id, prioridad, descripcion, notas,
-- fecha_limite, updated_at, y tipo con el enum completo.

ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS poliza_id    UUID REFERENCES polizas(id) ON DELETE SET NULL;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS prioridad    TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS descripcion  TEXT;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS notas        TEXT;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS fecha_limite DATE;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_tipo_check;
ALTER TABLE solicitudes ADD  CONSTRAINT solicitudes_tipo_check CHECK (tipo IN (
  'cotizacion','expedicion','renovacion','endoso','cancelacion',
  'certificado','siniestro','inclusion','exclusion','otro'));

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_prioridad_check;
ALTER TABLE solicitudes ADD  CONSTRAINT solicitudes_prioridad_check CHECK (prioridad IN (
  'normal','urgente'));

-- El código usa estados nueva/en_proceso/resuelta/cancelada/inactiva; v2 no
-- tenía CHECK en estado y su default era 'activa'. Se ajusta el default a
-- 'nueva' (el código siempre lo envía explícito).
ALTER TABLE solicitudes ALTER COLUMN estado SET DEFAULT 'nueva';

DROP TRIGGER IF EXISTS solicitudes_updated_at ON solicitudes;
CREATE TRIGGER solicitudes_updated_at BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Verificación sugerida (con tu sesión, tras aplicar):
--   INSERT de prueba desde la UI de Metas y de Solicitudes.
