# Plan de acción — Feedback del testeo manual (8-ago)

> Fuente: `FDBK Senda CRM-8 ago.docx` (20 correcciones + 5 observaciones del testeo real).
> Los ítems se referencian como **F1–F20** (correcciones) y **O1–O5** (observaciones).
>
> **Carril A** = Juan (finanzas, colillas, extractor, config, cron, pipeline).
> **Carril B** = Santiago (pólizas, clientes, afiliados, UI de formularios).
> Reglas de siempre: un dueño por archivo · migración probada en staging y aplicada en
> prod ANTES del deploy que la usa · PR con check `verify` · actualizar bitácora al cerrar.

---

## 🚨 ETAPA 0 — Aislamiento de workspaces (SEGURIDAD — bloquea todo lo demás)

**Ítems:** F2 (selector de cliente muestra clientes de otro workspace) · F15 (workspace
nuevo trae pólizas viejas de otra cuenta) · O5 (separar la info entre workspaces).

**Diagnóstico (verificado en código y esquema, no es hipótesis):**
1. **23 políticas RLS permisivas** (`*_auth_all USING (true)`) en las tablas núcleo
   (`clientes`, `polizas`, `cobros`, `actividades`, `liquidaciones`, `facturas`, etc.):
   cualquier usuario autenticado puede leer TODAS las filas de TODOS los workspaces.
2. El aislamiento depende de que cada query del frontend filtre `workspace_id` — y hay
   queries que lo olvidan. Confirmado: `PolizaModal` (selector CLIENTE CRM) consulta
   `from('clientes')` **sin** filtro → exactamente F2. Hay más (p.ej. `ReciboModal`).

**El arreglo es de dos capas (defensa en profundidad):**

| Tarea | Dueño | Detalle |
|---|---|---|
| 0.1 Migración RLS: reemplazar las 23 políticas `USING (true)` por `is_workspace_member(workspace_id)` | **Carril A** | Tabla por tabla, verificando que cada una tenga `workspace_id` poblado ANTES de restringir (si hay filas con `workspace_id NULL`, decidir su workspace primero o quedarían invisibles). Probar en staging con 2 usuarios de workspaces distintos. Aplicar en prod en horario de baja actividad |
| 0.2 Barrido de queries sin filtro: griper todas las `.from('tabla')` sin `.eq('workspace_id')` y producir la lista por archivo | **Carril A** (audita) | Entrega la lista dividida por dueño |
| 0.3 Fix de las queries en archivos de pólizas/clientes/afiliados (incluye `PolizaModal:231`) | **Carril B** | Con la lista de 0.2 |
| 0.4 Fix de las queries en archivos de finanzas/caja/config/cron (incluye `ReciboModal`) | **Carril A** | Con la lista de 0.2 |
| 0.5 Verificación cruzada: con 2 cuentas en 2 workspaces, ninguno ve datos del otro (repetir F2/F15) | **Juan (manual)** | Criterio de cierre de la etapa |

> ⚠️ **Orden importa:** 0.1 (RLS) va primero — aunque una query olvide el filtro, la BD
> ya no entrega datos ajenos. 0.3/0.4 son la corrección de raíz en frontend.
> **Nada de las etapas 1+ se mergea antes de cerrar 0.1.**

---

## 💰 ETAPA 1 — Dinero incorrecto (paralelo entre carriles tras 0.1)

| Ítem | Problema | Dueño | Notas |
|---|---|---|---|
| **F14** | Quálitas: toma el valor SIN retención; debe tomar el **SALDO** (con retención descontada). Hoy se ve más plata de la real | **Carril A** | `lib/colillas/parsers/qualitas.ts` + fixture del caso real + test |
| **F12** | Expertos: si una colilla trae 2 clientes, solo lee 1 | **Carril A** | `lib/colillas/parsers/expertos.ts` — necesita la colilla real de 2 clientes como fixture |
| **F6** | "Finanzas en desorden, no sincroniza, valor incorrecto al cargar planilla" | **Carril A** | Probable duplicado de F14/F12 — validar con Sara QUÉ planilla y QUÉ valor; si hay algo más, abrir ítems específicos |
| **F4** | Los clientes se crean **dos veces** | **Carril B** | Reproducir: ¿doble submit del modal? ¿import + alta? Riesgo de datos: alto |
| **F1** | Extractor PDF: el tomador sale como la **aseguradora** y la prima mal | **Carril A** | La heurística de `tomador` captura la línea equivocada. **Necesito las carátulas PDF usadas en el testeo** para armar fixtures reales y parsers por aseguradora |

---

## 📋 ETAPA 2 — Flujo diario de pólizas y clientes (mayormente Carril B)

| Ítem | Qué se pide | Dueño |
|---|---|---|
| **F3** | Prima **ANUAL vs MENSUAL** clara en el formulario (vida/salud/autos pagan mensual): mostrar neto + neto con IVA también para la mensual. Y **subir "forma de pago" justo debajo de la prima** (reordenar) | **Carril B** |
| **F11** | Al crear póliza desde cero con un cliente que NO existe → **crearlo automáticamente** (no obligar a crear el cliente aparte) | **Carril B** |
| **F7** | **Ciudad** como desplegable (igual que Departamento) para evitar duplicados por tildes | **Carril B** |
| **F8** | Agregar financieras: **FINANCIERA SURA, FINANCIERA BOLÍVAR, FINANCIERA HDI** | **Carril B** (la lista vive junto al campo de financiación) |
| **F10** | La lista de **RAMO** debe salir de la configuración de la agencia y sincronizarse en TODOS los módulos (hoy hay listas distintas por módulo) | **Carril A** (fuente única en Configuración + helper compartido) · **Carril B** (consumirla en PolizaModal/filtros) |
| **F17** | Lista desplegable de **intermediarios** (POSADA SEGUROS, EXPERTOS SEGUROS, MOISÉS AGUILLÓN) en vez de texto libre | **Carril A** (lista en Configuración) · **Carril B** (selector en PolizaModal) |
| **F9** | Colilla sin match porque el cliente/póliza no existe → ofrecer **crear la póliza** o **saltar esa línea** (hoy simplemente no avanza) | **Carril A** (flujo de colillas) |

---

## 🎯 ETAPA 3 — Pipeline (Carril A)

| Ítem | Qué se pide | Notas |
|---|---|---|
| **F19** | Campo **Aseguradora** en el lead (desplegable con las aseguradoras configuradas) para saber con cuál se cotizó | Columna nueva en la tabla de leads → migración |
| **F20** | Etapas nuevas: **Contactado → Cotizado → Pendiente info cliente → Emisión → Emitida** (hoy: Nuevo/Contactado/Cotización/Cerrado) + campo **Observaciones** visible | ⚠️ Migración con cuidado: mapear las etapas existentes a las nuevas (¿"Nuevo"→"Contactado"? ¿"Cerrado"→"Emitida"?) — **confirmar el mapeo con Sara antes** |

---

## 📊 ETAPA 4 — Visibilidad de comisiones (Carril A — es el gran faltante conceptual)

| Ítem | Qué se pide |
|---|---|
| **F13** | Ver qué comisiones están **pendientes de pago por la aseguradora** |
| **F16** | El **Dashboard** debe mostrar comisiones pendientes (hoy no arroja info de comisiones) |
| **O3** | Módulo de **desglose de comisiones**: cuánto es del intermediario emisor (Expertos/Posada/Moisés) · cuánto queda para la agencia tras deducciones y % del intermediario · cuánto es de comisiones mensuales |
| **F18** | Verificar que una póliza de pago MENSUAL vía Expertos **liquide comisiones mensuales** — y hacer visible dónde se ve |

**Enfoque propuesto:** una vista/RPC `comisiones_pendientes` (emitida vs recibida, por
aseguradora e intermediario) que alimente: card en Dashboard (F16), filtro en Cobros (F13)
y una vista "Comisiones" con el desglose (O3). Diseñar sobre los datos reales de colillas
+ facturas. **Antes de construir: sesión corta con Sara para validar las fórmulas del
desglose** (los % de cada intermediario).

---

## 🧪 ETAPA 5 — Verificaciones y mejoras menores

| Ítem | Qué | Dueño / cuándo |
|---|---|---|
| **O2** | Prueba de **liquidaciones** end-to-end (crear vendedor → subir liquidación → ver la comisión liquidada) cuando lleguen las colillas del **15** | Juan (manual) + Carril A de apoyo |
| **O1** | Re-verificar la carga de 12 pólizas tras los fixes de etapa 1 | Juan (manual) |
| **O4** | Asistente: poder buscar clientes por **placa** y datos similares | **Carril A** (agregar placa al contexto del asistente) |
| **O5** | Limpieza final: borrar los datos de prueba sembrados en el workspace real (si los hay) e identificar el workspace QA | Juan (manual, con cuidado) |

---

## Orden de ejecución y dependencias

```
ETAPA 0 (seguridad)  ── bloquea todo; A y B en paralelo tras 0.1
   │
   ├─ ETAPA 1 (dinero)      A: F14, F12, F1, F6 · B: F4
   ├─ ETAPA 2 (flujo diario) B: F3, F11, F7, F8 · A: F9, F10, F17 (listas)
   │
   ├─ ETAPA 3 (pipeline)    A: F19, F20  ← confirmar mapeo de etapas con Sara
   └─ ETAPA 4 (comisiones)  A: F13, F16, O3, F18 ← validar fórmulas con Sara
        │
        └─ ETAPA 5 (verificaciones) — O2 el día 15 · O1/O5 al cierre
```

**Balance de carga:** Carril A ≈ etapa 0 (DB+auditoría) + colillas + extractor + pipeline
+ comisiones · Carril B ≈ etapa 0 (fixes UI) + duplicados + toda la UX de pólizas.

## Insumos que necesitamos de Sara/los testers (bloqueantes puntuales)

1. **Las carátulas PDF** usadas en el testeo (para F1 — fixtures reales del extractor).
2. **La colilla de Expertos con 2 clientes** y **la planilla Quálitas** del testeo (F12/F14).
3. Precisión de **F6**: qué planilla y qué valor salió mal (¿es lo mismo que F14?).
4. **Mapeo de etapas** del pipeline viejas → nuevas (F20).
5. **Fórmulas del desglose de comisiones** por intermediario (O3): % de Expertos/Posada/Moisés.
