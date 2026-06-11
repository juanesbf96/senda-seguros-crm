# Bitácora de Desarrollo — Senda Seguros CRM

> Última actualización: 11 de junio de 2026  
> Stack: Next.js 16.2.4 · Supabase (PostgreSQL + Auth + Storage) · Tailwind CSS · Vercel

---

## ¿Qué es Senda CRM?

Herramienta de gestión para la agencia de seguros **Senda Seguros**, construida 100% a medida. Permite administrar clientes, pólizas, solicitudes, cobranzas, tareas, vendedores y más desde un solo lugar. Arquitectura multi-workspace con roles (superadmin, admin, supervisor, agente), desplegada en Vercel con base de datos en Supabase.

**Repositorio GitHub:** `https://github.com/juanesbf96/senda-seguros-crm`  
**URL de producción:** desplegada automáticamente desde `main` en Vercel cada vez que se hace push.  
**Cuenta admin del CRM:** `sendaseg@gmail.com` · Workspace: `Sara Lopera Workspace`

---

## Estado Actual del Proyecto

| Área | Estado |
|------|--------|
| Autenticación / Workspaces | ✅ Funcional |
| Clientes (CRUD + importación Excel) | ✅ Funcional |
| Pólizas (CRUD + multi-select + importación) | ✅ Funcional |
| Solicitudes (12 tipos + tabs) | ✅ Funcional |
| Tareas | ✅ Funcional |
| Pipeline / Prospectos | ✅ Funcional |
| Cobros / Caja | ✅ Funcional |
| Facturas | ✅ Funcional |
| Liquidaciones de vendedores | ✅ Funcional |
| Agenda | ✅ Funcional (solo eventos, tareas, cobros, prospectos) |
| Archivos (Supabase Storage) | ✅ Funcional (adjuntos visibles en detalle de póliza) |
| Informes / Gráficas | ✅ Funcional |
| Asistente IA (Groq / Llama 3.3) | ✅ Funcional |
| Notificaciones de renovación (email diario) | ✅ Configurado — pendiente activar cron en prod |
| Email marketing | ⏸ Diferido (se retoma más adelante) |
| Paginación en Pólizas | ⚠️ Pendiente |

---

## Historial de Desarrollo

### Fase 0 — Inicio del proyecto
**04 mayo 2026**
- Creación del proyecto Next.js en `/Users/juanestebanboterof/senda-seguros-crm`
- Configuración inicial de Supabase, `.env.local`, `vercel.json`
- Deploy inicial en Vercel

---

### Fase 1 — Base funcional y autenticación
**05 mayo 2026**
- Integración de Supabase Auth: login, registro, perfil de usuario
- Flujo de verificación de email y callback
- Checkbox "recuérdame"
- Corrección loop redirect en login (`window.location.href`)
- Rename `middleware.ts` → `proxy.ts` (convención Next.js 16)

---

### Fase 2 — Sprints de módulos core (S1–S8)
**06–07 mayo 2026**

**Sprint S1 — Dashboard y Clientes base**
- Dashboard rediseñado con métricas reales
- Tipos de cliente y contactos vinculados

**Sprint S2 — Pólizas y Solicitudes**
- Módulo pólizas completo (incluyendo Pólizas Cumplimiento)
- Módulo Solicitudes con tipos iniciales

**Sprint S3 — Tareas, Renovaciones y Remisiones**
- Gestor de renovaciones con seguimiento por póliza
- Módulo de remisiones

**Sprint S4 — Cobros y Caja**
- Cuadre de caja
- Recibos de pago

**Sprint S5 — Liquidaciones y Prospectos**
- Liquidar vendedores (comisiones)
- CRM Prospectos (pipeline comercial)

**Sprint S6 — Informes y Archivos**
- Gráficas en módulo de informes
- Gestión de archivos con Supabase Storage

**Sprint S7 — Siniestros, Facturas, Diligencias**
- Módulo siniestros
- Facturas (primera versión)
- Diligencias

**Sprint S8 — Metas, Asistente IA y Configuración**
- Módulo de metas
- Asistente virtual con IA
- Módulo de configuración general

**Adicionalmente (07 mayo 2026):**
- Facturas v2 con spec colombiana
- Sistema de Toast global
- Módulos configurables (activar/desactivar desde configuración)
- Dashboard financiero real + informes con `prima_neta`
- Filtros avanzados en Clientes y Pólizas
- Perfil de cliente con 8 pestañas
- Archivos clasificados por categorías

---

### Fase 3 — Multi-workspace y RBAC
**08–16 mayo 2026**

**Arquitectura multi-tenant:**
- Tabla `workspaces`, `workspace_members`, `workspace_invitations`
- Todos los queries filtran por `workspace_id` — 14 módulos corregidos
- Onboarding migra datos existentes al workspace del usuario

**Sistema de roles (RBAC):**
- Roles: `superadmin`, `admin`, `supervisor`, `agente`
- Permisos configurables desde `rbac_permissions.sql`
- Flag `isGlobal = isAdmin || isSupervisor` para vistas filtradas
- Agentes solo ven sus propios clientes/pólizas/tareas/solicitudes

**Invitaciones y gestión de miembros:**
- RPC `create_workspace_invitation` (bypasea RLS)
- RPC `get_user_workspaces` para carga segura
- Vista de miembros con email real desde `auth.users`

**Asistente IA:**
- Integración Groq API (modelo Llama 3.3)
- Contexto del CRM inyectado en cada consulta

---

### Fase 4 — Rediseño UI y mejoras funcionales
**13–17 mayo 2026**

**Rediseño UI completo:**
- Design system tokenizado (colores, tipografía, espaciado consistente)
- Sidebar con secciones colapsables
- TopBar con botones flotantes (Mensajes, Notificaciones, Perfil)
- Switcher SEG HQ ↔ MKT HQ

**Mejoras funcionales:**
- Solicitudes: expandidas de 3 a 12 tipos con tabs horizontales con scroll  
  _(Todas, Cotizaciones, Expediciones, Renovaciones, Endosos, Cancelaciones, Certificados, Siniestros, Inclusiones, Exclusiones, Otros, Inactivas)_
- Dashboard: vista diferenciada por rol (agente ve solo sus datos, badge "Vista de agente")
- Paginación: 50 registros/página en Clientes y Cobros
- Clientes: export CSV, multi-select con acciones rápidas, tabs Cobros y Remisiones

**Notificaciones automáticas de vencimiento:**
- Vercel Cron: `0 13 * * *` (8am Colombia = 13:00 UTC)
- Endpoint: `app/api/cron/renovaciones/route.ts`
- Protegido con `CRON_SECRET` Bearer token
- RPC `get_polizas_por_vencer(dias_max: 30)` con SECURITY DEFINER
- Umbrales: **30, 15 y 7 días** antes del vencimiento
- Solo envía email si hay pólizas en esos rangos
- Tabla de dedup: `notificaciones_renovacion` con `UNIQUE(poliza_id, dias_alerta, fecha_envio)`
- Email enviado vía **Resend API** (plan free: 3.000/mes, 100/día)
- Correo destino: `juanes.bf96@gmail.com` (owner del workspace)
- Email HTML en español con tabla color-coded: 🟢30d · 🟠15d · 🔴7d

**Tareas:**
- Filtro multi-select de prioridad
- Auto-switch de tab tras crear tarea

---

### Fase 5 — Importación Excel inteligente
**31 mayo – 2 junio 2026**

**Importador Excel (archivo `VENTAS_SENDA`):**
- Soporte multi-hoja: detecta automáticamente hojas por año (2023, 2024, 2025, 2026)
- Lee el Excel con `xlsx` + `cellDates: true` para fechas nativas
- Crea **cliente** y **póliza** simultáneamente desde el mismo archivo
- Detecta aseguradoras nuevas y las agrega dinámicamente al filtro
- Lógica upsert: busca cliente por cédula → crea si no existe; busca póliza por número → actualiza si existe, crea si no
- Reemplazó upsert con `onConflict` (fallaba sin constraint único) por **lookup + insert/update**
- Parser de fechas robusto: maneja `Date` objects, seriales Excel, `dd/mm/yyyy`, `yyyy-mm-dd`
- Aliases de columna flexibles con soporte para múltiples nombres por campo
- Logs de debug en consola: `[Import] Headers detectados`, `[Import] Índice columna fecha_fin`

**Campos financieros agregados a pólizas** (migración `migration_polizas_campos_financieros.sql`):
`prima_periodica`, `pct_comision_negocio`, `comision_negocio_anual`, `comision_periodica`, `pct_comision_abc`, `retencion_agencia`, `comision_abc_periodica`, `comision_abc_anual`, `comision_abc_recibida`, `fecha_pago_abc`, `intermediario`, `pct_comision_int`, `comision_intermediario`, `referido`, `pct_comision_referido`, `retencion_referido`, `comision_referido`, `comision_asesor_pagada`, `fecha_pago_asesor`, `es_renovacion`, `mes_emision`, `endoso_enviado`, `cancelada_anterior`, `aseguradora_anterior`

**Historial de cambios por cliente:**
- Log automático de modificaciones en tabla `historial_clientes`
- Pestaña "Timeline" en el detalle de cliente

---

### Fase 6 — Ajustes de formularios y UX
**01–02 junio 2026**

**Formulario de cliente simplificado:**
- Eliminados: campo `Consorcio`, campo `Categoría` (VIP, Estándar, etc.), campo `Sobrenombre/Alias`
- Solo quedan: Persona Natural y Empresa (grid de 2 columnas)

**Pólizas — aseguradora "Otro" editable:**
- Al seleccionar "Otro" en el dropdown de aseguradora aparece un input de texto editable
- Permite ingresar o importar aseguradoras que no están en la lista predefinida
- Si la póliza existente tiene una aseguradora no reconocida, el modo "Otro" se activa automáticamente

**Estado activo/inactivo por fecha:**
- Eliminada dependencia del campo `estado` almacenado
- Póliza activa = `fecha_fin >= hoy` (calculado dinámicamente)
- `fecha_fin` siempre visible en detalle de cliente (antes era condicional)
- Fecha fin en rojo si la póliza está vencida

**Aseguradoras dinámicas en filtros:**
- `PolizasList` carga valores DISTINCT de `aseguradora` desde la BD
- El filtro refleja todas las aseguradoras realmente presentes en el workspace

---

### Fase 7 — Multi-selección en tabla de pólizas
**02 junio 2026**

- Checkbox por fila (individual) y checkbox en encabezado (seleccionar todo)
- Filas seleccionadas se resaltan en `bg-primary-50`
- **Barra flotante** al seleccionar (fija, centro inferior, z-40):
  - Muestra conteo: "X seleccionada(s)"
  - **Exportar** → genera y descarga CSV con: Cliente, Aseguradora, Ramo, N° Póliza, Prima, Comisión, Inicio/Fin vigencia, Estado
  - **Eliminar** → confirmación inline antes de borrar masivamente
  - **X** → deselecciona todo
- Equivalente a la funcionalidad de multi-select ya existente en la tabla de Clientes

---

### Fase 8 — Mejoras UX en pólizas y formularios
**10–11 junio 2026**

**Detalle de póliza:**
- N° Póliza en la tabla de pólizas es ahora un enlace clickeable hacia `/polizas/[id]`
- Página de detalle de póliza con iconos por ramo (Car, Heart, Home, Shield, etc.)
- Adjuntos visibles en el detalle de póliza: lista de archivos con descarga directa
- Enlace al detalle de póliza desde la pestaña Pólizas del cliente (número clickeable + botón →)

**Formulario de póliza (PolizaModal):**
- Campo "Cliente" reemplazado por combobox buscable (autocomplete, sin scroll largo)
- Vigencia hasta se calcula automáticamente como vigencia desde + 1 año
- Campos de Banco y Medio de pago eliminados
- Checkbox "En remisión" eliminado
- Forma de pago cambiada a: Contado / Financiación / Mensual
  - Si "Financiación": aparecen campos **Financiera** (Crediseguro, Finesa, Servicrédito) y **Número de cuotas**
  - Si periodicidad = "Mensual": aparece campo **Prima mensual antes de IVA** con resumen de comisión neta mensual
- Comisión agencia muestra desglose: bruta → retención 10% → **comisión neta** (siempre descontada la retención en la fuente)
- Lista de aseguradoras cargada dinámicamente desde **Configuración → Listas** (no hardcodeada)

**Agenda:**
- Eliminados los vencimientos de pólizas de la agenda (ahora solo en módulo Renovaciones)
- Leyenda actualizada: Mis eventos · Tareas · Cobros · Prospectos

**Ficha de cliente:**
- Nuevo campo **Tipo de documento**: Cédula / Cédula de Extranjería / Pasaporte / PPT

**Módulo Remisiones:**
- Eliminado del sidebar (ya no es necesario como módulo independiente)

**Migraciones aplicadas en esta fase:**
- `migration_prima_mensual.sql` — columna `prima_mensual` en pólizas
- `migration_financiacion.sql` — columnas `financiera` y `num_cuotas` en pólizas
- `migration_tipo_documento.sql` — columna `tipo_documento` en clientes

---

## Migraciones SQL aplicadas en Supabase

| Archivo | Descripción | Estado |
|---------|-------------|--------|
| `schema.sql` | Esquema base del CRM | ✅ Aplicado |
| `migration_v2.sql` | Campos extendidos v2 | ✅ Aplicado |
| `migration_multiworkspace.sql` | Arquitectura multi-tenant | ✅ Aplicado |
| `migration_multiworkspace_fase2.sql` | RPCs y RLS multi-workspace | ✅ Aplicado |
| `rbac_permissions.sql` | Sistema de permisos RBAC | ✅ Aplicado |
| `migration_s2.sql` / `_v2.sql` | Sprint S2 | ✅ Aplicado |
| `migration_s3.sql` / `_v2.sql` | Sprint S3 | ✅ Aplicado |
| `migration_s4.sql` / `_v2.sql` | Sprint S4 | ✅ Aplicado |
| `migration_s5.sql` | Sprint S5 | ✅ Aplicado |
| `migration_s6.sql` | Sprint S6 | ✅ Aplicado |
| `migration_s7.sql` | Sprint S7 | ✅ Aplicado |
| `migration_s8.sql` | Sprint S8 | ✅ Aplicado |
| `migration_sprint_a.sql` | Sprint A (campos feedback) | ✅ Aplicado |
| `migration_assigned_to.sql` | Campo asignación de clientes | ✅ Aplicado |
| `migration_campanas.sql` | Campañas de renovación | ✅ Aplicado |
| `migration_agenda.sql` | Módulo agenda | ✅ Aplicado |
| `migration_facturas_v2.sql` | Facturas colombianas v2 | ✅ Aplicado |
| `migration_excel_import.sql` | Soporte importación Excel | ✅ Aplicado |
| `migration_historial_clientes.sql` | Timeline de cambios por cliente | ✅ Aplicado |
| `migration_notificaciones_renovacion.sql` | Cron de renovaciones + tabla dedup | ✅ Aplicado |
| `migration_polizas_campos_financieros.sql` | 23 campos financieros en pólizas | ✅ Aplicado |
| `migration_tareas_fix.sql` / `_fix2.sql` | Fixes schema tareas | ✅ Aplicado |
| `fix_data_migration.sql` | Fix datos corruptos post-merge | ✅ Aplicado |
| `reset_clientes_polizas.sql` | Borrado masivo para reimportación | ✅ Aplicado |
| `migration_fix_archivos_rls.sql` | Fix RLS en tabla archivos y Storage bucket | ✅ Aplicado |
| `migration_prima_mensual.sql` | Campo `prima_mensual` en pólizas | ✅ Aplicado |
| `migration_financiacion.sql` | Campos `financiera` y `num_cuotas` en pólizas | ✅ Aplicado |
| `migration_tipo_documento.sql` | Campo `tipo_documento` en clientes | ✅ Aplicado |

---

## Variables de Entorno (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://tqwkzquchktsjutksjdk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...       ← solo en server (cron), nunca en cliente
CRON_SECRET=...                     ← protege el endpoint /api/cron/renovaciones
RESEND_API_KEY=re_GvfYLhDa_...      ← emails de renovación
GROQ_API_KEY=...                    ← asistente IA
```

> ⚠️ `.env.local` está en `.gitignore` y nunca se commitea.

---

## Servicios externos configurados

| Servicio | Uso | Plan |
|----------|-----|------|
| **Supabase** | Base de datos, Auth, Storage | Free / Pro |
| **Vercel** | Hosting + Cron Jobs | Free |
| **Resend** | Emails notificaciones renovación | Free (3.000/mes, 100/día) |
| **Groq** | Asistente IA (Llama 3.3 70B) | Free tier |

---

## Pendientes y próximos pasos

### 🟡 Mejoras pendientes
- **Paginación en tabla de Pólizas** (ya implementada en Clientes y Cobros, falta aquí)
- **Email marketing a clientes** (explícitamente diferido): cuando se retome, Resend está configurado con 100 emails/día → ~500 clientes en 5 días

### 🟢 Ideas futuras (no priorizadas)
- App móvil o PWA
- Integración WhatsApp para notificaciones
- Reportes exportables a PDF
- Portal de autogestión para clientes

---

## Arquitectura de carpetas relevante

```
senda-seguros-crm/
├── app/
│   ├── (crm)/              ← Módulos del CRM (autenticados)
│   │   ├── clientes/
│   │   ├── polizas/
│   │   ├── solicitudes/
│   │   ├── tareas/
│   │   ├── cobros/
│   │   ├── facturas/
│   │   ├── liquidaciones/
│   │   ├── agenda/
│   │   ├── archivos/
│   │   ├── informes/
│   │   ├── metas/
│   │   ├── asistente/
│   │   └── configuracion/
│   ├── (mkt)/              ← Módulo marketing (separado)
│   ├── api/
│   │   └── cron/
│   │       └── renovaciones/route.ts   ← Cron diario 8am CO
│   ├── auth/               ← Callbacks Supabase Auth
│   ├── login/
│   ├── registro/
│   └── onboarding/
├── components/             ← Componentes por módulo
├── supabase/               ← Migraciones SQL
├── types/index.ts          ← Tipos TypeScript globales
├── vercel.json             ← Cron job configurado
├── ONBOARDING.md           ← Contexto para Claude Code
├── BITACORA.md             ← Este archivo
└── .env.local              ← Credenciales (no commitear)
```

---

*Última actualización: 11 de junio de 2026. Total de commits en `main`: ~105.*
