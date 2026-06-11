-- Agrega campo prima_mensual a polizas para pólizas con pago mensual
ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS prima_mensual numeric(14,2) DEFAULT NULL;
