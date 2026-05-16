-- ══════════════════════════════════════════════════════════════════════
-- FASE 2: Activar RLS en tablas existentes con filtro de workspace
-- EJECUTAR SOLO después de que el frontend ya filtre por workspace_id
-- en TODAS las queries. Si se activa antes, los datos desaparecerán.
-- ══════════════════════════════════════════════════════════════════════

-- Patrón de políticas para cada tabla de datos:
--   SELECT:  cualquier miembro del workspace
--   INSERT:  cualquier miembro (agente/supervisor/admin)
--   UPDATE:  admin + supervisor pueden todo;
--            agente solo sus propios registros (created_by = auth.uid())
--   DELETE:  solo admin y supervisor

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clientes','polizas','poliza_anexos','poliza_vinculados',
    'actividades','tareas','cobros','recibos','solicitudes',
    'remisiones','vendedores','liquidaciones','prospectos',
    'prospecto_actividades','agenda_eventos','archivos',
    'siniestros','siniestro_amparos','facturas','diligencias',
    'diligencia_tareas','metas','configuracion','contactos',
    'campanas_renovacion','gestiones_renovacion','amparos_siniestro',
    'dashboards_custom'
  ]
  LOOP
    -- Eliminar políticas antiguas de "allow all"
    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_all" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON %I', t);

    -- SELECT: todos los miembros del workspace
    EXECUTE format(
      'CREATE POLICY "%s_select" ON %I FOR SELECT
       USING (is_workspace_member(workspace_id))', t, t
    );

    -- INSERT: todos los miembros
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON %I FOR INSERT
       WITH CHECK (is_workspace_member(workspace_id))', t, t
    );

    -- UPDATE: admin/supervisor siempre; agente solo sus registros
    EXECUTE format(
      'CREATE POLICY "%s_update" ON %I FOR UPDATE
       USING (
         is_workspace_supervisor(workspace_id)
         OR (is_workspace_member(workspace_id) AND (created_by = auth.uid() OR created_by IS NULL))
       )', t, t
    );

    -- DELETE: solo admin y supervisor
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON %I FOR DELETE
       USING (is_workspace_supervisor(workspace_id))', t, t
    );
  END LOOP;
END $$;

-- Hacer workspace_id NOT NULL (solo cuando TODOS los registros ya lo tienen)
-- Verificar primero: SELECT tablename, count(*) FROM ... WHERE workspace_id IS NULL
-- Luego descomentar:

-- DO $$ DECLARE t TEXT;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['clientes','polizas','tareas', ...] LOOP
--     EXECUTE format('ALTER TABLE %I ALTER COLUMN workspace_id SET NOT NULL', t);
--   END LOOP;
-- END $$;
