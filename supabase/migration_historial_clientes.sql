-- ============================================================
-- Historial de cambios de clientes
-- Aplica en: Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes_historial (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id   UUID NOT NULL REFERENCES clientes(id)   ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id)  ON DELETE CASCADE,
  -- agrupa todos los cambios de un mismo guardado
  batch_id     UUID NOT NULL,
  tipo         TEXT NOT NULL CHECK (tipo IN ('creacion', 'actualizacion')),
  campo        TEXT,        -- NULL para tipo='creacion'
  label_campo  TEXT,        -- etiqueta legible del campo
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  usuario_id   UUID,
  usuario_nombre TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clientes_historial_cliente
  ON clientes_historial(cliente_id);
CREATE INDEX IF NOT EXISTS idx_clientes_historial_fecha
  ON clientes_historial(created_at DESC);

ALTER TABLE clientes_historial ENABLE ROW LEVEL SECURITY;

-- Miembros del workspace pueden leer el historial
CREATE POLICY "historial_select" ON clientes_historial
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Miembros del workspace pueden insertar entradas
CREATE POLICY "historial_insert" ON clientes_historial
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
