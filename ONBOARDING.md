# Senda Seguros CRM — Onboarding para nuevas instancias de Claude Code

> Este archivo es el punto de entrada para cualquier instancia de Claude Code que se conecte al proyecto. Léelo completo antes de tocar cualquier archivo.

---

## 1. Proyecto en una línea

CRM para agencias de seguros colombianas. Multi-workspace, multi-rol, construido en Next.js 16 + Supabase (PostgreSQL + Auth + RLS).

---

## 2. Credenciales y accesos

### Repositorio
```
https://github.com/juanesbf96/senda-seguros-crm.git
rama principal: main
```
Auto-deploy en Vercel en cada push a `main`.

### Supabase (producción)
```
URL:       https://tqwkzquchktsjutksjdk.supabase.co
ANON KEY:  sb_publishable_66bphL6Q-hpVT5HkX5GU_Q_hms9aQAI
```

> **SERVICE ROLE KEY** — no se incluye aquí por seguridad.  
> Obtenla del archivo `.env.local` del proyecto (solicítala al owner) o desde  
> **Supabase Dashboard → Project Settings → API → service_role key**.  
> Agrégala en `.env.local` como `SUPABASE_SERVICE_ROLE_KEY=...`

El `.env.local` **nunca debe commitearse** (está en `.gitignore`).

### Cuenta admin de la app
```
Email:    sendaseg@gmail.com
Workspace: Sara Lopera Workspace  (owner_id = ese usuario)
```

---

## 3. Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js **16.2.4** con App Router (Turbopack en dev) |
| Auth + DB | Supabase (PostgreSQL 15, Auth, RLS) |
| ORM/client | `@supabase/supabase-js` v2 + `@supabase/ssr` para server |
| Estilos | Tailwind CSS v4 |
| Iconos | Lucide React |
| Lenguaje | TypeScript estricto |
| Deploy | Vercel (auto en push a main) |

### Arrancar en local
```bash
git clone https://github.com/juanesbf96/senda-seguros-crm.git
cd senda-seguros-crm
npm install
npm run dev       # http://localhost:3000
npm run build     # verificar que compila sin errores antes de pushear
npx tsc --noEmit  # typecheck rápido
```

---

## 4. Estructura de carpetas clave

```
app/                        # Next.js App Router
  layout.tsx                # Root layout — WorkspaceProvider + PermissionsProvider
  (crm)/                    # Grupo de rutas del CRM (con sidebar)
  login/ registro/          # Autenticación pública
  onboarding/               # Configuración inicial del workspace
  invitacion/               # Aceptar invitaciones de workspace

components/
  ui/
    Sidebar.tsx             # Navegación lateral — filtra ítems por permiso
    TopBar.tsx              # Barra superior
  clientes/                 # CRUD de clientes
  polizas/                  # CRUD de pólizas
  pipeline/                 # Vista Kanban de leads
  prospectos/               # Lista de prospectos
  tareas/                   # Gestión de tareas
  metas/                    # Metas de vendedores
  siniestros/               # Registro de siniestros
  solicitudes/              # Solicitudes de pólizas
  cobros/ caja/ liquidaciones/
  configuracion/
    ConfiguracionView.tsx   # Config general (agencia, listas, módulos, permisos)
    PermisosRolesView.tsx   # UI admin para gestionar permisos RBAC
  workspace/
    WorkspaceMembersView.tsx # Invitaciones y gestión de miembros

contexts/
  WorkspaceContext.tsx      # Workspace activo, rol del usuario, lista de workspaces
  PermissionsContext.tsx    # Hook usePermissions() — can('clave') → boolean

lib/
  supabase/
    client.ts               # createBrowserClient (uso en componentes 'use client')

types/
  index.ts                  # Todos los tipos TypeScript del dominio

supabase/
  schema.sql                # Schema inicial
  migration_*.sql           # Migraciones históricas
  rbac_permissions.sql      # Sistema RBAC (aplicar en Supabase SQL Editor)

proxy.ts                    # Middleware de Next.js (protección de rutas)
```

---

## 5. Arquitectura de datos — reglas críticas

### RLS y por qué TODO va por RPC

Supabase tiene RLS habilitado en todas las tablas. Las políticas usan funciones helper (`is_workspace_member`, `get_user_role`) que cuando se llaman desde el cliente (anon key) generan recursividad y bloquean la query.

**Regla de oro:**
> Cualquier operación sobre `workspaces`, `workspace_members` o `workspace_invitations` DEBE ir por una función RPC `SECURITY DEFINER`, nunca por query directa desde el frontend.

```typescript
// ❌ NUNCA — falla por RLS recursivo
const { data } = await supabase.from('workspace_members').select('*')

// ✅ SIEMPRE — RPC bypasea RLS de forma segura
const { data } = await supabase.rpc('get_user_workspaces')
```

### RPCs existentes de workspace

| Función | Propósito |
|---------|-----------|
| `get_user_workspaces()` | Carga workspaces + roles del usuario actual |
| `setup_user_workspace(p_name)` | Crea o actualiza workspace del owner |
| `get_workspace_members(p_workspace_id)` | Lista miembros con email/nombre real |
| `get_workspace_invitations(p_workspace_id)` | Lista invitaciones pendientes |
| `create_workspace_invitation(...)` | Envía invitación (admin only) |
| `accept_workspace_invitation(p_token)` | Acepta invitación por token |
| `change_member_role(...)` | Cambia rol de un miembro |
| `remove_workspace_member(...)` | Elimina miembro |
| `cancel_workspace_invitation(...)` | Cancela invitación |
| `get_invitation_by_token(p_token)` | Lee invitación (funciona sin auth) |
| `user_has_workspace()` | Booleano — usado en proxy.ts |
| `get_my_permissions(p_workspace_id)` | Permisos del usuario actual |
| `get_workspace_permissions(p_workspace_id)` | Permisos de todos los roles (admin) |
| `update_workspace_permission(...)` | Togglea un permiso (admin only) |
| `reset_role_permissions(p_role)` | Resetea a defaults (admin only) |

### workspace_id en todas las tablas

Todas las tablas de datos (`clientes`, `polizas`, `actividades`, `tareas`, `cobros`, etc.) tienen columna `workspace_id uuid NOT NULL`. Las queries del frontend SIEMPRE filtran por `workspace_id: currentWorkspace.id`.

```typescript
// Patrón estándar de query
const { currentWorkspace } = useWorkspace()
const { data } = await supabase
  .from('clientes')
  .select('*')
  .eq('workspace_id', currentWorkspace.id)
```

### owner_id vs workspace_members

- `workspaces.owner_id` = dueño del workspace (fuente de verdad para "es mi workspace")
- `workspace_members` = todos los miembros incluido el owner (con rol `admin`)
- Para saber si el usuario es dueño: consultar `workspaces` por `owner_id`, NO `workspace_members`

---

## 6. Contextos de React — cómo usarlos

### WorkspaceContext

```typescript
import { useWorkspace } from '@/contexts/WorkspaceContext'

const {
  currentWorkspace,   // Workspace | null
  currentRole,        // 'admin' | 'supervisor' | 'agente' | null
  workspaces,         // Workspace[]
  loading,            // boolean
  isAdmin,            // currentRole === 'admin'
  isSupervisor,       // currentRole === 'admin' || 'supervisor'
  setCurrentWorkspace,
  refreshWorkspaces,
} = useWorkspace()
```

### PermissionsContext

```typescript
import { usePermissions } from '@/contexts/PermissionsContext'

const { can, loading, isAdmin } = usePermissions()

// Uso
if (can('clientes_crear')) { /* mostrar botón */ }
if (can('pipeline_eliminar_todos')) { /* mostrar delete */ }
```

**Admin siempre retorna `true`** sin consultar la DB.
**Supervisor**: retorna `true` excepto para los permisos que el admin haya desactivado.
**Agente**: retorna solo lo que esté explícitamente en `true`.

#### Claves de permiso disponibles

```
clientes_ver_todos | clientes_crear | clientes_editar_propios | clientes_editar_todos | clientes_eliminar
polizas_ver | polizas_crear | polizas_editar | polizas_eliminar
tareas_ver_todas | tareas_crear | tareas_completar_propias | tareas_editar_todas | tareas_asignar
pipeline_ver | pipeline_mover_propios | pipeline_mover_todos | pipeline_eliminar_propios | pipeline_eliminar_todos
siniestros_ver | siniestros_crear | siniestros_editar_todos
solicitudes_ver | solicitudes_crear | solicitudes_aprobar_propias | solicitudes_aprobar_todas
metas_ver | metas_crear_editar | metas_ver_metricas
finanzas_cobros_ver | finanzas_cobros_registrar | finanzas_liquidaciones_ver | finanzas_liquidaciones_crear | finanzas_caja_ver_propias | finanzas_caja_ver_todas
dashboard_ver_global | dashboard_ver_propias
configuracion_ver | configuracion_editar_agencia | configuracion_workspace_miembros
```

---

## 7. Middleware / protección de rutas

El archivo se llama **`proxy.ts`** (NO `middleware.ts`) en la raíz del proyecto. Next.js lo detecta por el export `config` con `matcher`.

Flujo:
1. No autenticado → `/login`
2. Autenticado sin workspace → `/onboarding`
3. Autenticado con workspace → acceso normal

Rutas públicas: `/login`, `/registro`, `/invitacion`, `/onboarding`

---

## 8. Sistema de roles

```
admin      → Todo permitido. Es el owner del workspace. No se puede restringir.
supervisor → Todo menos editar datos de la agencia (configurable por admin).
agente     → Acceso restringido. Solo ve/edita lo propio en la mayoría de módulos.
```

El admin puede modificar los permisos de supervisor y agente desde:
**Configuración → Permisos de roles**

Los cambios aplican inmediatamente. Se guardan en la tabla `workspace_permissions` (overrides sobre `default_permissions`).

---

## 9. Flujo de invitaciones

1. Admin va a **Configuración → Workspace & Miembros** → envía invitación por email
2. El invitado recibe link: `https://app.com/invitacion?token=UUID`
3. Si no tiene cuenta → `/registro?invite=TOKEN` → al registrarse acepta automáticamente
4. Si tiene cuenta → inicia sesión → acepta en la página de invitación
5. RPC `accept_workspace_invitation` inserta en `workspace_members`

---

## 10. Convenciones de código

### Componentes

- Todos los componentes son **Client Components** (`'use client'`) salvo excepciones explícitas
- Props con TypeScript estricto — no usar `any` salvo que sea inevitable con datos de Supabase
- Estados de carga: spinner mientras `loading`, mensaje si no hay datos

### Supabase queries

```typescript
// Siempre manejar error
const { data, error } = await supabase.from('tabla').select('*')
if (error) { console.error(error); return }

// Siempre filtrar por workspace
.eq('workspace_id', currentWorkspace.id)

// Para upsert con workspace, incluir workspace_id en el objeto
await supabase.from('configuracion').upsert({
  clave, valor,
  workspace_id: currentWorkspace.id,
  updated_at: new Date().toISOString(),
}, { onConflict: 'clave' })
```

### Tailwind

- Paleta principal: `emerald` (acciones primarias), `slate` (textos/bordes), `red` (destructivos)
- Bordes: `border border-slate-200 rounded-xl`
- Cards: `bg-white rounded-xl border border-slate-200`
- Inputs: `border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400`

### Nuevas migraciones SQL

**Hay Supabase CLI configurado con ambiente de staging.** Toda migración nueva se crea con
`npm run db:new nombre` (queda en `supabase/migrations/`), se prueba primero en el proyecto
`senda-staging` con `npm run db:push:staging`, y solo después se aplica en producción.
Flujo completo, setup y reglas: **`supabase/STAGING.md`**.

Los archivos históricos `supabase/migration_*.sql` ya están aplicados en producción y quedan
solo como referencia — no re-aplicarlos.

---

## 11. División de responsabilidades sugerida

### Instancia Backend
- Nuevas tablas, columnas y migraciones SQL
- RPCs `SECURITY DEFINER` en Supabase
- Políticas RLS
- Lógica de negocio en funciones de base de datos
- Edge Functions si se necesitan
- Verificación de integridad de datos

### Instancia UI
- Nuevos componentes y páginas
- Actualización de contextos React
- Guards de permisos en el frontend
- Diseño con Tailwind
- Formularios y validaciones del lado cliente
- Optimistic updates

> Ambas instancias pueden hacer cualquiera de las dos funciones. Esta división es orientativa para evitar conflictos en PRs simultáneos.

---

## 12. Antes de pushear — checklist

```bash
npx tsc --noEmit   # 0 errores TypeScript
npm run build      # build exitoso
git push origin main  # Vercel hace deploy automático
```

- Nunca hacer `git push --force` a `main`
- Nunca commitear `.env.local`
- Si agregas una tabla nueva: agregar `workspace_id uuid NOT NULL REFERENCES workspaces(id)` y RLS policy
- Si la operación toca `workspace_members`/`workspaces`/`workspace_invitations`: usar RPC SECURITY DEFINER

---

## 13. Contexto del negocio

- **Senda Seguros** es una agencia de seguros en Colombia
- Terminología clave: pólizas, ramos (vida, autos, hogar, SOAT…), aseguradoras, primas, vigencias, siniestros, endosos, solicitudes, cobros, liquidaciones, comisiones
- Los **vendedores/agentes** gestionan sus propios clientes y pólizas
- El **supervisor** supervisa el trabajo del equipo sin poder modificar la configuración global
- El **admin/owner** tiene control total

---

*Última actualización: generado automáticamente — ver historial de git para cambios recientes.*
