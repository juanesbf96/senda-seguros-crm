# Handoff — Senda Seguros CRM

> Última actualización: 11 de julio de 2026 · commit `26901b3`
> Para el historial de desarrollo detallado ver [BITACORA.md](./BITACORA.md). Para instrucciones de setup y convenciones de código ver [ONBOARDING.md](./ONBOARDING.md).

---

## Qué es esto

CRM a medida para **Senda Seguros**, agencia de seguros colombiana. Gestiona clientes, pólizas, solicitudes, cobranza, comisiones, tareas y vendedores, con arquitectura multi-workspace y roles (admin / supervisor / agente).

| | |
|---|---|
| **Repositorio** | `https://github.com/juanesbf96/senda-seguros-crm` (rama `main`) |
| **Producción** | Auto-deploy en Vercel en cada push a `main` |
| **Stack** | Next.js 16.2.4 (App Router, Turbopack) · Supabase (Postgres + Auth + Storage) · Tailwind CSS v4 · TypeScript estricto |
| **Cuenta admin** | `sendaseg@gmail.com` · Workspace: *Sara Lopera Workspace* |
| **Proyecto Supabase** | `tqwkzquchktsjutksjdk` — plan **gratuito** |

---

## ⚠️ Antes de tocar nada: revisa esto

**El proyecto de Supabase se pausa automáticamente tras ~7 días de inactividad** (comportamiento del plan free). Cuando pasa, la app entera falla al hacer login con errores de red (`Failed to fetch`, `TypeError`) que antes se mostraban engañosamente como "credenciales incorrectas" — esto ya se corrigió (ver abajo).

**Si el login falla o nada carga:**
1. Entra a [supabase.com/dashboard](https://supabase.com/dashboard) con `sendaseg@gmail.com`
2. Si el proyecto aparece "Paused" → click **Restore/Resume project** → espera 1-3 min
3. Verifica en [status.supabase.com](https://status.supabase.com/) si hay un incidente general (poco común, pero se confirma en 10 segundos)

**Solución permanente pendiente:** pasar a plan Pro (no se pausa) o configurar un ping periódico (cron externo) que mantenga el proyecto activo. No implementado todavía.

---

## Estado de cada módulo

| Módulo | Estado | Notas |
|---|---|---|
| Autenticación / Workspaces | ✅ Funcional | Mensajes de error de red vs. credenciales ya diferenciados (`app/login/page.tsx`) |
| Clientes (CRUD + import Excel) | ✅ Funcional | |
| Pólizas (CRUD + multi-select + import) | ✅ Funcional | Falta paginación (ver Pendientes) |
| Solicitudes (12 tipos + tabs) | ✅ Funcional | |
| Tareas | ✅ Funcional | |
| Pipeline / Prospectos | ✅ Funcional | |
| Cobros / Caja | ✅ Funcional | |
| Facturas | ✅ Funcional | |
| Liquidaciones de vendedores | ✅ Funcional | |
| Agenda | ✅ Funcional | Solo eventos, tareas, cobros, prospectos (sin vencimientos de pólizas) |
| Archivos (Supabase Storage) | ✅ Funcional | |
| Informes / Gráficas | ✅ Funcional | |
| **Dashboard principal** | ✅ Funcional | Recién agregado: % cambio vs. mes anterior en KPIs + tabla de producción por asesor (solo admin/supervisor) |
| Asistente IA (Groq / Llama 3.3) | ✅ Funcional | |
| Notificaciones de renovación (email diario) | ✅ Configurado | Cron Vercel activo, pendiente verificar envíos en prod |
| Afiliados en pólizas colectivas | ✅ Funcional | Fase 8 + 9 |
| **Colillas de comisiones** | ✅ Funcional | Importación multi-formato (CSV/PDF/XLSX), conciliación, historial de comisiones, reversión de importaciones |
| Email marketing | ⏸ Diferido | Resend configurado, no implementado |
| Paginación en Pólizas | ⚠️ Pendiente | Ya existe en Clientes y Cobros |

---

## Trabajo reciente (esta sesión, 11 jul 2026)

1. **Fix parsers de colillas** — `pdf-parse` v2 cambió su API de función a clase (`PDFParse`); los 4 parsers PDF (AXA, Bolívar, Quálitas, Expertos) fallaban con `pdfParse is not a function`. Corregido en `lib/colillas/parsers/*.ts`. También se agregó `serverExternalPackages: ['pdf-parse', 'xlsx']` en `next.config.ts`.
2. **Historial de comisiones** — nueva tabla `historial_comisiones_poliza` + RPC `confirmar_colilla` actualizada (guarda historial y actualiza `comision_agencia` real) + nueva RPC `revertir_colilla` (restaura valores al eliminar una importación). Ver `supabase/migration_historial_comisiones.sql` — **pendiente aplicar en Supabase SQL Editor si no se ha hecho**.
3. **Dashboard** — KPIs de pólizas/prima/clientes ahora muestran variación % vs. mes anterior; nueva tabla "Producción por asesor" (mes actual) visible solo para admin/supervisor.
4. **Login** — error de red ahora se distingue de credenciales inválidas (antes ambos mostraban "Correo o contraseña incorrectos", lo cual ocultó el diagnóstico de que Supabase estaba pausado).

---

## Bugs conocidos

- **Pólizas con teléfono en el campo `aseguradora`**: dato corrupto de una importación Excel previa. Pendiente limpiar con SQL manual en Supabase (borrar registros donde `aseguradora` solo tiene dígitos y `numero_poliza` es NULL).
- **`retencion_vendedor` almacena valores en dólares como si fueran porcentaje** en algunas pólizas importadas desde el Excel de generales SURA — causa comisiones netas absurdas en `PolizaDetalle`. No corregido; requiere validación en el importador o normalización manual de datos.

---

## Variables de entorno requeridas (`.env.local`, nunca se commitea)

```
NEXT_PUBLIC_SUPABASE_URL=https://tqwkzquchktsjutksjdk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       ← solo server-side (cron), nunca en cliente
CRON_SECRET=...                     ← protege /api/cron/renovaciones
RESEND_API_KEY=...                  ← emails de renovación
GROQ_API_KEY=...                    ← asistente IA
```

## Servicios externos

| Servicio | Uso | Plan | Riesgo |
|---|---|---|---|
| Supabase | DB + Auth + Storage | **Free** | Se pausa por inactividad — ver arriba |
| Vercel | Hosting + Cron | Free | — |
| Resend | Emails de renovación | Free (3.000/mes, 100/día) | Límite bajo si se activa email marketing |
| Groq | Asistente IA (Llama 3.3) | Free tier | — |

---

## Checklist antes de pushear a `main`

```bash
npx tsc --noEmit   # 0 errores TypeScript
npm run build      # build exitoso
```
- Nunca `git push --force` a `main`
- Migraciones SQL nuevas se aplican **manualmente** en Supabase SQL Editor (no hay CLI configurado) — revisar `supabase/*.sql` sin aplicar antes de asumir que el schema está al día
- Operaciones sobre `workspaces` / `workspace_members` / `workspace_invitations` deben ir por RPC `SECURITY DEFINER`, nunca query directa

---

## Dónde mirar para más detalle

- **Historial completo de desarrollo por fases** → [BITACORA.md](./BITACORA.md)
- **Convenciones de código, estructura de carpetas, contextos React, RBAC** → [ONBOARDING.md](./ONBOARDING.md)
- **Migraciones SQL pendientes/aplicadas** → carpeta [`supabase/`](./supabase/) + tabla en BITACORA.md
