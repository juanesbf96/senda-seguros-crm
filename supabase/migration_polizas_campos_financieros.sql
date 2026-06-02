-- ============================================================
-- Campos financieros completos para pólizas
-- Aplica en: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE polizas
  -- Prima
  ADD COLUMN IF NOT EXISTS prima_periodica           numeric,
  -- Comisión del negocio
  ADD COLUMN IF NOT EXISTS pct_comision_negocio      numeric,
  ADD COLUMN IF NOT EXISTS comision_negocio_anual    numeric,
  -- Comisión ABC/agencia
  ADD COLUMN IF NOT EXISTS comision_periodica        numeric,
  ADD COLUMN IF NOT EXISTS pct_comision_abc          numeric,
  ADD COLUMN IF NOT EXISTS retencion_agencia         numeric,
  ADD COLUMN IF NOT EXISTS comision_abc_periodica    numeric,
  ADD COLUMN IF NOT EXISTS comision_abc_anual        numeric,
  ADD COLUMN IF NOT EXISTS comision_abc_recibida     numeric,
  ADD COLUMN IF NOT EXISTS fecha_pago_abc            date,
  -- Intermediario
  ADD COLUMN IF NOT EXISTS intermediario             text,
  ADD COLUMN IF NOT EXISTS pct_comision_int          numeric,
  ADD COLUMN IF NOT EXISTS comision_intermediario    numeric,
  -- Referido
  ADD COLUMN IF NOT EXISTS referido                  text,
  ADD COLUMN IF NOT EXISTS pct_comision_referido     numeric,
  ADD COLUMN IF NOT EXISTS retencion_referido        numeric,
  ADD COLUMN IF NOT EXISTS comision_referido         numeric,
  -- Asesor/vendedor pagos
  ADD COLUMN IF NOT EXISTS comision_asesor_pagada    numeric,
  ADD COLUMN IF NOT EXISTS fecha_pago_asesor         date,
  -- Flags administrativos
  ADD COLUMN IF NOT EXISTS es_renovacion             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS mes_emision               text,
  ADD COLUMN IF NOT EXISTS endoso_enviado            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelada_anterior        boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS aseguradora_anterior      text;
