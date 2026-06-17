-- Asigna 12.5% de comisión a todas las pólizas de Automóviles / Todo Riesgo Vehículo
-- y recalcula comision_agencia (bruta). La retención y neta se derivan en el frontend.
--
-- APLICA A: ramos que coincidan con autos (insensible a mayúsculas/acentos).
-- NO toca SOAT ni otros ramos.
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query

UPDATE polizas
SET
  porcentaje_comision_agencia = 12.5,
  comision_agencia            = ROUND(COALESCE(prima_neta, prima, 0) * 0.125, 2)
WHERE
  eliminada = false
  AND LOWER(UNACCENT(ramo)) IN (
    'todo riesgo vehiculo',
    'automoviles',
    'autos'
  );

-- ── Resumen de lo actualizado ──────────────────────────────────────────────
SELECT
  ramo,
  COUNT(*)                                              AS polizas,
  COUNT(CASE WHEN COALESCE(prima_neta, prima) > 0 THEN 1 END) AS con_prima,
  TO_CHAR(ROUND(SUM(COALESCE(prima_neta, prima, 0)), 0), 'FM999,999,999') AS prima_neta_total,
  TO_CHAR(ROUND(SUM(comision_agencia), 0),                'FM999,999,999') AS comision_bruta,
  TO_CHAR(ROUND(SUM(comision_agencia) * 0.9, 0),         'FM999,999,999') AS comision_neta_aprox
FROM polizas
WHERE
  eliminada = false
  AND LOWER(UNACCENT(ramo)) IN (
    'todo riesgo vehiculo',
    'automoviles',
    'autos'
  )
GROUP BY ramo
ORDER BY ramo;
