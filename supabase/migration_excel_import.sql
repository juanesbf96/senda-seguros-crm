-- ============================================================
-- Migration: campos para importación desde Excel VENTAS_SENDA
-- Hoja "2025" — 44 columnas
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. CLIENTES — añadir tipo_documento ─────────────────────────
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT;  -- CC, NIT, CE, PP, etc.

-- ── 2. PÓLIZAS — campos faltantes del Excel ─────────────────────
ALTER TABLE polizas

  -- ── Flags de estado/origen
  ADD COLUMN IF NOT EXISTS es_renovacion       BOOLEAN NOT NULL DEFAULT FALSE,  -- col: RENOVACION
  ADD COLUMN IF NOT EXISTS mes_emision         TEXT,                             -- col: MES EMISION (ej: "ene-25")
  ADD COLUMN IF NOT EXISTS cancelada_anterior  BOOLEAN NOT NULL DEFAULT FALSE,  -- col: CANCELADA ANTERIOR
  ADD COLUMN IF NOT EXISTS aseguradora_anterior TEXT,                            -- col: ASEGURADORA NUEVA VIG
  ADD COLUMN IF NOT EXISTS endoso_enviado      BOOLEAN NOT NULL DEFAULT FALSE,  -- col: ENVIADO ENDOSO

  -- ── Prima periódica (desglose)
  ADD COLUMN IF NOT EXISTS prima_periodica     NUMERIC(14,2),  -- col: PRIMA PERIODICA PAGADA

  -- ── Retención agencia (10%)
  ADD COLUMN IF NOT EXISTS retencion_agencia   NUMERIC(14,2),  -- col: RETENCIÓN 10%

  -- ── Comisión periódica agencia
  ADD COLUMN IF NOT EXISTS comision_periodica  NUMERIC(14,2),  -- col: COMISION PERIODICA ABC

  -- ── Intermediario
  ADD COLUMN IF NOT EXISTS intermediario            TEXT,            -- col: INTERMEDIARIO INICIAL
  ADD COLUMN IF NOT EXISTS pct_comision_int         NUMERIC(5,4),   -- col: % COMISION INTERMEDIARIO
  ADD COLUMN IF NOT EXISTS comision_intermediario   NUMERIC(14,2),  -- col: COMISION INTERMEDIARIO INICIAL

  -- ── Referido
  ADD COLUMN IF NOT EXISTS referido                 TEXT,           -- col: REFERIDO
  ADD COLUMN IF NOT EXISTS pct_comision_referido    NUMERIC(5,4),   -- col: % COMISION REFERIDO
  ADD COLUMN IF NOT EXISTS retencion_referido       NUMERIC(14,2),  -- col: RETENCION REFERIDO
  ADD COLUMN IF NOT EXISTS comision_referido        NUMERIC(14,2),  -- col: COMISION REFERIDO

  -- ── Comisiones ABC finales (netas para la agencia)
  ADD COLUMN IF NOT EXISTS comision_abc_periodica   NUMERIC(14,2),  -- col: COMISION ABC PERIODICA
  ADD COLUMN IF NOT EXISTS pct_comision_abc         NUMERIC(5,4),   -- col: % COMISION ABC SEGUROS
  ADD COLUMN IF NOT EXISTS retencion_abc            NUMERIC(14,2),  -- col: RETENCION ASUMIDA POR ABC
  ADD COLUMN IF NOT EXISTS comision_abc_anual       NUMERIC(14,2),  -- col: COMISION ABC ANUAL

  -- ── Pagos recibidos
  ADD COLUMN IF NOT EXISTS comision_abc_recibida    NUMERIC(14,2),  -- col: COMISIÓN ABC RECIBIDA
  ADD COLUMN IF NOT EXISTS fecha_pago_abc           DATE,            -- col: FECHA PAGO ABC
  ADD COLUMN IF NOT EXISTS comision_asesor_pagada   NUMERIC(14,2),  -- col: PAGO COMISIÓN ASESOR
  ADD COLUMN IF NOT EXISTS fecha_pago_asesor        DATE;            -- col: FECHA PAGO ASESOR

-- ── 3. Índices útiles para los nuevos campos ────────────────────
CREATE INDEX IF NOT EXISTS idx_polizas_es_renovacion    ON polizas(es_renovacion);
CREATE INDEX IF NOT EXISTS idx_polizas_mes_emision      ON polizas(mes_emision);
CREATE INDEX IF NOT EXISTS idx_polizas_fecha_pago_abc   ON polizas(fecha_pago_abc);
CREATE INDEX IF NOT EXISTS idx_polizas_fecha_pago_asesor ON polizas(fecha_pago_asesor);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo_documento  ON clientes(tipo_documento);

-- ============================================================
-- Mapeo completo Excel → DB
-- ============================================================
-- Col  1  RENOVACION              → polizas.es_renovacion (bool), mes en polizas.mes_emision
-- Col  2  ONEROSO?                → polizas.beneficiario_oneroso (ya existe)
-- Col  3  ENVIADO ENDOSO          → polizas.endoso_enviado
-- Col  4  MES EMISION             → polizas.mes_emision
-- Col  5  CANCELADA ANTERIOR      → polizas.cancelada_anterior
-- Col  6  ASEGURADORA NUEVA VIG   → polizas.aseguradora_anterior
-- Col  7  TIPO                    → polizas.tipo_poliza (ya existe)
-- Col  8  CLIENTE                 → clientes.nombre
-- Col  9  Tipo ID                 → clientes.tipo_documento
-- Col 10  NIT / CC                → clientes.cedula / clientes.nit
-- Col 11  Fecha de nacimiento     → clientes.fecha_nacimiento (ya existe)
-- Col 12  Celular                 → clientes.telefono
-- Col 13  Correo                  → clientes.email
-- Col 14  FECHA INICIO VIGENCIA   → polizas.fecha_inicio (ya existe)
-- Col 15  FECHA FIN VIGENCIA      → polizas.fecha_fin (ya existe)
-- Col 16  ASEGURADORA             → polizas.aseguradora (ya existe)
-- Col 17  NUMERO POLIZA           → polizas.numero_poliza (ya existe)
-- Col 18  RAMO                    → polizas.ramo (ya existe)
-- Col 19  PERIODICIDAD            → polizas.periodicidad_pago (ya existe)
-- Col 20  % COMISION DEL NEGOCIO  → polizas.porcentaje_comision_agencia (ya existe)
-- Col 21  PRIMA ANUAL ANTES DE IVA→ polizas.prima_neta (ya existe)
-- Col 22  PRIMA PERIODICA PAGADA  → polizas.prima_periodica
-- Col 23  COMISION ANUAL NEGOCIO  → polizas.comision_agencia (ya existe)
-- Col 24  COMISION PERIODICA ABC  → polizas.comision_periodica
-- Col 25  RETENCIÓN 10%           → polizas.retencion_agencia
-- Col 26  INTERMEDIARIO INICIAL   → polizas.intermediario
-- Col 27  % COMISION INTERMEDIARIO→ polizas.pct_comision_int
-- Col 28  COMISION INTERMEDIARIO  → polizas.comision_intermediario
-- Col 29  CONCESIONARIO / ASESOR  → polizas.vendedor_id (lookup por nombre)
-- Col 30  % COMISION ASESOR       → polizas.porcentaje_comision_vendedor (ya existe)
-- Col 31  RETENCION ASESOR        → polizas.retencion_vendedor (ya existe)
-- Col 32  COMISION ASESOR         → polizas.comision_vendedor (ya existe)
-- Col 33  REFERIDO                → polizas.referido
-- Col 34  % COMISION REFERIDO     → polizas.pct_comision_referido
-- Col 35  RETENCION REFERIDO      → polizas.retencion_referido
-- Col 36  COMISION REFERIDO       → polizas.comision_referido
-- Col 37  COMISION ABC PERIODICA  → polizas.comision_abc_periodica
-- Col 38  % COMISION ABC SEGUROS  → polizas.pct_comision_abc
-- Col 39  RETENCION ASUMIDA ABC   → polizas.retencion_abc
-- Col 40  COMISION ABC ANUAL      → polizas.comision_abc_anual
-- Col 41  COMISIÓN ABC RECIBIDA   → polizas.comision_abc_recibida
-- Col 42  FECHA PAGO ABC          → polizas.fecha_pago_abc
-- Col 43  PAGO COMISIÓN ASESOR    → polizas.comision_asesor_pagada
-- Col 44  FECHA PAGO ASESOR       → polizas.fecha_pago_asesor
-- ============================================================
