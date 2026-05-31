-- ============================================================
-- RESET: borra clientes y todo lo asociado
-- ⚠️  IRREVERSIBLE — ejecutar solo si estás seguro
-- Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Borra cobros (algunos referencian client_id con SET NULL,
--    pero es mejor limpiarlos si estás reimportando de cero)
DELETE FROM cobros;

-- 2. Borra clientes → en CASCADE borra automáticamente:
--    polizas, actividades, clientes_historial, archivos_cliente,
--    notificaciones_renovacion, poliza_anexos, polizas_vinculadas
DELETE FROM clientes;
