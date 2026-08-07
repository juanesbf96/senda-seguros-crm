# Bitácora de Desarrollo — Senda Seguros CRM

> Última actualización: 1 de agosto de 2026  
> Stack: Next.js 16.2.4 · Supabase (PostgreSQL + Auth + Storage) · Tailwind CSS · Vercel

---

## Fase 11 — Fundaciones técnicas (julio 2026)

### Estado de ejecución del plan

| Fase | Tarea | Estado |
|------|-------|--------|
| 0.1 | Tests del parser (Excel + colillas) con fixtures | ✅ Hecho (PR #19 mergeado — `test/colillas-parsers`) + fix de schema drift (PR #18) |
| 0.2 | **Supabase CLI + ambiente de staging** | ✅ Hecho — staging replica prod (42 tablas, 32 RPCs, 75 políticas RLS verificadas) |
| 0.3 | Trazabilidad (`origen_creacion` + cronología) | ✅ Hecho — migración probada en staging; PR `feat/trazabilidad-origen-cronologia` |
| 1.1 | Motivo de cancelación / no-renovación | ✅ Hecho — migración probada en staging; PR `feat/motivos-cancelacion-no-renovacion` |
| — | **Fix schema drift Cobros (bug: módulo en ceros)** | ✅ Hecho — PR `fix/finanzas-schema-drift`. Frontend leía columnas fantasma; reconciliado a columnas reales + estado de pago derivado |
| — | **Reconciliar recibos/caja + RPC atómica de pago** | ✅ Hecho — misma rama. Caja estaba rota en runtime (400); RPC `registrar_pago_cobro` probada en staging |
| 1.2 | Aging de cartera (buckets de mora) | ✅ Hecho — PR #23 mergeado y desplegado. RPC `get_cartera_aging` probada en staging + prod |
| 1.3 | KPIs comparativos en Dashboard | ✅ Hecho — PR #24 mergeado y desplegado. RPC `get_dashboard_comparativos` probada en staging + prod |
| 2.x | Paridad de modelo de datos (referencia externa) | ✅ **Cerrada (2-ago)** — schema (#25), matching (#29), UI (#31), catálogo 2.6 (#33) y sus consumidores (#34), todos mergeados y en prod. Único pendiente: la alerta de vencimiento de **certificados** en el cron (bloqueador documentado; 0 certificados en prod, urgencia nula) |
| 3.x | Operaciones de Producción | 🟡 Backbone en prod (#28). **Desbloqueado**: fase 2 cerró y `PolizaDetalle`/`PolizaModal` están libres. Falta timeline, enganche de financiación, y operaciones de renovación/cancelación. ⚠️ Antes de usar las cuotas en operación diaria hay que decidir el solapamiento `operaciones` vs `cobros` (ver sección de fase 3) |
| 4.3 | Motor de IA multi-proveedor (BYOK) | ✅ Hecho — PR #38 mergeado y en prod. Base de 4.1/4.2. Asistente migrado al motor; tab "Motor de IA" en Configuración |
| 4.1 | Extractor PDF de carátulas | ⬜ Pendiente (usa el motor 4.3 como fallback) |
| 4.2 | Ventas cruzadas con scoring | ✅ Hecho — PR #40 mergeado y en prod. RPC `get_oportunidades_cross_sell` + `analisis_ia` (caché 30d) + vista `/oportunidades` con mensaje IA |
| 5.1 | WhatsApp ligero (recordatorio de pago en Cobros) | ✅ Hecho — PR #27 mergeado y desplegado |
| 5.2 | WhatsApp API (inbox/campañas) | ⬜ Pendiente (por cotizar con owner) |

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

- **Baseline aplicado en `senda-staging`** vía pooler IPv4. `scripts/finish-staging.sh` — finalizador mínimo (pide password una vez, guarda, push, verifica).
- **Verificación de paridad ✅**: staging = 42 tablas public, 32 funciones/RPCs, 75 políticas RLS, 37 tablas con RLS — coincide exacto con el baseline volcado de prod. Tablas críticas (clientes, pólizas, cobros, liquidaciones, workspaces, members) y RPCs de workspace/permisos presentes.

**Falta (menor, no bloquea el plan):**
- Crear `supabase/seed.sql` (seed mínimo anonimizado — no copiar datos reales de clientes). Se hará cuando se necesite data de prueba.
- Mergear los PRs: `infra/supabase-cli-staging`, `docs/plan-ejecucion-auditorias`, `feat/trazabilidad-origen-cronologia`.
- **Rotar el password de prod a uno fuerte** (quedó uno temporal débil visible en pantalla durante el setup) — hacerlo con cuidado de re-linkear el CLI después.
- **Arreglar `.env.local` corrupto**: la línea de `SUPABASE_DB_PASSWORD` (prod) quedó concatenada con un password de staging viejo por un salto de línea faltante, así que el valor de prod guardado es inválido (no afecta la app ni staging, que usan otras credenciales). Corregir al rotar el password de prod.

### Fase 0.3 — Trazabilidad (rama `feat/trazabilidad-origen-cronologia`)

Respuesta directa a la lección del desastre del import: no había forma de saber de dónde vino un registro ni quién/qué lo cambió.

- `polizas.origen_creacion` (manual | import_excel | colilla | extractor_pdf | api) — seteado en los 2 únicos caminos de creación (import server-side → `import_excel`, PolizaModal → `manual`). En updates del import no se relabela el origen existente.
- Tabla `registro_cambios` + `registrar_cambio()` (SECURITY DEFINER) + triggers AFTER INSERT/UPDATE/DELETE en `polizas`, `clientes`, `cobros`, `liquidaciones`. **Auditoría a nivel de BD** — captura todo cambio, incluso los hechos por fuera de la app (a diferencia de `clientes_historial`, que es poblado por la app). RLS: miembros del workspace leen; solo el trigger escribe.
- UI: chip de origen en `PolizaDetalle` + componente reutilizable `components/ui/Cronologia.tsx` (timeline con diff antes/después por campo, usuario y fecha).
- **Probado en staging**: test SQL de insert/update/delete confirmó que el trigger registra los cambios reales (`{antes: "Sura", despues: "Bolivar"}`) y omite los updates que no cambian nada. tsc limpio, build OK, 19 tests pasan.
- Nota: la verificación visual en navegador quedó pendiente porque staging no tiene datos ni usuarios de auth; se verá al llegar la migración a prod.

### Fase 1.1 — Retención: motivos de cancelación y no-renovación (rama `feat/motivos-cancelacion-no-renovacion`)

- Migración: `polizas.motivo_cancelacion` (+ `_otro`, `fecha_cancelacion`) con CHECK; `gestiones_renovacion.motivo_no_renovacion` con CHECK. RPCs `get_cancelaciones_por_motivo` y `get_renovaciones_resumen` (esta toma el último estado por póliza del append-log).
- UI: `PolizaModal` exige motivo al cancelar; `Renovaciones` abre modal de motivo al marcar "No renueva" (en sus 2 vistas); `InformesView` tiene 2 gráficos nuevos (cancelaciones por motivo, renovadas vs no renovadas).
- Probado en staging: constraint rechaza motivos inválidos; la RPC de renovaciones cuenta bien el último estado (no_renueva→renovado = renovada). tsc/build/tests OK.

### Fix — Schema drift en Cobros (rama `fix/finanzas-schema-drift`, commit `240cafe`)

**El bug:** el módulo de Cobros mostraba **todo en ceros**. Causa raíz: schema drift. La tabla `cobros` fue reestructurada en el servidor (colillas/comisiones) pero el frontend nunca se reconcilió — leía columnas fantasma (`concepto`, `valor`, `fecha_vencimiento`, `client_id`, `estado` = pendiente/pagado) que ya no existen. Verificado por 3 fuentes: dump baseline, query en staging, y API REST de prod (`cobros.fecha_vencimiento` → *column does not exist*).

**Esquema real de `cobros`:** montos en `prima_total`/`saldo_pendiente`/`prima_neta`; fechas en `compromiso_pago`/`fecha_pago`; **sin `client_id`** (se une al cliente por `poliza_id → polizas.client_id`); `estado` y `tipo` guardan la **categoría** (`por_cobrar`, `por_pagar`, …), no el estado de pago. El **estado de pago es derivado** (`estadoPagoCobro()`: saldo_pendiente + compromiso_pago + fecha_pago → pendiente/vencido/pagado).

**Arreglado:** tipos (`Cobro`, `Recibo.cobro`), `CobrosList`, `ClienteDetalle` (cobros vía join a póliza), `CobrosModal` (alta mapeada a columnas reales), y las interacciones con cobros de `ReciboModal` (marcar pagado = saldar). tsc limpio, build OK, 19 tests, queries validadas contra el esquema real. El monto mostrado es `prima_total` (decisión del owner).

### Fix — Schema drift en recibos/caja + RPC de pago (misma rama, commit `e02d07a`)

**El bug:** Caja no cargaba (query 400: `recibos.concepto does not exist`). Mismo drift que Cobros. Como los inserts venían fallando, esos campos **nunca se persistieron** — quitarlos de la UI no pierde datos guardados.

**Esquema real de `recibos`:** `cobro_id`, `poliza_id`, `tipo`, `valor_recaudado`, `fecha`, `forma_pago`, `usuario`, `observacion`, `numero_certificado`, `anulado_por`, `fecha_anulacion`. Sin `client_id` (el cliente se resuelve por la póliza). El CHECK de `tipo` solo admite `anticipo/activo/pago_directo/anulado` → el tab **"Certificados"** pasa a ser el subconjunto con `numero_certificado` diligenciado, en vez de un tipo inválido.

**RPC nueva `registrar_pago_cobro(p_cobro_id, p_valor, p_fecha)`** — SECURITY DEFINER, bloquea la fila y aplica el recaudo al cobro de forma atómica descontándolo del saldo. Resuelve pago total y parcial sin tener que elegir entre ambos:
- recaudado ≥ saldo → saldo 0 + `fecha_pago` (pagado)
- recaudado < saldo → saldo baja, sin `fecha_pago` (sigue pendiente)

Valida membresía del workspace y rechaza valores ≤ 0. Reemplaza el update directo que dejaba `saldo_pendiente=0` siempre.

**Probado en staging** (transacción revertida): parcial 1M→700k sin fecha; total →0 con fecha; sobrepago nunca negativo; valor negativo rechazado; usuario de otro workspace bloqueado. tsc limpio, build OK, 19 tests.

> ✅ Aplicada en producción (SQL Editor, 1-ago) junto con las de trazabilidad y motivos, antes del deploy del PR #22.

### Fase 1.2 — Aging de cartera (rama `feat/aging-cartera`, PR #23) ✅ mergeado y desplegado

Nueva vista **Cartera** (`/cartera`, sidebar → Finanzas): agrupa la cartera **por cobrar** pendiente en buckets de mora (por vencer · 1–30 · 31–60 · 61–90 · +90 días · sin fecha).

- **RPC `get_cartera_aging(p_workspace_id)`** (SECURITY DEFINER). Calcula los días vencidos **en vivo** (`current_date - compromiso_pago`), no usa `dias_vencidos` (puede quedar obsoleto). Filtra `tipo='por_cobrar'` con `saldo_pendiente > 0` y `fecha_pago IS NULL`. Devuelve `(bucket, aseguradora)` con # y $ → total por bucket + desglose por aseguradora.
- **UI:** resumen (total pendiente, cartera vencida, % vencido), barras por antigüedad y tabla pivote por aseguradora. Tipos `CarteraBucket` / `CarteraAgingRow`.
- Construida sobre el esquema real de cobros (post reconciliación de finanzas): `saldo_pendiente` + `compromiso_pago`.
- **Probada en Postgres local y en staging** (buckets correctos; excluye pagados, saldo 0, `por_pagar` y otro workspace). RPC aplicada en prod (SQL Editor, 1-ago). tsc/build/19 tests OK.

### Fase 1.3 — KPIs comparativos del Dashboard (rama `feat/dashboard-kpis-comparativos`, PR #24) ✅ mergeado y desplegado

El dashboard ya mostraba un delta mes-a-mes, pero comparaba el mes **parcial** en curso contra el mes anterior **completo** → a mitad de mes el delta siempre "caía". Se corrige y se amplía.

- **RPC `get_dashboard_comparativos(p_ws, p_uid)`**: producción (pólizas, `prima_neta`, comisión) en 3 ventanas alineadas al **mismo avance de mes**: mes actual (día 1→hoy), mes anterior *a la fecha*, y **año anterior** *a la fecha*. Respeta el filtro por vendedor. SECURITY DEFINER con chequeo de membresía.
- **Dashboard:** los deltas de pólizas y prima usan la comparación justa; se agrega delta a la **comisión** emitida en el mes (antes sin comparación); y caption **"Mes pasado: $X · Año pasado: $Y"** bajo cada KPI de producción.
- No toca `get_dashboard_metrics` (hot, 170 líneas) — la comparación va en un RPC **separado y aditivo**. Si la RPC no está, el dashboard degrada solo (no muestra deltas falsos).
- **Probada en Postgres local y en staging** (ventana justa excluye lo que cae fuera del mismo avance; filtro por vendedor aísla la vista de agente). RPC aplicada en prod (SQL Editor, 1-ago). tsc/build/19 tests OK.

### Fase 5.1 — WhatsApp ligero: recordatorio de pago (rama `feat/whatsapp-ligero-cobros`, PR #27) ✅ mergeado y desplegado

Botón de WhatsApp en cada cobro `por_cobrar` no pagado (con teléfono del cliente) → abre `wa.me` con una plantilla de recordatorio.

- **`lib/whatsapp.ts`** (helper compartido): `normalizarTelefono` (antepone indicativo Colombia 57), `whatsappLink` (mensaje url-encoded), `plantillaRecordatorioPago` (tono distinto vencido vs próximo, firma de la agencia). 10 tests.
- **CobrosList**: `telefono` en el join de cliente; botón en la fila. Tipos: `telefono` en los picks de cliente de `Cobro`.
- **Acotada a Cobros (Carril A).** El plan (5.1) también pone botones en `PolizaDetalle`/`ClienteDetalle`, pero esos son archivos de fase 2 (Santiago) → diferidos para no colisionar. El helper queda listo para reutilizar ahí.
- Sin migración. tsc/build OK, 29 tests (19 previos + 10 nuevos).

### Fase 3 — Operaciones de Producción: backbone (rama `feat/operaciones-produccion`, PR #28) ✅ mergeado y desplegado

Modelo unificado estilo Cider: movimientos por póliza (cobro-cuota / renovación / cancelación / modificación / expedición), cada uno con **estado de cartera**. Convive con los Cobros actuales; no se migran datos históricos.

- **Migración:** tabla `operaciones` + RLS (espejo de `cobros`: `finanzas_cobros_ver` / `_registrar` / admin) + índices por `(workspace, poliza)` y `(workspace, estado_cartera, fecha_programada)`.
- **Generador `generar_operaciones_cuotas(p_poliza_id)`** (SECURITY DEFINER): crea las N cuotas `cobro` con fechas por periodicidad (mensual→anual), leyendo la financiación desde la propia póliza (`num_cuotas`, `prima_periodica`/`prima_mensual`, `periodicidad_pago`, `fecha_inicio`). Anti-duplicado + chequeo de permiso.
- **Vista `/operaciones`** (sidebar → Finanzas): lista con filtros por tipo/estado y resumen de cartera pendiente/pagada. Tipos `Operacion` / `TipoOperacion` / `EstadoCartera`.
- **Probada en staging:** 4 cuotas trimestrales con fechas correctas (ene/abr/jul/oct), anti-duplicado y bloqueo de usuario ajeno OK. Migración aplicada en prod (SQL Editor, 1-ago). tsc/build/29 tests OK.
- **DIFERIDO (coordinar con fase 2 de Santiago):** timeline de operaciones dentro de `PolizaDetalle`, enganche del generador con la UI de financiación, y creación de operaciones `renovacion` (cron) y `cancelacion` (fase 1.1). Todo eso toca `PolizaDetalle`/`PolizaModal` (sus archivos).

- **DESBLOQUEADO (2-ago):** fase 2 cerró (PR #34 mergeado), así que `PolizaDetalle`/`PolizaModal` quedaron libres. Lo diferido ya se puede tomar. Desglose de lo que falta:

| # | Pendiente | Archivos | ¿Migración? |
|---|-----------|----------|-------------|
| 1 | Timeline de operaciones en `PolizaDetalle` | `PolizaDetalle` | No |
| 2 | Enganchar `generar_operaciones_cuotas` con la UI de financiación | `PolizaModal` | No |
| 3 | El cron crea la operación `renovacion` 60 días antes | `app/api/cron/renovaciones` | **Probablemente sí** — revisar el dedup (ver nota abajo) |
| 4 | Cancelar una póliza crea la operación `cancelacion` (enlaza con 1.1) | `PolizaModal` | No |

1, 2 y 4 comparten archivos y no llevan migración → caben en un solo PR (PR-10 del plan). El 3 conviene separarlo: toca el cron y arrastra el mismo problema de dedup que la alerta de certificados (`notificaciones_renovacion` tiene clave `(poliza_id, dias_alerta)`; una operación de renovación necesita su propio criterio de "ya creada" para no duplicar en cada corrida diaria).

> **⚠️ DECISIÓN DE PRODUCTO PENDIENTE — solapamiento `operaciones` vs `cobros`.**
> Hoy la cartera vive en **dos** lugares y eso va a divergir si no se decide:
> - El **aging de cartera** (fase 1.2, `get_cartera_aging`) lee de **`cobros`**.
> - Las **cuotas** que genera `generar_operaciones_cuotas` viven en **`operaciones`**.
>
> El plan dice explícitamente "no migrar los históricos de Cobros a operaciones; conviven", y también sugiere que el aging "puede alimentarse de operaciones pendientes". Ambas cosas a la vez no se sostienen: si se generan cuotas como operaciones y el aging sigue leyendo `cobros`, esas cuotas **no aparecen en la cartera** — o peor, si alguien registra lo mismo en los dos lados, la mora se cuenta doble.
>
> **No hay que resolverlo para hacer 1, 2 y 4** (esos solo muestran/crean operaciones por póliza). Sí hay que decidirlo **antes** de que las operaciones tipo `cobro` se usen en la operación diaria. Opciones a plantear al owner:
> 1. `operaciones` es la fuente de verdad de cartera → migrar el aging a leer de ahí (o a una vista que una ambas).
> 2. `cobros` sigue siendo la cartera y `operaciones` queda solo como bitácora de movimientos → entonces el generador de cuotas debería escribir en `cobros`, no en `operaciones`.
>
> Elegir una y dejarla escrita aquí antes de seguir con el punto 3.


### Fase 4.3 — Motor de IA multi-proveedor (rama `feat/motor-ia-multiproveedor`, PR #38) ✅ mergeado y en prod (Carril A)

**Base de fase 4.** El plan ordena 4.3 antes que 4.1/4.2 porque el extractor (fallback) y el cross-sell (mensajes) usan este motor. Antes el asistente tenía **Groq hard-coded**; ahora la IA es configurable por workspace.

- **`lib/ia/motor.ts`:** interfaz única `completar(cfg, opts)` + adaptadores. Groq/OpenAI/DeepSeek hablan formato OpenAI (mismo adaptador, distinto endpoint); Anthropic (`/v1/messages`, header `x-api-key`) y Gemini (`generateContent`, roles `user`/`model`) tienen el suyo. Modelo por defecto por proveedor.
- **`lib/ia/resolverConfig.ts`** (server-only): resuelve la config con service-role. `groq` usa la llave **compartida** del env (Senda incluido, gratis — gancho comercial); otros exigen BYOK.
- **`app/api/asistente/route.ts`:** migrado al motor; el frontend pasa `workspaceId`.
- **UI:** tab "Motor de IA" en Configuración (admin) — proveedor + modelo + llave BYOK opcional.

**🔒 Seguridad de la llave (lo importante):** la llave BYOK **nunca llega al navegador**. Tabla `ia_config` con **RLS default-deny** (sin políticas para `authenticated`) → el cliente no la lee ni escribe directo. La UI usa `get_ia_config` (devuelve proveedor/modelo + `tiene_llave`, **jamás la llave**) y `set_ia_config` (SECURITY DEFINER, admin); el servidor lee la llave con service-role. `set_ia_config` maneja `NULL`=conservar, `''`=borrar. **Nota:** la llave se guarda **en claro at-rest** (acceso server-only); cifrar con pgcrypto es una mejora futura.

- **Probado en staging:** set/get, conservar-con-NULL, borrar-con-'', el cliente `authenticated` no ve la tabla (RLS), no-admin bloqueado. Migración aplicada en prod (SQL Editor, 7-ago). tsc/build/55 tests OK (3 nuevos del motor).
- **Sin colisión:** solo `app/api/asistente`, `components/asistente/AsistenteView`, `components/configuracion/*` (nuestro). No tocó archivos de Santiago.

### Fase 4.2 — Cross-sell con scoring + mensaje IA (rama `feat/cross-sell-oportunidades`, PR #40) ✅ mergeado y en prod (Carril A)

Vista **Oportunidades** (`/oportunidades`, sidebar → CRM): clientes con póliza activa de una familia de ramo a los que les falta el complementario, con score y mensaje de venta redactado por la IA (motor 4.3).

- **RPC `get_oportunidades_cross_sell`:** el `ramo` es texto libre → se categoriza en familias con ILIKE (AUTOS, VIDA, SALUD, HOGAR, CUMPLIMIENTO, RC, EMPRESARIAL, TRANSPORTE, ACCIDENTES). Matriz X→Y en un `VALUES` (Autos→Vida/Hogar, Salud→Vida, Cumplimiento→RC, Empresarial→RC/Cumplimiento). Score = base por prioridad + prima + antigüedad + # pólizas (tope 100). **Excluye lo que el cliente ya tiene** (`NOT (destino = ANY(familias))`) y solo cuenta pólizas `estado='activa'`.
- **Tabla `analisis_ia`** (caché + trazabilidad): RLS de lectura por miembro; escritura solo server-side. Guarda `resultado jsonb` + `modelo` + `created_at`.
- **API `/api/oportunidades/mensaje`:** genera el mensaje con el motor 4.3 y lo **cachea 30 días** por (cliente, familia destino) — re-entrar antes de 30 días **no** re-llama a la IA (criterio de aceptación). Registra `proveedor:modelo`.
- **UI:** filtros (prioridad/ramo/búsqueda), resumen por prioridad, botón "Mensaje IA" por fila con copiar y WhatsApp (reusa `lib/whatsapp`).
- **Probado en staging** con clientes sintéticos: excluye lo ya contratado (cliente con Autos+Vida+Hogar solo recibe Vida→Salud), ignora pólizas vencidas, scoring coherente (mayor prima/antigüedad → mayor score). tsc/build/55 tests OK.
- **Nota operativa (7-ago):** al aplicar en prod, la 1ª corrida del SQL falló por un error de transcripción al chat (se cayó el alias `AS score`); el archivo de migración siempre estuvo correcto. Re-corrido con el SQL exacto del archivo → OK.
- **Sin colisión:** RPC + vista nueva + `analisis_ia`; toca `Sidebar.tsx` y `types/index.ts` con adiciones.

### Fase 2 — Paridad de modelo de datos (Carril B) — 1-ago

**Estado: 5 de 6 ítems cerrados.** PR #25 y #29 mergeados y aplicados en prod; **PR #31 abierto, pendiente de review/merge**.

| Ítem | Estado |
|------|--------|
| 2.1 Técnico asignado | ✅ schema (#25) + UI (#31) |
| 2.2 Tomador vs Asegurados | ✅ UI (#31) — no necesitó schema |
| 2.3 Coberturas | ✅ schema (#25) + UI (#31) |
| 2.4 Certificados | ✅ schema (#25) + UI (#31) · ⬜ **alerta en cron — ver bloqueador abajo** |
| 2.5 Matching por número normalizado | ✅ schema (#25) + uso real (#29) |
| 2.6 Catálogo ramos-aseguradora | ✅ tabla + UI (#33, Carril A) — probada en staging + prod |

#### PR #25 — schema v2 ✅ mergeado · migración aplicada en staging **y producción**

`20260801163626_modelo_polizas_v2.sql`: `polizas.tecnico_id`, tablas `coberturas` y `certificados` (RLS: lectura = miembro del workspace; escritura = `has_permission('polizas_editar')`, porque una cobertura es parte de la póliza), campos financieros finos (`pct_sobrecomision`, `pct_retorno`, `gastos_expedicion`, `iva_caratula`, `tasa_runt`) y `numero_poliza_recortado`.

**Dos desviaciones del plan, deliberadas:**
1. `tecnico_id` referencia `auth.users`, **no** `workspace_members` como decía el plan — es la convención del schema (`clientes.assigned_to`, `polizas.created_by`), y así la póliza no pierde el técnico si cambia la membresía.
2. `numero_poliza_recortado` es **columna GENERADA**, no trigger: no se puede desincronizar ni saltar con un `UPDATE` directo (verificado: Postgres rechaza escribirla a mano).

**El supuesto del plan sobre el matching estaba equivocado.** El plan hablaba de "número sin prefijos de sucursal"; revisando 400 números reales de producción, **cero** traen guiones/slashes/espacios. La falla real son los **ceros a la izquierda** (colilla AXA `000000108969` vs BD `108969`). Regla implementada: mayúsculas → quitar no-alfanuméricos → quitar ceros a la izquierda. Verificado sobre 1.000 pólizas de prod: **0 colisiones**, por eso el índice no es único (dos aseguradoras pueden repetir número).

#### PR #29 — matching normalizado en colillas e import ✅ mergeado (sin migración)

La columna del #25 **no la usaba nadie**: conciliación e import seguían haciendo match exacto. Esta es la segunda mitad de 2.5, sin la cual la columna no servía de nada.

**Impacto medido con las colillas reales contra las 1.000 pólizas de prod:** 18 de 85 líneas (21%) caían en "sin match" solo por formato. Verificado end-to-end después del cambio: **SURA VIDA 1 → 16 conciliadas, QUÁLITAS 0 → 2, AXA 0 → 1**.

- `lib/polizas/numeroPoliza.ts` — helper que replica la función SQL. **⚠️ Si alguien cambia una de las dos implementaciones sin la otra, el matching falla en silencio** (el TS normalizaría distinto a la columna generada y nada coincidiría). Hay un test con la misma tabla de casos que el SQL; además se verificaron 6 casos contra la función real de prod.
- Es **fallback**: el match exacto siempre gana. Un número igual salvo formato se marca `conciliada` (no `probable`, que exigiría confirmación manual y anularía el beneficio).
- **En el import es conservador a propósito:** si un número normalizado apunta a varias pólizas NO se usa el match y la fila se inserta. Actualizar la póliza equivocada es peor que duplicar — este import ya corrompió producción dos veces. La ambigüedad se reporta en los errores del resultado.

#### PR #31 — UI 🔵 **ABIERTO, pendiente de review/merge** (no requiere migración)

`SubTablaPoliza` (tabla editable inline reutilizable: coberturas y certificados son el mismo widget con distintas columnas), secciones de Coberturas y Certificados en `PolizaDetalle`, selector de técnico en `PolizaModal`, y **2.2: se quita el gate `es_colectiva`** para que cualquier póliza pueda tener N asegurados.

> **🐛 BUG DE CORRUPCIÓN EVITADO — leer antes de tocar `components/afiliados/`.**
> `AfiliadosTab` y `AfiliadoModal` recalculan `polizas.prima` como **la suma de los afiliados**. Es correcto en una colectiva (su prima *es* esa suma), pero al des-restringir asegurados a pólizas individuales habría **sobrescrito la prima real con 0** en cuanto alguien agregara un asegurado.
> Se agregó la prop `recalcularPrima` (default `true`, así colectivas y modo-cliente no cambian en absoluto) y `PolizaDetalle` pasa `recalcularPrima={!!poliza.es_colectiva}`.

#### ⚠️ Bloqueador documentado: alerta de vencimiento de certificados en el cron (parte de 2.4)

No se implementó **a propósito**. El log de dedup `notificaciones_renovacion` tiene clave `(poliza_id, dias_alerta)` y **no tiene dónde registrar el certificado**, así que alertar por certificado exige **migrar esa tabla** — no es un cambio de UI, y meterlo a medias en una ruta que manda correos arriesga duplicados. Necesita su propio PR con validación en staging.
**Urgencia hoy: nula** — hay **0 certificados en producción** (`content-range: */0`).

#### ✅ Verificaciones ya hechas (no repetir)

- Migración #25 aplicada y verificada **en producción** contra la API REST: columnas y tablas existen, `numero_poliza_recortado` se autocompletó en las pólizas existentes, **0 colisiones** en 1.000 filas reales.
- Función `normalizar_numero_poliza` en prod: `000000108969` → `108969` ✅. TS vs SQL: 6/6 casos idénticos.
- Columna generada: se autocompleta, se recalcula en `UPDATE` y **rechaza escritura manual** (probado en Postgres local).
- Ningún `insert/update` de pólizas hace spread del objeto completo, así que la columna generada no rompe escrituras existentes (revisado en `PolizaModal`, `importarPolizas`, afiliados, colillas).
- `tsc`, 42 tests y `build` limpios.

#### ⬜ Verificaciones PENDIENTES (no se pudieron hacer: la app pide sesión y esa máquina no tenía credenciales)

Al revisar el **PR #31** en el navegador, comprobar:
1. Agregar/editar/eliminar una **cobertura** y un **certificado**; que los totales por columna cuadren.
2. **Crítico:** agregar un asegurado a una póliza **individual** → su `prima` **NO** debe cambiar.
3. **Crítico:** en una póliza **colectiva**, agregar/inactivar un afiliado → la prima **sí** se sigue recalculando como antes (que no haya regresión).
4. Un usuario **sin** `polizas_editar` no ve los botones de editar/eliminar en coberturas/certificados (y si intenta, RLS lo rechaza).
5. El selector de **técnico** lista los miembros del workspace y el nombre se muestra en `PolizaDetalle`.

#### PR #33 — 2.6 catálogo ramos-aseguradora ✅ mergeado · migración en staging **y prod** (Carril A)

Lo hizo Carril A (nosotros), no Carril B — el owner pasó el Excel `RAMOS POR ASEGURADORA.xlsx` y pidió cerrar el 2.6.

**Desviación del plan (deliberada):** el plan (y la nota de arriba) asumían que 2.6 era de **comisiones** (`pct_comision_default`, leer el JSON `comisiones_tarifas`). Pero el Excel real de la agencia es una **matriz de disponibilidad**: qué ramos maneja cada aseguradora, con notas de condición ("solo privados", "mínimo 3", "solo zonas comunes"). Se modelan **ambas cosas en la misma tabla**: `disponible ('si'|'no'|'condicionado')` + `nota` se pueblan ya; `pct_comision_default` queda **nullable** para el uso futuro del plan (import/`PolizaModal` leerán el % cuando se defina). Una sola tabla, sin rework.

- Migración `20260801235420_ramos_aseguradora.sql`: tabla + `unique(ws,aseg,ramo)` + RLS (lectura = miembro, escritura = **admin**, porque es config) + índice. Probada en staging (admin inserta/lee; no-miembro no ve ni inserta; `unique` y `CHECK` rechazan inválidos).
- `lib/catalogoRamos.ts`: catálogo base del Excel — **17 ramos × 19 aseguradoras = 165 combinaciones** (87 sí, 69 no, 9 condicionado), con notas.
- UI: tab **"Ramos × Aseguradora"** en `ConfiguracionView` (componente auto-contenido `RamosAseguradoraTab`, patrón de `PermisosRolesView`) — matriz con colores por disponibilidad, botón admin **"Cargar catálogo base"** (upsert por workspace) y edición por clic (Sí → Cond. → No).
- **Seed por botón, no por migración** (para atarlo al workspace correcto). ✅ **Verificado en producción por el owner (1-ago):** "Cargar catálogo base" insertó las 165 filas y la matriz se ve bien.
- **Sin colisión con #31:** solo tocó `ConfiguracionView.tsx` (no PolizaModal/PolizaDetalle) y `types/index.ts` (adición `RamoAseguradora`).

> **Flujo de trabajo en paralelo (1-ago).** Carril A (finanzas/cartera: `cobros/`, `caja/`, `Dashboard.tsx`, `informes/`) cerró fase 1. Carril B (Santiago, rama `feat/modelo-polizas-v2`: `polizas/`, `clientes/`, tablas nuevas) arrancó fase 2.x. Regla para no chocar: **un dueño por archivo**; único compartido `types/index.ts` (adiciones, conflicto trivial). Toda migración: crear → probar en staging → aplicar en prod **antes** del deploy que la consume.

> **⚠️ Orden de merge de las ramas de fundaciones.** Cada rama se apiló sobre la anterior, así que cada una contiene los commits de las previas:
> `infra/supabase-cli-staging` → `feat/trazabilidad-origen-cronologia` → `feat/motivos-cancelacion-no-renovacion` → `fix/finanzas-schema-drift` (última, contiene todo).
> Mergear **en ese orden** (o mergear solo la última). Cada migración nueva ya está aplicada en staging; al mergear hay que aplicarlas en **producción** (Dashboard → SQL Editor, o `supabase db push` con link a prod).
>
> ~~**Migraciones pendientes de aplicar en prod (3):** `trazabilidad_origen_cronologia`, `motivos_cancelacion_no_renovacion`, `registrar_pago_cobro`.~~
> **✅ Ya aplicadas en producción** (verificado 01-ago contra la API REST de prod): existen `polizas.origen_creacion`, `registro_cambios`, `polizas.motivo_cancelacion`, `gestiones_renovacion.motivo_no_renovacion` y responden las RPCs `get_cancelaciones_por_motivo`, `get_renovaciones_resumen` y `registrar_pago_cobro`. No re-aplicar.
> _(Ojo al verificar: llamar una RPC sin sus parámetros devuelve 404 por desajuste de firma, no porque falte la función.)_
>
> **Recomendación (23-jul):** mergear y desplegar YA — `fix/finanzas-schema-drift` arregla dos módulos caídos en producción (Cobros en ceros, Caja sin cargar). Con 4 ramas apiladas y otro sistema commiteando en paralelo, cada rama nueva aumenta el riesgo de conflicto. Fase 1.2 (aging) queda desbloqueada pero conviene arrancarla sobre `main` limpio.

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

*Última actualización: 7 de agosto de 2026. Fase 1 y 2 cerradas. Fase 4 avanzando: motor IA 4.3 (#38) y cross-sell 4.2 (#40) en prod; falta 4.1 (extractor PDF). Fase 3 backbone desbloqueado.**motor de IA 4.3 (#38, base de fase 4)** en prod.*
