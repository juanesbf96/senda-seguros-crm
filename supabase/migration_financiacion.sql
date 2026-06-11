-- Agrega campos de financiación a polizas
ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS financiera text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS num_cuotas integer DEFAULT NULL;
