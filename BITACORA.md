# Bitácora de Desarrollo — Senda Seguros CRM

> Última actualización: 18 de julio de 2026  
> Stack: Next.js 16.2.4 · Supabase (PostgreSQL + Auth + Storage) · Tailwind CSS · Vercel

---

## Fase 11 — Auditorías competitivas + Fundaciones (julio 2026)

Se auditaron a fondo dos plataformas para orientar el roadmap de Senda:

- **Guro** (guro.co) — SaaS colombiano de seguros con sincronización directa de portales de aseguradoras y motor de IA BYOK (el cliente trae su llave de DeepSeek/OpenAI/Claude/Gemini; los tokens se cobran a su cuenta). Diferenciadores: sync de 11 aseguradoras, cartera con aging buckets, WhatsApp integrado, ventas cruzadas con IA, extractor y caché de análisis 30 días.
- **Cider** (cidersure.zohoplatform.com) — vertical de seguros sobre **Zoho CRM** donde **Ríos Agencia opera hoy en producción** (2,231 pólizas, 3,996 operaciones). Es el sistema que Senda busca reemplazar. Hallazgos clave: modelo de datos profundo (tomador ≠ asegurados, riesgos, coberturas, certificados, técnico ≠ vendedor), "Operaciones de Producción" unificando renovación/cobro-cuota/cancelación, churn como ciudadano de primera clase (motivo de cancelación + no-renovación), creación de pólizas vía **Extractor PDF** de carátulas.

**Entregable:** `PLAN_EJECUCION_AUDITORIAS.md` — plan de 6 fases (calidad → retención/cartera → paridad de modelo de datos → operaciones de producción → automatización/IA → WhatsApp), con 15 PRs sugeridos en orden y criterios de aceptación. Rama `docs/plan-ejecucion-auditorias` (PR pendiente de merge).

### Estado de ejecución del plan

| Fase | Tarea | Estado |
|------|-------|--------|
| 0.1 | Tests del parser (Excel + colillas) con fixtures | ✅ Hecho (PR #19 mergeado — `test/colillas-parsers`) + fix de schema drift (PR #18) |
| 0.2 | **Supabase CLI + ambiente de staging** | 🟡 En curso — ver detalle abajo |
| 0.3 | Trazabilidad (`origen_creacion` + cronología) | ⬜ Pendiente |
| 1.1 | Motivo de cancelación / no-renovación | ⬜ Pendiente |
| 1.2 | Aging de cartera (buckets de mora) | ⬜ Pendiente |
| 1.3 | KPIs comparativos en Dashboard | ⬜ Pendiente |
| 2.x | Paridad de modelo de datos con Cider | ⬜ Pendiente |
| 3.x | Operaciones de Producción | ⬜ Pendiente |
| 4.x | Automatización e IA (extractor PDF, cross-sell, motor multi-proveedor) | ⬜ Pendiente |
| 5.x | WhatsApp | ⬜ Pendiente |

### Fase 0.2 — Supabase CLI + staging (rama `infra/supabase-cli-staging`)

**Hecho:**
- `supabase init` — `config.toml` + directorio `supabase/migrations/` para migraciones versionadas.
- **Proyecto `senda-staging` creado** en Supabase (ref `xfpezdaacotlyeysuqhs`, región East US).
- **Baseline volcado desde producción** con `supabase db pull` vía pooler IPv4 → `supabase/migrations/20260718075314_remote_schema.sql` (schema real, registrado en el historial de migraciones de prod).
- `scripts/setup-staging.sh` — script idempotente que orquesta todo el setup (login, creación de proyecto, pull del baseline, push a staging, guardado de credenciales en `.env.local`). Robustecido tras varios obstáculos reales: login no-TTY, Docker faltante (resuelto con Colima), IPv6-only del host directo (resuelto usando el pooler), passwords con símbolos.
- `supabase/STAGING.md` — manual del flujo staging-antes-que-prod; reglas ("ningún PR con migración se mergea sin 'Probada en staging: sí'").
- Scripts npm: `db:new`, `db:push:staging`, `db:pull`, `db:diff`.
- `ONBOARDING.md` actualizado (reemplaza "no hay CLI, todo manual").
- `Colima` + `docker` instalados como runtime local para el CLI.

**Falta para cerrar la fase:**
- **Aplicar el baseline en `senda-staging`** (`supabase db push` vía pooler): bloqueado por autenticación del password de la BD de staging — pendiente de resetear el password a uno alfanumérico y reintentar (el script ya reintenta en bucle).
- Verificar que staging tenga todas las tablas y RPCs de producción.
- Revisar el baseline contra drift histórico (comparar con los `migration_*.sql`).
- Crear `supabase/seed.sql` (seed mínimo anonimizado — no copiar datos reales de clientes).
- Mergear el PR de `infra/supabase-cli-staging` y el de `docs/plan-ejecucion-auditorias`.

> **Nota operativa:** el password de la BD de producción se rotó durante este setup. La app (Vercel + local) usa las API keys, no ese password, así que no hubo impacto en el servicio. Pendiente: rotar de nuevo el de prod a uno fuerte una vez cerrada la fase (quedó uno temporal débil visible en pantalla durante el proceso).

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
| Afiliados en pólizas colectivas | ✅ Funcional (Fase 8 + 9) |
| Colillas de comisiones (importación + conciliación) | ✅ Funcional (Fase 10) |
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

### Fase 9 — Afiliados en pólizas colectivas (Fase 1 + 2)
**10 junio 2026**

#### Fase 9.1 — Base de afiliados
- Nuevo tipo de cliente: **`grupo_familiar`** (junto a `persona_natural`, `empresa`, `consorcio`)
- Columnas en pólizas: `es_colectiva BOOLEAN` y `prima_por_afiliado NUMERIC`
- Nueva tabla **`poliza_afiliados`**: afiliados por póliza colectiva con campos `nombre_completo`, `numero_documento`, `fecha_nacimiento`, `fecha_inicio`, `fecha_retiro`, `numero_poliza_individual`, `parentesco`, `activo`, `notas`
- RLS, índices y trigger `updated_at` en `poliza_afiliados`
- Campo `afiliado_id` en `siniestros` (referencia opcional al afiliado)
- Nuevas claves RBAC: `afiliados_ver`, `afiliados_gestionar`, `afiliados_gestionar_propios`
- **`AfiliadosTab`**: tabla con toggle activos/inactivos, multi-select + barra flotante (exportar CSV, inactivar masivo), CRUD individual
- **`AfiliadoModal`** (v1): crear/editar afiliado con campos básicos
- **`ImportAfiliadosModal`**: importación Excel de afiliados con fuzzy column matching, upsert por `(poliza_id, numero_documento)`
- **`PolizaDetalle`**: sección de afiliados si `es_colectiva`
- **`ClienteDetalle`**: pestaña "Afiliados" condicional si el cliente es empresa/grupo_familiar y tiene póliza colectiva
- **`PolizaModal`**: toggle "Póliza colectiva" + campo `prima_por_afiliado`
- **`ClientesList`**: label y color para `grupo_familiar`
- Migración aplicada: `migration_afiliados.sql`

#### Fase 9.2 — Planes variables, tipo documento, multi-póliza
- Nueva tabla **`poliza_planes`**: planes dentro de pólizas Vida Grupo (nombre, valor_cobertura, prima_plan calculada)
- Columnas en `poliza_afiliados`: `plan_id`, `prima_individual`, `tipo_documento` (TEXT NOT NULL DEFAULT 'CC')
- Nueva tabla **`afiliado_cambios_plan`**: historial de cambios de plan y prima por afiliado
- **`AfiliadoModal`** (v2, reescrito):
  - Dropdown tipos documento: CC, CE, TI, NIT, PA, RC, PPT, NUIP
  - Selector de póliza colectiva con dropdown cuando abre desde cliente (multi-póliza)
  - Selector de plan (si la póliza tiene planes definidos)
  - Campo `prima_individual` por afiliado
  - Prop `planInicial` para pre-seleccionar plan al agregar desde pestaña de plan específico
  - Registro automático en `afiliado_cambios_plan` cuando cambia plan o prima en edición
  - Recalculo en cascada: prima_plan → prima_poliza
- **`PlanModal`** *(nuevo)*: crear/editar planes (nombre + valor_cobertura opcional; prima_plan es automática)
- **`AfiliadosPorPlan`** *(nuevo)*: vista con tabs por plan para pólizas Vida Grupo
  - Tab por cada plan con conteo de afiliados activos
  - Info del plan: cobertura + prima del plan
  - CRUD de afiliados por plan, toggle activos/inactivos
  - Botones crear plan y editar plan desde la barra del plan activo
  - Afiliados "sin plan asignado" agrupados al final
- **`AfiliadosTab`** (actualizado):
  - Modo dual: `poliza` fija (póliza específica) o `clienteId` (todas las colectivas del cliente)
  - En modo clienteId: carga afiliados de todas las pólizas colectivas del cliente, muestra columna "Póliza"
  - Columnas: tipo_documento + documento (juntos), prima_individual, parentesco
  - Recalculo de prima usa suma de `prima_individual` activos (con fallback a `prima_por_afiliado × count`)
- **`PolizaDetalle`** (actualizado): ramo `vida grupo` → `AfiliadosPorPlan`; otros colectivos → `AfiliadosTab`
- **`ClienteDetalle`** (actualizado): tab Afiliados visible para cualquier cliente colectivo (no requiere póliza existente); pasa `clienteId` en lugar de `polizaColectiva` → modal muestra dropdown de pólizas disponibles
- **`ClienteModal`** (actualizado): sección "Información laboral" (Ingresos, Ocupación, Estado civil, Género) oculta para tipos `empresa` y `grupo_familiar`
- Migración aplicada: `migration_afiliados_v2.sql`

---

### Fase 10 — Colillas de comisiones
**11–27 junio 2026**

#### Preparación (11–18 junio)

**Mejoras al importador de pólizas:**
- Resolución automática de `vendedor_id` por nombre al importar Excel
- Normalización de porcentajes: convierte decimales de Excel (0.10) a porcentaje real (10%)
- Auto-creación de vendedores nuevos encontrados en el Excel
- Tarifas de comisión configurables: tabla por ramo + aseguradora con % (desde Configuración → Listas)
- Ramos e aseguradoras en filtros cargados dinámicamente desde la BD (no hardcodeados)
- Cobros: lista de aseguradoras cargada desde `configuracion` en lugar de lista fija

**Mejoras a pólizas:**
- Separación en tarjetas independientes: Vendedor, Intermediario y Referido
- Módulo de detalle elimina columnas Tipo/Riesgo; agrega Vendedor e Intermediario
- Panel de vista rápida de póliza desde el módulo de Cobros (quick peek lateral)

#### Fase 10.1 — Módulo Colillas de Comisiones (base)

**Modelo de datos:**
- Nueva tabla `colillas_importacion`: cabecera por colilla (aseguradora, periodo, estado, conteos)
- Nueva tabla `colilla_lineas`: líneas individuales con `poliza_id`, `numero_poliza_raw`, `nombre_tomador`, `valor_prima`, `valor_comision`, `estado_conciliacion`
- Estados de conciliación: `conciliada` | `corregida_manual` | `no_encontrada` (+ `probable` client-side only)
- RLS con `is_workspace_member()` en ambas tablas
- Migración: `migration_colillas.sql`

**Parsers por aseguradora** (`lib/colillas/parsers/`):
- SURA (CSV), Seguros Bolívar (XLSX), Solidaria (CSV), 48 Horas (XLSX — usa VOUCHER en vez de N° póliza)
- Parser base con tipos `ColillaLineaRaw` y `AseguradoraKey`

**Reconciliación server-side** (`lib/colillas/reconciliar.ts`):
- Paso 1: match exacto por `numero_poliza`
- Paso 2: match probable por nombre del tomador (≥2 palabras coincidentes de ≥4 chars)
- `calcularStats()`: conteo de conciliadas/probables/sin-match y total comisión (excluye no_encontradas)

**API Routes:**
- `POST /api/colillas/parsear` — sube el archivo, detecta parser, reconcilia y devuelve líneas + stats
- `POST /api/colillas/crear` — guarda colilla en borrador + líneas; actualiza `numero_poliza` en CRM si se solicitó; resuelve `probable` → `corregida_manual` server-side
- `POST /api/colillas/[id]/confirmar` — RPC atómica que activa la colilla
- `PATCH /api/colillas/[id]/linea/[lineaId]` — actualiza vinculación de una línea individual

**UI — ImportColillasModal (3 pasos):**
- **Paso 1 Subir**: selector de aseguradora, período y archivo con drag & drop
- **Paso 2 Preview**: tabla resumen con stats (conciliadas, sin match, total comisión); aviso especial para 48 Horas
- **Paso 3 Revisar**: 5 secciones ordenadas por prioridad:
  1. **Por completar** (azul) — candidato seleccionado pendiente de confirmar; tarjeta de preview con [Cancelar][Crear nueva][✓ Confirmar]
  2. **Sin match** (ámbar) — buscador multi-campo + link "Crear póliza nueva"
  3. **Vinculadas manualmente** (verde colapsable) — con botón × para desvincular
  4. **Posibles coincidencias por nombre** (azul) — checkboxes pre-marcados; desmarcar → sin match
  5. **Conciliadas automáticamente** (verde colapsable)
  - Aviso antes de confirmar si hay selecciones pendientes de confirmar
  - Checkbox "Actualizar N° póliza en CRM" por vinculación manual

**UI — ColillaDetalle:**
- Tabla de líneas con chips de estado (color por conciliación)
- `CeldaVincular`: buscador multi-campo inline para vincular manualmente; incluye "Crear póliza nueva" con PolizaModal pre-relleno
- Botón volver corregido

**UI — ColillasView:**
- Lista de colillas del workspace con estado, período y aseguradora
- Botón importar restringido a admin/supervisor
- Acceso desde sidebar (guard por rol)

#### Fase 10.2 — Mejoras UX y correcciones (post-testing)

**PolizaModal:**
- Detección de modo crear/editar cambiada de `poliza ?` a `poliza?.id ?` — permite pasar objeto pre-relleno sin ID sin activar modo edición
- `nombre_tomador` movido a sección 1 "Información básica" (visible sin scrollear)
- `clienteSearch` pre-poblado con `nombre_tomador` cuando se abre desde colilla en modo crear
- Etiquetas mejoradas: "Cliente CRM *" vs "Nombre del tomador (en la póliza)"

**Buscador de pólizas (multi-campo):**
- Busca en paralelo: `numero_poliza`, `nombre_tomador`, `asegurado_nombre` y clientes por nombre/teléfono/email → sus pólizas
- Eliminado join `clientes()` en la query de pólizas (fallaba si PostgREST no detecta la FK); reemplazado por `clienteMap` construido en pasos separados
- Dropdown renderizado vía `createPortal` en `document.body` con `position: fixed` (soluciona recorte por `overflow-y-auto` del modal)
- Muestra spinner "Buscando..." y mensaje "Sin resultados para X" cuando no hay coincidencias
- Errores de Supabase logeados por consola por query

**Bug investigado (no corregido en código — es un problema de datos):**
- Algunas pólizas muestran un número de teléfono en el campo `aseguradora`
- Causa: importación previa desde Excel donde la columna de aseguradora contenía el teléfono del cliente en esas filas, o detección incorrecta de columna
- Registros duplicados del mismo cliente con los mismos datos (misma fecha) sugieren importación repetida
- Pendiente: limpiar registros corruptos con query SQL en Supabase

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
| `migration_afiliados.sql` | Tabla `poliza_afiliados`, tipo `grupo_familiar`, `es_colectiva` en pólizas, RBAC afiliados | ✅ Aplicado |
| `migration_afiliados_v2.sql` | Tabla `poliza_planes`, `afiliado_cambios_plan`, `plan_id` + `prima_individual` + `tipo_documento` en afiliados | ✅ Aplicado |
| `migration_colillas.sql` | Tablas `colillas_importacion` + `colilla_lineas`, RLS, índices | ✅ Aplicado |

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

### 🔴 Bugs conocidos
- **Pólizas con número de teléfono en campo aseguradora**: datos corruptos de importación Excel previa. Pendiente limpiar con query SQL en Supabase (borrar registros donde `aseguradora` solo contiene dígitos y `numero_poliza` es NULL).

### 🟡 Mejoras pendientes
- **Paginación en tabla de Pólizas** (ya implementada en Clientes y Cobros, falta aquí)
- **Buscador de pólizas en colillas**: campo `nombre_tomador` a veces es NULL y el nombre real está en `asegurado_nombre` — ya corregido en ImportColillasModal, pendiente verificar en ColillaDetalle
- **Validación al importar pólizas**: rechazar filas donde `aseguradora` contenga solo dígitos para evitar que teléfonos queden en ese campo
- **Email marketing a clientes** (explícitamente diferido): cuando se retome, Resend está configurado con 100 emails/día → ~500 clientes en 5 días

### 🟢 Ideas futuras (no priorizadas)
- App móvil o PWA
- Integración WhatsApp para notificaciones
- Reportes exportables a PDF
- Portal de autogestión para clientes
- Historial de comisiones por vendedor (a partir de colillas confirmadas)

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

*Última actualización: 18 de julio de 2026. Total de commits en `main`: ~145+.*
