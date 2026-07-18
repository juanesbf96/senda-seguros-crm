-- =====================================================
-- migration_historial_comisiones.sql
-- Aplicar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Tabla de historial de comisiones por póliza
CREATE TABLE IF NOT EXISTS historial_comisiones_poliza (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  poliza_id        uuid NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
  colilla_id       uuid NOT NULL REFERENCES colillas_importacion(id) ON DELETE CASCADE,
  colilla_linea_id uuid REFERENCES colilla_lineas(id) ON DELETE SET NULL,
  periodo          text NOT NULL,        -- 'YYYY-MM'
  aseguradora      text NOT NULL,
  valor_anterior   numeric(15,2),        -- comision_agencia antes de confirmar
  valor_nuevo      numeric(15,2),        -- valor_comision de la línea de colilla
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historial_poliza     ON historial_comisiones_poliza(poliza_id);
CREATE INDEX IF NOT EXISTS idx_historial_colilla    ON historial_comisiones_poliza(colilla_id);
CREATE INDEX IF NOT EXISTS idx_historial_workspace  ON historial_comisiones_poliza(workspace_id);

ALTER TABLE historial_comisiones_poliza ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historial_comisiones_workspace_member" ON historial_comisiones_poliza;
CREATE POLICY "historial_comisiones_workspace_member"
  ON historial_comisiones_poliza FOR ALL
  USING     (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

-- 2. Actualizar confirmar_colilla: guarda historial y actualiza comision_agencia
CREATE OR REPLACE FUNCTION confirmar_colilla(
  p_colilla_id   uuid,
  p_workspace_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conciliadas     int;
  v_no_encontradas  int;
  v_corregidas      int;
  v_periodo         text;
  v_aseguradora     text;
BEGIN
  -- Verificar pertenencia y estado
  IF NOT EXISTS (
    SELECT 1 FROM colillas_importacion
    WHERE id = p_colilla_id
      AND workspace_id = p_workspace_id
      AND estado = 'borrador'
  ) THEN
    RAISE EXCEPTION 'Colilla no encontrada o ya confirmada';
  END IF;

  -- Obtener período y aseguradora de la colilla
  SELECT periodo, aseguradora
  INTO v_periodo, v_aseguradora
  FROM colillas_importacion
  WHERE id = p_colilla_id;

  -- Contadores por estado
  SELECT
    COUNT(*) FILTER (WHERE estado_conciliacion = 'conciliada'),
    COUNT(*) FILTER (WHERE estado_conciliacion = 'no_encontrada'),
    COUNT(*) FILTER (WHERE estado_conciliacion = 'corregida_manual')
  INTO v_conciliadas, v_no_encontradas, v_corregidas
  FROM colilla_lineas
  WHERE colilla_id = p_colilla_id;

  -- Guardar historial y actualizar comision_agencia por cada línea conciliada
  INSERT INTO historial_comisiones_poliza (
    workspace_id, poliza_id, colilla_id, colilla_linea_id,
    periodo, aseguradora, valor_anterior, valor_nuevo
  )
  SELECT
    p_workspace_id,
    cl.poliza_id,
    p_colilla_id,
    cl.id,
    v_periodo,
    v_aseguradora,
    p.comision_agencia,
    cl.valor_comision
  FROM colilla_lineas cl
  JOIN polizas p ON p.id = cl.poliza_id
  WHERE cl.colilla_id = p_colilla_id
    AND cl.poliza_id IS NOT NULL
    AND cl.estado_conciliacion IN ('conciliada', 'corregida_manual');

  -- Actualizar comision_agencia en las pólizas vinculadas
  UPDATE polizas p SET
    comision_agencia  = cl.valor_comision,
    comision_recibida = true
  FROM colilla_lineas cl
  WHERE cl.colilla_id              = p_colilla_id
    AND cl.poliza_id               = p.id
    AND cl.estado_conciliacion     IN ('conciliada', 'corregida_manual');

  -- Confirmar la colilla
  UPDATE colillas_importacion SET
    estado            = 'confirmada',
    confirmed_at      = now(),
    conciliadas       = v_conciliadas,
    no_encontradas    = v_no_encontradas,
    corregidas_manual = v_corregidas
  WHERE id = p_colilla_id;

  RETURN jsonb_build_object(
    'ok',               true,
    'conciliadas',      v_conciliadas,
    'no_encontradas',   v_no_encontradas,
    'corregidas_manual', v_corregidas
  );
END;
$$;

-- 3. RPC: revertir importación de colilla (restaura comision_agencia anterior)
CREATE OR REPLACE FUNCTION revertir_colilla(
  p_colilla_id   uuid,
  p_workspace_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revertidas int := 0;
BEGIN
  -- Verificar pertenencia
  IF NOT EXISTS (
    SELECT 1 FROM colillas_importacion
    WHERE id = p_colilla_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Colilla no encontrada';
  END IF;

  -- Restaurar comision_agencia al valor anterior usando el historial
  -- Solo toca pólizas que tengan historial de esta colilla
  UPDATE polizas p SET
    comision_agencia  = h.valor_anterior,
    -- Solo quitar comision_recibida si NO hay otra colilla confirmada vinculada
    comision_recibida = EXISTS (
      SELECT 1
      FROM colilla_lineas cl2
      JOIN colillas_importacion ci2 ON ci2.id = cl2.colilla_id
      WHERE cl2.poliza_id = p.id
        AND ci2.estado    = 'confirmada'
        AND ci2.id        <> p_colilla_id
    )
  FROM historial_comisiones_poliza h
  WHERE h.colilla_id   = p_colilla_id
    AND h.poliza_id    = p.id;

  GET DIAGNOSTICS v_revertidas = ROW_COUNT;

  -- Eliminar la colilla (cascadea a colilla_lineas e historial)
  DELETE FROM colillas_importacion
  WHERE id = p_colilla_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'ok',         true,
    'revertidas', v_revertidas
  );
END;
$$;
