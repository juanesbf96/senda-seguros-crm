ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_documento text DEFAULT 'cedula';
