-- Corrige la ortografía de "Automoviles" → "Automóviles" en la tabla polizas
UPDATE polizas
SET ramo = 'Automóviles'
WHERE LOWER(ramo) LIKE '%automov%'
  AND ramo <> 'Automóviles';
