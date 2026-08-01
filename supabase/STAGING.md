# Staging y flujo de migraciones con Supabase CLI

> Fase 0.2 del PLAN_EJECUCION_AUDITORIAS.md. A partir de ahora, **ninguna migración
> se estrena en producción**: primero staging, luego prod.

## Arquitectura

| Ambiente | Proyecto Supabase | Uso |
|---|---|---|
| Producción | `tqwkzquchktsjutksjdk` (existente) | Datos reales de la agencia. Solo migraciones ya probadas. |
| Staging | `senda-staging` (crear — ver Setup) | Pruebas de migraciones, imports y features destructivas. |

Las migraciones versionadas viven en `supabase/migrations/` (convención del CLI:
`YYYYMMDDHHMMSS_nombre.sql`). Los archivos históricos `supabase/migration_*.sql`
quedan como referencia; ya están aplicados en producción y NO deben re-aplicarse.

## Setup inicial (una sola vez, requiere cuenta del owner)

```bash
# 1. Autenticarse (abre el navegador)
supabase login

# 2. Crear el proyecto de staging (o crearlo en el dashboard)
supabase projects create senda-staging --org-id <ORG_ID> --region us-east-1 \
  --db-password '<GENERAR_PASSWORD_FUERTE>'
# ORG_ID: supabase orgs list

# 3. Vincular este repo a PRODUCCIÓN para volcar el schema real como baseline
supabase link --project-ref tqwkzquchktsjutksjdk   # pide el DB password de prod
supabase db pull                                    # → crea supabase/migrations/<ts>_remote_schema.sql

# 4. Re-vincular a STAGING y aplicar el baseline allá
supabase link --project-ref <REF_DE_SENDA_STAGING>
supabase db push

# 5. Volver a dejar el link apuntando a staging (estado por defecto del repo)
#    El link es local (supabase/.temp, ignorado por git) — cada dev repite 1 y 4.
```

> **Importante:** el baseline debe salir de `db pull` contra producción, NO de
> concatenar `schema.sql` + los `migration_*.sql` históricos — ya hubo drift
> documentado (`migration_fix_schema_drift_metas_solicitudes.sql`).

## Flujo de trabajo diario (toda migración nueva)

```bash
# 1. Crear la migración
npm run db:new nombre_descriptivo        # → supabase/migrations/<ts>_nombre_descriptivo.sql
# (escribir el SQL a mano, siguiendo las reglas de ONBOARDING.md: workspace_id + RLS)

# 2. Probarla en staging (link debe apuntar a staging)
npm run db:push:staging

# 3. Probar la feature contra staging:
#    en .env.local apuntar temporalmente NEXT_PUBLIC_SUPABASE_URL y ANON_KEY a senda-staging

# 4. Cuando el PR esté aprobado y mergeado → aplicar en producción:
#    Supabase Dashboard (prod) → SQL Editor → pegar la migración → Run
#    (o `supabase link` a prod + `db push` si el owner ejecuta)

# 5. Registrar en BITACORA.md al cierre de fase
```

## Variables de entorno de staging

Agregar a `.env.local` (comentadas, para alternar rápido):

```bash
# --- STAGING (descomentar para probar contra senda-staging) ---
# NEXT_PUBLIC_SUPABASE_URL=https://<REF_STAGING>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key_staging>
```

## Reglas

1. PR que incluya `supabase/migrations/*.sql` debe decir en la descripción: **"Probada en staging: sí/no"**. Sin staging no se mergea.
2. Nunca `db push` contra producción desde una máquina de desarrollo sin aprobación del owner.
3. Los datos de staging son desechables; puede resetearse con `supabase db reset --linked` cuando se necesite.
4. Seed mínimo anonimizado: `supabase/seed.sql` (pendiente de crear — no copiar datos reales de clientes).
