-- ============================================================
-- Notificaciones de renovación de pólizas
-- Aplica en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Tabla de log para no enviar duplicados el mismo día
CREATE TABLE IF NOT EXISTS notificaciones_renovacion (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  poliza_id       uuid NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
  dias_alerta     int  NOT NULL,    -- 30, 15 o 7
  enviada_at      timestamptz DEFAULT now(),
  email_destino   text NOT NULL,
  UNIQUE (poliza_id, dias_alerta, enviada_at::date)
);

-- Index para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_notif_renovacion_poliza ON notificaciones_renovacion (poliza_id, dias_alerta);
CREATE INDEX IF NOT EXISTS idx_notif_renovacion_ws     ON notificaciones_renovacion (workspace_id);

-- RLS: solo el service role puede insertar/leer (la cron usa service role key)
ALTER TABLE notificaciones_renovacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select" ON notificaciones_renovacion
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Inserción solo por service role (no hay policy de INSERT para anon/authed)

-- ============================================================
-- 2. RPC que devuelve pólizas por vencer con datos del workspace
--    Llamada con service role key desde la cron
-- ============================================================
CREATE OR REPLACE FUNCTION get_polizas_por_vencer(dias_max int DEFAULT 30)
RETURNS TABLE (
  poliza_id        uuid,
  numero_poliza    text,
  aseguradora      text,
  ramo             text,
  prima_neta       numeric,
  fecha_fin        date,
  dias_restantes   int,
  cliente_nombre   text,
  workspace_id     uuid,
  workspace_name   text,
  admin_email      text,
  admin_nombre     text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id              AS poliza_id,
    p.numero_poliza,
    p.aseguradora,
    p.ramo,
    p.prima_neta,
    p.fecha_fin,
    (p.fecha_fin - CURRENT_DATE)::int AS dias_restantes,
    c.nombre           AS cliente_nombre,
    w.id               AS workspace_id,
    w.name             AS workspace_name,
    wm.email           AS admin_email,
    COALESCE(wm.nombre, split_part(wm.email,'@',1)) AS admin_nombre
  FROM polizas p
  JOIN clientes c   ON c.id = p.client_id
  JOIN workspaces w ON w.id = p.workspace_id
  JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = w.owner_id
  WHERE
    p.eliminada = false
    AND p.estado = 'activa'
    AND p.fecha_fin IS NOT NULL
    AND p.fecha_fin >= CURRENT_DATE
    AND p.fecha_fin <= CURRENT_DATE + dias_max
  ORDER BY p.fecha_fin ASC;
$$;

GRANT EXECUTE ON FUNCTION get_polizas_por_vencer TO service_role;
