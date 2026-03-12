# Análisis y rediseño: Hidrourgencias v2 → ERP Integral

**Documento de arquitectura para transformar la aplicación móvil Hidrourgencias en un sistema ERP operativo para empresas de servicios técnicos.**

---

## 1. ESTADO ACTUAL vs OBJETIVO

### 1.1 Mapeo de entidades

| Entidad propuesta    | Entidad actual         | Estado | Brecha principal |
|----------------------|------------------------|--------|------------------|
| **TicketServicio**   | service_jobs           | ✅ Existe | Campos y estados incompletos |
| **OrdenTrabajo**     | work_orders + assignments | ✅ Existe | Flujo OT→Ticket no automatizado |
| **PagoTecnico**      | service_jobs (technician_payment) | ⚠️ Parcial | Un solo pago por ticket; no multi-técnico |
| **GastosOperativos** | expenses               | ✅ Existe | No vinculados a ticket/servicio |
| **ReportePDF**       | generateJobPdf, generateComprobantePdf | ✅ Existe | Funcional |
| **EstadísticasFinancieras** | admin export Excel | ❌ No existe | No hay tablas ni cálculo automático |
| **FlujoCaja**        | Cálculo en export      | ❌ No existe | No hay tabla ni persistencia |
| **Clientes/Edificios** | client_name en jobs  | ❌ No existe | No hay entidad Cliente; no rentabilidad por cliente |

### 1.2 Stack tecnológico: actual vs sugerido

| Componente | Actual | Sugerido en spec | Recomendación |
|------------|--------|------------------|---------------|
| Backend | Node.js + Express | NestJS / FastAPI | **Mantener Express** – migrar a NestJS opcional en fases posteriores |
| Base de datos | PostgreSQL | PostgreSQL | ✅ Mantener |
| App móvil | React + Capacitor (Android) | Flutter | **Mantener React/Capacitor** – misma codebase que panel web |
| Panel admin | React (SPA) | React/Next.js | ✅ Mantener React |
| Archivos | `server/uploads/` | S3 | Migrar a S3 cuando escale; uploads locales válidos |
| PDF | pdf-lib | PDFKit/Puppeteer | ✅ pdf-lib suficiente |
| Excel | xlsx (SheetJS) | SheetJS | ✅ Ya en uso |
| WhatsApp | Links wa.me manuales | Cloud API/Twilio | Integrar API cuando haya credenciales |

---

## 2. ARQUITECTURA CENTRAL: TICKET COMO EJE

### 2.1 Entidad central: TicketServicio (service_jobs)

El ticket debe ser el eje de todas las operaciones. Relaciones objetivo:

```
ticket_servicio (service_jobs)
    ├── orden_trabajo (opcional, work_order_id)
    ├── pagos_tecnicos (varios por ticket)
    ├── gastos_servicio (expenses con ticket_id)
    ├── reporte_pdf (path o registro)
    ├── historial_eventos (audit/timeline)
    └── estadisticas_financieras (vista materializada o cálculo)
```

### 2.2 Estados del servicio (evolución)

| Actual | Propuesto | Acción |
|--------|-----------|--------|
| pendiente | pendiente | - |
| aprobado | asignado | Renombrar lógica |
| - | aceptado_tecnico | Nuevo (OT confirmada) |
| - | en_camino | Nuevo |
| - | en_servicio | Nuevo |
| - | finalizado | Sustituye “aprobado” como cierre de trabajo |
| pago_registrado | facturado | Separar facturación |
| - | pagado | Cobro cliente confirmado |

**Implementación:** agregar `estado_servicio` (o reusar `ticket_status`) con los valores anteriores. Migración para mapear estados actuales.

### 2.3 Confidencialidad del valor del servicio

- **precio_servicio_empresa** = `amount` en `service_jobs` (cobro al cliente).
- Restricción: solo roles `admin` y `supervisor` pueden ver `amount`, `utilidad`, `ingresos`.
- Técnicos solo ven: `ticket_id`, `descripcion_trabajo`, `estado_servicio`, `estado_pago`, `monto_pago_tecnico`.

**Implementación:**  
- Middleware o capa de serialización que elimine `amount` en respuestas para técnicos.  
- Endpoints separados si hace falta (ej. `/jobs/:id` vs `/jobs/:id/admin`).

---

## 3. MODELO DE DATOS: CAMBIOS NECESARIOS

### 3.1 Migraciones propuestas

#### A. service_jobs (TicketServicio)

```sql
-- Campos a agregar
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS work_order_id INTEGER REFERENCES work_orders(id);
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS direccion_servicio TEXT;  -- unificar address_*
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS latitud NUMERIC(10,6);
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS longitud NUMERIC(10,6);
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP;
ALTER TABLE service_jobs ADD COLUMN IF NOT EXISTS fecha_finalizacion TIMESTAMP;
-- estado_servicio: usar ticket_status o renombrar
```

#### B. Pagos técnicos (multi-técnico)

**Opción 1 – Nueva tabla `pagos_tecnicos`:**

```sql
CREATE TABLE IF NOT EXISTS pagos_tecnicos (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES service_jobs(id),
  tecnico_id INTEGER NOT NULL REFERENCES users(id),
  monto_pago NUMERIC(12,2) NOT NULL DEFAULT 0,
  metodo_pago TEXT DEFAULT 'por_pagar',
  estado_pago TEXT DEFAULT 'pendiente',
  fecha_registro TIMESTAMP DEFAULT NOW(),
  fecha_recepcion TIMESTAMP,
  observaciones TEXT
);
```

- Un ticket puede tener varios pagos (varios técnicos).
- `service_jobs.technician_payment` puede quedar como total o deprecarse.

**Opción 2 – Mantener campo en service_jobs:**  
- Solo si se confirma que siempre hay un técnico principal por ticket.

#### C. Gastos vinculados a ticket/servicio

```sql
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS ticket_id INTEGER REFERENCES service_jobs(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS tecnico_id INTEGER REFERENCES users(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vehiculo_id INTEGER;  -- tabla vehiculos futura
```

#### D. Flujo de caja

```sql
CREATE TABLE IF NOT EXISTS flujo_caja (
  id SERIAL PRIMARY KEY,
  tipo_movimiento TEXT NOT NULL,  -- ingreso | egreso
  categoria TEXT,
  descripcion TEXT,
  monto NUMERIC(12,2) NOT NULL,
  fecha TIMESTAMP DEFAULT NOW(),
  ticket_id INTEGER REFERENCES service_jobs(id),
  usuario_id INTEGER REFERENCES users(id),
  origen TEXT  -- 'servicio' | 'gasto' | 'pago_tecnico' | 'manual'
);
```

#### E. Clientes (opcional para rentabilidad)

```sql
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  rut TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  tipo TEXT DEFAULT 'RESIDENCIAL',
  created_at TIMESTAMP DEFAULT NOW()
);
-- service_jobs: agregar cliente_id REFERENCES clientes(id)
```

#### F. Estadísticas financieras (vista o tabla)

```sql
CREATE TABLE IF NOT EXISTS estadisticas_mensuales (
  id SERIAL PRIMARY KEY,
  periodo TEXT NOT NULL,  -- 'YYYY-MM'
  ingresos_totales NUMERIC(12,2) DEFAULT 0,
  gastos_totales NUMERIC(12,2) DEFAULT 0,
  pagos_tecnicos NUMERIC(12,2) DEFAULT 0,
  utilidad_neta NUMERIC(12,2) DEFAULT 0,
  crecimiento_mensual NUMERIC(5,4),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. AUTOMATIZACIÓN BASADA EN EVENTOS

### 4.1 Eventos objetivo

| Evento | Disparador | Acciones automáticas |
|--------|------------|----------------------|
| onTicketCreated | POST /jobs | Notificación a admin, registro en flujo si hay monto |
| onTechnicianAssigned | Asignar técnico a OT/ticket | Notificación técnico |
| onServiceStarted | ticket_status → en_servicio | Registrar fecha_inicio |
| onServiceCompleted | ticket_status → finalizado | Generar PDF, habilitar pago técnico, actualizar contabilidad |
| onPaymentRegistered | Pago técnico recibido | Actualizar flujo_caja, notificar |

### 4.2 Implementación (Event Driver ligero)

Sin cambiar a NestJS, se puede usar un bus de eventos simple:

```javascript
// server/src/events/eventBus.js
const handlers = {};
export function on(event, handler) { ... }
export function emit(event, payload) { ... }
```

- En rutas de jobs: al crear/actualizar ticket, llamar `emit('onServiceCompleted', job)`.
- Handlers: generar PDF, insertar en flujo_caja, recalcular estadísticas.

---

## 5. MÓDULOS A DESARROLLAR O EXTENDER

### 5.1 Prioridad alta

| Módulo | Descripción | Esfuerzo |
|--------|-------------|----------|
| Tabla flujo_caja | Registrar cada movimiento financiero | Bajo |
| Gastos con ticket_id | Vincular gastos a servicios | Bajo |
| Cálculo utilidad por servicio | precio - pagos - gastos | Bajo |
| Dashboard indicadores | Ingresos/gastos/utilidad del día y mes | Medio |
| Export Excel multi-hoja | Ingresos, Pagos, Gastos, Flujo, Resumen | Medio |
| Ocultar precio a técnicos | Filtrado por rol en API | Bajo |

### 5.2 Prioridad media

| Módulo | Descripción | Esfuerzo |
|--------|-------------|----------|
| Pagos multi-técnico | Tabla pagos_tecnicos | Medio |
| Estados extendidos | en_camino, en_servicio, finalizado | Medio |
| Rentabilidad por cliente | Tabla clientes + reportes | Medio |
| Event bus | Automatización onServiceCompleted, etc. | Medio |

### 5.3 Prioridad baja

| Módulo | Descripción | Esfuerzo |
|--------|-------------|----------|
| Rol supervisor | Nuevo rol con permisos intermedios | Bajo |
| S3 para archivos | Migrar uploads a cloud | Medio |
| Integración WhatsApp API | Envío automático de mensajes | Medio |

---

## 6. DASHBOARD EMPRESARIAL

### 6.1 Indicadores del día

- Servicios realizados hoy  
- Ingresos del día  
- Gastos del día  
- Utilidad del día  

### 6.2 Gráficos sugeridos

- Ingresos vs gastos (mensual)
- Crecimiento mensual
- Servicios por técnico
- Rentabilidad por tipo de servicio

### 6.3 Implementación

- Endpoint `GET /api/admin/dashboard` que agregue datos de `service_jobs`, `expenses`, `flujo_caja`.
- Página React con Recharts (ya presente) para los gráficos.

---

## 7. PLAN DE IMPLEMENTACIÓN POR FASES

### Fase 1 – Base financiera (2–3 semanas)

1. Crear tabla `flujo_caja` y triggers/handlers para poblar en cada alta de ticket, gasto y pago.
2. Agregar `ticket_id` y `tecnico_id` a `expenses`.
3. Endpoint de cálculo de utilidad por ticket:  
   `utilidad = amount - technician_payment - SUM(gastos donde ticket_id = X)`.
4. Filtrar `amount` en respuestas para rol técnico.

### Fase 2 – Dashboard y reportes (2–3 semanas)

1. Endpoint dashboard con totales diarios y mensuales.
2. Página Dashboard con tarjetas y gráficos.
3. Export Excel con hojas: Ingresos, Pagos técnicos, Gastos, Flujo de caja, Resumen.

### Fase 3 – Eventos y automatización (1–2 semanas)

1. Event bus simple.
2. `onServiceCompleted` → generar PDF, insertar en flujo_caja, actualizar estadísticas.
3. Estados extendidos en tickets (en_servicio, finalizado, facturado, pagado).

### Fase 4 – Clientes y productividad (2 semanas)

1. Tabla `clientes` y relación con `service_jobs`.
2. Reporte de rentabilidad por cliente.
3. Indicadores de productividad por técnico (servicios, pagos, tiempo promedio).

### Fase 5 – Refinamientos (continuo)

- Rol supervisor.
- Integración WhatsApp API.
- Migración a S3 si se requiere.
- Evaluar migración a NestJS si el backend crece.

---

## 8. IDENTIDAD CORPORATIVA

- Logo en login, dashboard y encabezados de PDF.
- Favicon e icono de app (Capacitor).
- Rutas de assets: `client/public/logo.png`, etc.

---

## 9. ROLES Y PERMISOS

| Rol | Permisos |
|-----|----------|
| admin | Todo; ve precios, utilidad, reportes, configuración |
| supervisor | Lectura amplia; puede aprobar; no config |
| tecnico | Solo sus tickets, pagos y gastos; sin ver precios de servicio |
| ventas | Cotizaciones, clientes; sin datos financieros sensibles |

---

## 10. RESUMEN EJECUTIVO

- La base actual (React, Node, PostgreSQL) es adecuada para el ERP.
- El ticket (`service_jobs`) debe consolidarse como eje y enlazarse con órdenes, pagos y gastos.
- Cambios críticos: `flujo_caja`, gastos con `ticket_id`, ocultar precios a técnicos, dashboard y Excel multi-hoja.
- Implementación por fases permite evolución sin reescribir todo.

---

**Documento generado para futuras modificaciones.**  
Versión: 1.0 | Fecha: 2026-03-12
