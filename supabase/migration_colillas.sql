-- =====================================================
-- migration_colillas.sql
-- Aplicar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1. Tabla principal de importaciones
CREATE TABLE IF NOT EXISTS colillas_importacion (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  aseguradora         text NOT NULL,
  periodo             text NOT NULL,  -- 'YYYY-MM'
  archivo_nombre      text NOT NULL,
  total_lineas        int NOT NULL DEFAULT 0,
  conciliadas         int NOT NULL DEFAULT 0,
  no_encontradas      int NOT NULL DEFAULT 0,
  corregidas_manual   int NOT NULL DEFAULT 0,
  estado              text NOT NULL DEFAULT 'borrador'
                      CHECK (estado IN ('borrador', 'confirmada')),
  creado_por          uuid REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz
);

-- 2. Líneas de cada colilla
CREATE TABLE IF NOT EXISTS colilla_lineas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colilla_id            uuid NOT NULL REFERENCES colillas_importacion(id) ON DELETE CASCADE,
  workspace_id          uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  poliza_id             uuid REFERENCES polizas(id),
  numero_poliza_raw     text NOT NULL,
  nombre_tomador        text,
  valor_prima           numeric(15,2),
  valor_comision        numeric(15,2),
  porcentaje_comision   numeric(5,2),
  fecha_pago            date,
  fecha_recaudo         date,
  retefuente            numeric(15,2),
  estado_conciliacion   text NOT NULL DEFAULT 'no_encontrada'
                        CHECK (estado_conciliacion IN ('conciliada','no_encontrada','corregida_manual')),
  notas                 text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- 3. Campo periodo en cobros
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS periodo text;

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_colillas_workspace ON colillas_importacion(workspace_id);
CREATE INDEX IF NOT EXISTS idx_colillas_estado    ON colillas_importacion(workspace_id, estado);
CREATE INDEX IF NOT EXISTS idx_lineas_colilla     ON colilla_lineas(colilla_id);
CREATE INDEX IF NOT EXISTS idx_lineas_poliza      ON colilla_lineas(poliza_id);
CREATE INDEX IF NOT EXISTS idx_lineas_workspace   ON colilla_lineas(workspace_id);

-- 5. RLS
ALTER TABLE colillas_importacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE colilla_lineas       ENABLE ROW LEVEL SECURITY;

-- Idempotente: drop primero para permitir re-ejecución segura
DROP POLICY IF EXISTS "colillas_importacion_workspace_member" ON colillas_importacion;
DROP POLICY IF EXISTS "colilla_lineas_workspace_member"       ON colilla_lineas;

CREATE POLICY "colillas_importacion_workspace_member"
  ON colillas_importacion FOR ALL
  USING     (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "colilla_lineas_workspace_member"
  ON colilla_lineas FOR ALL
  USING     (is_workspace_member(workspace_id))
  WITH CHECK (is_workspace_member(workspace_id));

-- 6. RPC: confirmar colilla (atómico, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION confirmar_colilla(
  p_colilla_id  uuid,
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

  -- Contadores por estado
  SELECT
    COUNT(*) FILTER (WHERE estado_conciliacion = 'conciliada'),
    COUNT(*) FILTER (WHERE estado_conciliacion = 'no_encontrada'),
    COUNT(*) FILTER (WHERE estado_conciliacion = 'corregida_manual')
  INTO v_conciliadas, v_no_encontradas, v_corregidas
  FROM colilla_lineas
  WHERE colilla_id = p_colilla_id;

  -- Confirmar colilla
  UPDATE colillas_importacion SET
    estado           = 'confirmada',
    confirmed_at     = now(),
    conciliadas      = v_conciliadas,
    no_encontradas   = v_no_encontradas,
    corregidas_manual = v_corregidas
  WHERE id = p_colilla_id;

  -- Auto-marcar comision_recibida = true en pólizas vinculadas
  UPDATE polizas SET
    comision_recibida = true
  WHERE id IN (
    SELECT poliza_id FROM colilla_lineas
    WHERE colilla_id = p_colilla_id
      AND poliza_id IS NOT NULL
      AND estado_conciliacion IN ('conciliada', 'corregida_manual')
  );

  RETURN jsonb_build_object(
    'ok',               true,
    'conciliadas',      v_conciliadas,
    'no_encontradas',   v_no_encontradas,
    'corregidas_manual', v_corregidas
  );
END;
$$;

-- 7. RPC: estado de cuenta por vendedor
-- FIX: usa CTEs para evitar que comision_abc_periodica se sume N veces
--      cuando una póliza aparece en N líneas de colilla dentro del mismo grupo.
CREATE OR REPLACE FUNCTION get_estado_cuenta_vendedor(
  p_workspace_id uuid,
  p_vendedor_id  uuid DEFAULT NULL,
  p_periodo      text DEFAULT NULL
)
RETURNS TABLE (
  vendedor_id        uuid,
  vendedor_nombre    text,
  periodo            text,
  aseguradora        text,
  comision_esperada  numeric,
  comision_recibida  numeric,
  saldo_pendiente    numeric,
  asesor_pago_estado text,
  num_polizas        int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- 1. Solo líneas válidas de colillas confirmadas
  lineas_validas AS (
    SELECT
      cl.poliza_id,
      cl.valor_comision,
      ci.periodo,
      ci.aseguradora
    FROM colilla_lineas cl
    JOIN colillas_importacion ci ON ci.id = cl.colilla_id
    WHERE ci.workspace_id           = p_workspace_id
      AND ci.estado                 = 'confirmada'
      AND cl.estado_conciliacion    IN ('conciliada', 'corregida_manual')
      AND cl.poliza_id              IS NOT NULL
      AND (p_periodo IS NULL OR ci.periodo = p_periodo)
  ),
  -- 2. Comisión recibida por grupo (poliza × periodo × aseguradora)
  recibido_por_grupo AS (
    SELECT
      lv.poliza_id,
      lv.periodo,
      lv.aseguradora,
      SUM(lv.valor_comision)  AS total_recibido
    FROM lineas_validas lv
    GROUP BY lv.poliza_id, lv.periodo, lv.aseguradora
  ),
  -- 3. Comisión esperada por póliza — DISTINCT para no multiplicar
  esperado_por_poliza AS (
    SELECT DISTINCT ON (p.id, rg.periodo, rg.aseguradora)
      p.id            AS poliza_id,
      p.vendedor_id,
      p.comision_abc_periodica,
      rg.periodo,
      rg.aseguradora
    FROM recibido_por_grupo rg
    JOIN polizas p ON p.id = rg.poliza_id
    WHERE (p_vendedor_id IS NULL OR p.vendedor_id = p_vendedor_id)
  )
  SELECT
    ep.vendedor_id,
    v.nombre                                             AS vendedor_nombre,
    ep.periodo,
    ep.aseguradora,
    COALESCE(SUM(ep.comision_abc_periodica), 0)          AS comision_esperada,
    COALESCE(SUM(rg.total_recibido),         0)          AS comision_recibida,
    COALESCE(SUM(ep.comision_abc_periodica), 0)
      - COALESCE(SUM(rg.total_recibido),     0)          AS saldo_pendiente,
    -- Estado de pago al asesor más frecuente del grupo
    (SELECT p2.asesor_pago_estado
     FROM polizas p2
     WHERE p2.vendedor_id   = ep.vendedor_id
       AND p2.workspace_id  = p_workspace_id
     GROUP BY p2.asesor_pago_estado
     ORDER BY COUNT(*) DESC
     LIMIT 1)                                             AS asesor_pago_estado,
    COUNT(DISTINCT ep.poliza_id)::int                    AS num_polizas
  FROM esperado_por_poliza ep
  JOIN recibido_por_grupo rg
    ON  rg.poliza_id   = ep.poliza_id
    AND rg.periodo     = ep.periodo
    AND rg.aseguradora = ep.aseguradora
  LEFT JOIN vendedores v ON v.id = ep.vendedor_id
  GROUP BY ep.vendedor_id, v.nombre, ep.periodo, ep.aseguradora
  ORDER BY ep.periodo DESC, v.nombre;
END;
$$;
