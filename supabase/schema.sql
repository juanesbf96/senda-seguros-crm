-- ============================================================
-- Senda Seguros CRM - Schema SQL
-- Copiar y ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabla de clientes / leads
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  cedula TEXT,
  ciudad TEXT,
  departamento TEXT,
  etapa TEXT NOT NULL DEFAULT 'nuevo' CHECK (etapa IN ('nuevo', 'contactado', 'cotizacion', 'cerrado')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Tabla de pólizas
CREATE TABLE IF NOT EXISTS polizas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  numero_poliza TEXT,
  aseguradora TEXT NOT NULL,
  ramo TEXT NOT NULL,
  prima NUMERIC(12, 2),
  fecha_inicio DATE,
  fecha_fin DATE,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'vencida', 'cancelada', 'pendiente')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Tabla de actividades / historial
CREATE TABLE IF NOT EXISTS actividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('llamada', 'email', 'reunion', 'nota')),
  descripcion TEXT NOT NULL,
  fecha TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Trigger para actualizar updated_at en clientes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_clientes_etapa ON clientes(etapa);
CREATE INDEX IF NOT EXISTS idx_polizas_client_id ON polizas(client_id);
CREATE INDEX IF NOT EXISTS idx_polizas_fecha_fin ON polizas(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_polizas_estado ON polizas(estado);
CREATE INDEX IF NOT EXISTS idx_actividades_client_id ON actividades(client_id);
CREATE INDEX IF NOT EXISTS idx_actividades_fecha ON actividades(fecha DESC);

-- Datos de ejemplo (opcional - comentar si no se necesitan)
INSERT INTO clientes (nombre, email, telefono, cedula, ciudad, departamento, etapa, notas) VALUES
  ('Carlos Mendoza', 'carlos.mendoza@email.com', '3001234567', '12345678', 'Bogotá', 'Cundinamarca', 'nuevo', 'Interesado en seguro de vida y hogar'),
  ('María González', 'maria.gonzalez@email.com', '3109876543', '87654321', 'Medellín', 'Antioquia', 'contactado', 'Tiene vehículo, cotizando SOAT y todo riesgo'),
  ('Juan Pérez', 'juan.perez@email.com', '3201112233', '11223344', 'Cali', 'Valle del Cauca', 'cotizacion', 'Empresa con 15 empleados, póliza colectiva'),
  ('Ana Rodríguez', 'ana.rodriguez@email.com', '3154455667', '44556677', 'Barranquilla', 'Atlántico', 'cerrado', 'Cliente activo, renovación en noviembre');
