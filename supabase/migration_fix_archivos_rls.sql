-- ============================================================
-- Fix: RLS para tabla archivos + bucket storage
-- Aplicar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Recrear políticas de la tabla archivos con check explícito de workspace_id NOT NULL
DROP POLICY IF EXISTS "archivos_select" ON archivos;
DROP POLICY IF EXISTS "archivos_insert" ON archivos;
DROP POLICY IF EXISTS "archivos_update" ON archivos;
DROP POLICY IF EXISTS "archivos_delete" ON archivos;

CREATE POLICY "archivos_select" ON archivos FOR SELECT
  USING (is_workspace_member(workspace_id));

CREATE POLICY "archivos_insert" ON archivos FOR INSERT
  WITH CHECK (
    workspace_id IS NOT NULL
    AND is_workspace_member(workspace_id)
  );

CREATE POLICY "archivos_update" ON archivos FOR UPDATE
  USING (is_workspace_member(workspace_id));

CREATE POLICY "archivos_delete" ON archivos FOR DELETE
  USING (is_workspace_member(workspace_id));

-- 2. Políticas del bucket de Storage para usuarios autenticados
-- (el workspace-level se controla en la tabla archivos)
DROP POLICY IF EXISTS "archivos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "archivos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "archivos_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "archivos_storage_delete" ON storage.objects;

CREATE POLICY "archivos_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'archivos' AND auth.uid() IS NOT NULL);

CREATE POLICY "archivos_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'archivos' AND auth.uid() IS NOT NULL);

CREATE POLICY "archivos_storage_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'archivos' AND auth.uid() IS NOT NULL);

CREATE POLICY "archivos_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'archivos' AND auth.uid() IS NOT NULL);
