# Plan de testeo manual — Senda Seguros CRM

> Para ejecutar con usuario real sobre la app desplegada. Cubre las 26 rutas del CRM,
> con prioridad en los **flujos de dinero** y en todo lo construido en el ciclo de
> auditorías (fases 0–5). Duración estimada: 3–4 horas en 2 sesiones.
>
> Preparado por Carril A (8-ago-2026). Marcar cada caso: ✅ pasa · ❌ falla · ⏭️ n/a.

---

## 0. Preparación (OBLIGATORIA antes de tocar nada)

⚠️ **La app apunta a la base de PRODUCCIÓN.** Todo el testeo se hace dentro de un
**workspace de prueba** — el aislamiento por `workspace_id` + RLS es lo que evita
sembrar datos en el CRM real de la agencia. **Nunca** probar en "Sara Lopera Workspace".

| # | Preparativo | Detalle |
|---|---|---|
| P1 | **Workspace de prueba** | Crear (o reutilizar) un workspace "QA Testeo" con una cuenta admin propia |
| P2 | **Segunda cuenta con rol `agente`** | Invitarla desde Configuración → Workspace & Miembros. Necesaria para la suite de permisos (S15) |
| P3 | **1–2 carátulas PDF reales** | De aseguradoras distintas (ideal: Sura + otra). Necesarias para S6. **Es la verificación #1 pendiente del proyecto** |
| P4 | **Excel de importación de prueba** | Pequeño (5–10 filas), con 1 fila corrupta a propósito (p.ej. fecha inválida) para S5 |
| P5 | **Una colilla real** (PDF/XLSX) | De cualquier aseguradora soportada (Sura, Bolívar, AXA, Quálitas, SBS, 48h, Expertos, Viva) para S9 |
| P6 | **Dos navegadores / perfil incógnito** | Para tener admin y agente logueados a la vez |
| P7 | **Celular con WhatsApp** | Para verificar los deep links `wa.me` (S8, S13) |

**Datos semilla mínimos** (crearlos en el workspace de prueba durante S2–S3):
2 clientes (uno con teléfono celular colombiano de 10 dígitos), 3 pólizas
(1 activa con vencimiento < 30 días · 1 con forma de pago Financiación · 1 colectiva),
y lo demás se va creando en cada suite.

**Cómo reportar un hallazgo:** módulo + pasos exactos + qué esperabas + qué pasó +
pantallazo. Severidad: 🔴 dinero/datos mal · 🟠 función rota · 🟡 estético/UX.

---

## Sesión 1 — Núcleo y dinero (suites S1–S9)

### S1 · Autenticación y navegación (10 min)

- [ ] S1.1 Login con la cuenta admin de prueba → entra al Dashboard
- [ ] S1.2 Logout y login de nuevo → la sesión persiste al recargar (F5)
- [ ] S1.3 URL directa a `/cobros` sin sesión → redirige a `/login`
- [ ] S1.4 El sidebar muestra TODOS los grupos para admin (Principal, Pólizas, Finanzas, Gestión, CRM, Operación, Informes)
- [ ] S1.5 Cambiar de workspace con el selector (si hay más de uno) → los datos cambian; volver al de prueba

### S2 · Clientes y Pipeline (20 min)

- [ ] S2.1 Crear cliente con todos los campos (nombre, cédula, **teléfono celular de 10 dígitos**, ciudad) → aparece en la lista
- [ ] S2.2 Editar el cliente → los cambios persisten al recargar
- [ ] S2.3 En el detalle: registrar una actividad (llamada/nota) → aparece en el timeline
- [ ] S2.4 Botón **WhatsApp** del cliente → abre `wa.me/57<número>` en el celular con el chat correcto
- [ ] S2.5 Pipeline (`/leads`): crear lead, arrastrarlo entre etapas (Nuevo → Contactado → Cotización → Cerrado) → la posición persiste al recargar
- [ ] S2.6 Buscar el cliente por nombre y por teléfono → lo encuentra
- [ ] S2.7 Export CSV de clientes → descarga y abre bien

### S3 · Pólizas — CRUD y modelo v2 (30 min)

- [ ] S3.1 Crear póliza individual completa: aseguradora, ramo, vigencias, **prima neta** → verificar que **IVA (19%) y total** se derivan bien en el formulario
- [ ] S3.2 En el detalle: chip de **origen** = "manual" y sección **Cronología** registra la creación
- [ ] S3.3 Editar la póliza (cambiar aseguradora) → la Cronología muestra el diff antes/después
- [ ] S3.4 Asignar **técnico** → el nombre se ve en el detalle
- [ ] S3.5 Agregar 2 **coberturas** y 1 **certificado** (con vencimiento < 30 días, para S12) → totales por columna cuadran; editar y eliminar una cobertura
- [ ] S3.6 🔴 **Cancelar la póliza** → exige **motivo**; al guardar: chip "Cancelada" (NO "Activa"), la cabecera NO la cuenta como activa, y en Operaciones de la póliza aparece la operación `cancelacion` con el motivo. Reeditar la póliza cancelada → NO se duplica la operación
- [ ] S3.7 Crear la póliza **financiada**: forma de pago Financiación, `num_cuotas` = 4, periodicidad de cuota (campo propio), fecha inicio → guardar
- [ ] S3.8 Botón **"Generar cuotas"** (solo visible en financiadas guardadas) → genera las 4 operaciones `cobro` con fechas espaciadas según la periodicidad de la **cuota**. Volver a pulsarlo → NO duplica
- [ ] S3.9 Con cambios sin guardar en `num_cuotas` → el botón se deshabilita con aviso

### S4 · Afiliados y prima de colectivas (15 min) — 🔴 fix reciente #64

- [ ] S4.1 Crear póliza **colectiva** con `prima_por_afiliado` definida
- [ ] S4.2 Agregar 3 afiliados → en el detalle: **prima neta = suma**, **IVA = 19% de la neta**, **total = neta + IVA** — los tres coherentes y visibles
- [ ] S4.3 Quitar 1 afiliado → los tres valores se recalculan
- [ ] S4.4 Abrir la póliza en el modal y **guardar sin tocar nada** → el IVA NO cambia (verificación del `porcentaje_iva: 19`)
- [ ] S4.5 🔴 En una póliza **individual** con asegurados: agregar un asegurado → la prima **NO** cambia (regresión del bug de corrupción)

### S5 · Importación Excel (15 min) — verificación pendiente del proyecto

- [ ] S5.1 Importar el Excel de prueba (P4) → las filas buenas entran; la corrupta se **rechaza** y NO crea su cliente huérfano
- [ ] S5.2 El **bloque ámbar de advertencias** aparece en la UI con el detalle de la fila rechazada *(pendiente #2 del proyecto: nunca se pudo ver en navegador)*
- [ ] S5.3 Las pólizas importadas quedan con origen `import_excel` en su chip/cronología
- [ ] S5.4 Reimportar el mismo archivo → actualiza en vez de duplicar (match por número normalizado; probar un número con ceros a la izquierda tipo `000123` vs `123`)

### S6 · Extractor PDF de carátulas (20 min) — 🔴 verificación pendiente #1

- [ ] S6.1 En Pólizas → **"Cargar desde PDF"** → subir la carátula real → aparece el **preview del borrador** (número, aseguradora, ramo, tomador, vigencias, prima)
- [ ] S6.2 Verificar la **prima discriminada**: si la carátula trae neta y total, ambas correctas; si trae UNA sola sin etiqueta → aviso de "prima indeterminada, confirmá el tipo" (NUNCA debe asumir que es neta y sumar IVA encima)
- [ ] S6.3 El tomador se busca por documento: si el cliente ya existe → lo enlaza; si no → ofrece alta editable (NO crea en silencio)
- [ ] S6.4 Confirmar → la póliza se crea con origen `extractor_pdf` y los datos del preview
- [ ] S6.5 Si el resultado vino de IA → el aviso "requiere revisión" es visible
- [ ] S6.6 Subir un PDF que NO es carátula (cualquier documento) → error claro, no un borrador basura
- [ ] S6.7 Anotar por aseguradora qué campos NO extrajo bien → **entregar ese feedback a Carril A** para afinar la heurística/parsers

### S7 · Cobros y Cartera (20 min) — 🔴 zona del gran fix

- [ ] S7.1 Crear un cobro `por_cobrar` ligado a una póliza: prima total, compromiso de pago futuro → aparece como **Pendiente** con el monto correcto (NO en ceros)
- [ ] S7.2 Crear otro con compromiso de pago **pasado** → aparece como **Vencido** (rojo, con días de mora)
- [ ] S7.3 Botón **WhatsApp** del cobro pendiente → abre el chat con la plantilla de recordatorio (nombre, valor, fecha correctos)
- [ ] S7.4 `/cartera`: los 2 cobros aparecen en sus **buckets** correctos (por vencer / 1–30) con el desglose por aseguradora; el % vencido cuadra
- [ ] S7.5 Los totales de las tarjetas de Cobros (pendiente/vencido/pagado) cuadran con las filas visibles

### S8 · Caja y pagos (15 min) — 🔴 RPC atómica

- [ ] S8.1 Crear un **recibo** vinculado al cobro pendiente por el **valor total** → el cobro pasa a **Pagado** y desaparece de Cartera
- [ ] S8.2 Crear otro cobro y pagarlo **parcialmente** (recibo por menos del saldo) → el saldo baja pero sigue **Pendiente** (pago parcial funciona)
- [ ] S8.3 En `/caja`: el recibo aparece en su tab por tipo; el **cuadre de caja** por forma de pago suma bien
- [ ] S8.4 Un recibo con `numero_certificado` → aparece en el tab **Certificados**

### S9 · Colillas y conciliación (15 min)

- [ ] S9.1 Importar la colilla real (P5) → parsea las líneas; las que matchean póliza quedan **conciliadas**
- [ ] S9.2 Verificar el match por **número normalizado**: una línea con ceros a la izquierda o formato distinto igual concilia
- [ ] S9.3 Una línea ambigua o sin match → queda reportada, NO actualiza una póliza equivocada

---

## Sesión 2 — Gestión, IA y transversales (suites S10–S16)

### S10 · Operaciones (10 min)

- [ ] S10.1 `/operaciones`: se ven las cuotas generadas (S3.8), la cancelación (S3.6) y filtros por tipo/estado funcionan
- [ ] S10.2 En el detalle de la póliza financiada: el timeline muestra sus movimientos con estado de cartera
- [ ] S10.3 ⚠️ Anotar (no es bug, es la decisión pendiente): las cuotas de `/operaciones` **NO** aparecen en `/cartera` — confirmar con los owners la Opción 2 del brief `docs/DECISION_operaciones_vs_cobros.md`

### S11 · Oportunidades / cross-sell (15 min)

- [ ] S11.1 Con un cliente que tenga solo póliza de Autos activa → `/oportunidades` sugiere **Vida (alta)** y **Hogar (media)** con score
- [ ] S11.2 **"Mensaje IA"** → genera un texto de venta coherente en español (nombre del cliente, ramos correctos, sin precios inventados)
- [ ] S11.3 Volver a entrar y regenerar → responde al instante (**caché 30 días**, no re-llama a la IA)
- [ ] S11.4 Copiar y botón WhatsApp con el mensaje → funcionan
- [ ] S11.5 Agregarle al cliente la póliza sugerida (Vida) → la oportunidad **desaparece** de la lista

### S12 · Renovaciones y alertas (15 min)

- [ ] S12.1 `/renovaciones`: la póliza que vence < 30 días aparece; marcarla "No renueva" → exige **motivo**
- [ ] S12.2 Marcar otra "Renovada" → el estado persiste
- [ ] S12.3 En `/operaciones`: existe la operación `renovacion` creada por el cron para la póliza por vencer (si el cron diario ya corrió; si no, anotar y revisar al día siguiente)
- [ ] S12.4 **Email del cron**: verificar en la bandeja del admin la alerta de renovaciones, y que la sección **"Certificados por vencer"** liste el certificado de S3.5 (esperar a la corrida diaria de las 8am)
- [ ] S12.5 Al día siguiente: NO llegó email duplicado de la misma póliza/certificado en el mismo umbral

### S13 · Asistente y Motor de IA (15 min)

- [ ] S13.1 Preguntar al Asistente algo de los datos del workspace ("¿cuántas pólizas activas hay?") → responde con datos reales, en español
- [ ] S13.2 Configuración → **Motor de IA**: se ve "Senda incluido (Groq)" por defecto
- [ ] S13.3 (Opcional, si hay una API key propia) Cambiar a otro proveedor con llave BYOK → el asistente sigue respondiendo; la llave guardada **nunca** se muestra de vuelta
- [ ] S13.4 Volver a "Senda incluido" → funciona sin llave

### S14 · Informes, Dashboard y KPIs (15 min)

- [ ] S14.1 Dashboard: KPIs de producción con **delta justo** (mes actual vs mismo avance del mes pasado + "Año pasado: $X") y la comisión con comparación
- [ ] S14.2 La póliza cancelada (S3.6) NO infla los contadores de activas
- [ ] S14.3 `/informes`: gráfico de **cancelaciones por motivo** muestra la de S3.6; **renovadas vs no renovadas** refleja S12
- [ ] S14.4 Los números del Dashboard cuadran con lo creado en el workspace de prueba (conteo a mano)

### S15 · Roles y permisos (20 min) — verificación pendiente #3

Con la cuenta **agente** (P2) en el segundo navegador:

- [ ] S15.1 El sidebar del agente NO muestra los módulos restringidos (Configuración de agencia, permisos, etc.)
- [ ] S15.2 Sin `polizas_editar`: en el detalle de póliza NO ve botones de editar/eliminar en coberturas/certificados
- [ ] S15.3 URL directa a `/configuracion` como agente → no puede editar datos de agencia
- [ ] S15.4 Sin `finanzas_cobros_ver`: `/cobros`, `/cartera` y `/operaciones` no aparecen; la sección Operaciones del detalle de póliza se oculta
- [ ] S15.5 Como admin: Configuración → Permisos de roles → desactivar un permiso de supervisor → verificar que aplica de inmediato; reactivarlo
- [ ] S15.6 El agente solo ve **sus** clientes/tareas propios (donde aplique)

### S16 · Resto de módulos y transversales (25 min)

- [ ] S16.1 **Tareas**: crear, asignar, completar → tablero refleja los cambios
- [ ] S16.2 **Agenda**: crear evento ligado a cliente → se ve en el calendario
- [ ] S16.3 **Metas**: definir meta de vendedor → el avance se calcula
- [ ] S16.4 **Siniestros**: registrar uno con amparos → estado y valores persisten
- [ ] S16.5 **Solicitudes / Diligencias / Remisiones / Facturas / Archivos**: alta y listado básico de cada uno (smoke test — que abra, cree y liste sin error)
- [ ] S16.6 **Configuración**: agregar una aseguradora al listado → aparece en los formularios; **Ramos × Aseguradora**: cambiar una celda (Sí → Cond.) → persiste al recargar
- [ ] S16.7 **Responsive**: repetir S2.1, S3.1 y S7.1 en el celular — sin scroll horizontal ni botones inaccesibles
- [ ] S16.8 **Consola del navegador** limpia de errores rojos durante toda la sesión (anotar cualquier 4xx/5xx recurrente)

---

## Cierre

1. Consolidar hallazgos en una lista por severidad (🔴 → 🟠 → 🟡) y pasarla a los carriles:
   dinero/pólizas/afiliados → Carril B · finanzas/cobros/caja/IA/extractor-backend → Carril A.
2. Los resultados de **S6.7** (campos mal extraídos por aseguradora) van a Carril A junto
   con las carátulas usadas → alimentan los parsers determinísticos por aseguradora.
3. **S10.3** y la decisión `operaciones` vs `cobros` → agendar entre los 3 owners.
4. Al terminar: dejar el workspace de prueba identificado como QA (no borrarlo — sirve
   para regresiones futuras) y registrar en la BITÁCORA qué suites pasaron y qué quedó abierto.
