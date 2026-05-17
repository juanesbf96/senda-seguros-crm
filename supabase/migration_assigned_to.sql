-- =============================================================
-- Migración: assigned_to en clientes
-- Cada cliente queda asignado a un usuario del workspace.
-- Los clientes existentes se asignan al admin (Sara Lopera).
-- =============================================================

-- 1. Agregar columna
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Asignar clientes existentes a Sara Lopera (admin)
UPDATE clientes
SET assigned_to = (
  SELECT id FROM auth.users WHERE email = 'sendaseg@gmail.com' LIMIT 1
)
WHERE assigned_to IS NULL;

-- 3. RPC para obtener miembros del workspace con nombre/email
--    (para el dropdown de asignación — ya existe get_workspace_members,
--     esta versión simplificada retorna solo lo necesario para el selector)
CREATE OR REPLACE FUNCTION get_assignable_members(p_workspace_id uuid)
RETURNS TABLE (
  user_id  uuid,
  nombre   text,
  email    text,
  role     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- Solo miembros del workspace pueden ver el listado
  IF NOT EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = p_workspace_id AND w.owner_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    wm.user_id,
    COALESCE(u.raw_user_meta_data->>'nombre', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)) AS nombre,
    u.email,
    wm.role
  FROM workspace_members wm
  JOIN auth.users u ON u.id = wm.user_id
  WHERE wm.workspace_id = p_workspace_id
  ORDER BY nombre;
END;
$$;

GRANT EXECUTE ON FUNCTION get_assignable_members(uuid) TO authenticated;
