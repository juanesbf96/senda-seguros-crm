-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Fix tabla tareas (parte 2)
-- Renombra columna nombre → titulo
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE tareas RENAME COLUMN nombre TO titulo;

-- Verificar columnas finales
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tareas'
ORDER BY ordinal_position;
