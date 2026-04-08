# Changelog — Silicer Studio Manager

---

## [Fase 6 & 7] — KPIs, Exportación, Historial y Recordatorios

### Dashboard (`src/components/admin/Dashboard.tsx`)
- KPI card **Ingresos por cuotas** (pagadas + parciales del mes, en violeta)
- KPI card **Pedidos pendientes** (contador de mold_orders en estado pendiente, en naranja)
- Grilla de KPIs extendida a 5 columnas (`lg:grid-cols-5`)
- **Gráfico de barras** de ingresos por cuota de los últimos 12 meses (Recharts)
- **Modal "Recordar a todos"** — genera mensaje predefinido con variables `[nombre]` y `[mes]`, botón WhatsApp por alumno con cuota pendiente

### Alumnos (`src/components/admin/StudentsList.tsx`)
- **Exportar CSV** — descarga con BOM UTF-8 (compatible Excel), incluye nombre, email, teléfono, horario, estado
- **Filtro por horario** — Select dropdown que filtra la lista por turno
- **WhatsApp masivo** — enlace prearmado con mensaje de recordatorio de cuota para alumnos con pago pendiente

---

## [Pedidos de Moldes] — Nuevo tab y tabla

### Tabla `mold_orders` (`supabase/migrations/`)
- Nueva tabla con: `student_id`, `product_name`, `product_price`, `quantity`, `pricing_product_id`, `status` (pending/ready/delivered), `payment_status` (pending/paid), `notes`, timestamps
- RLS habilitado, índices en `student_id` y `status`

### OrdersManager (`src/components/admin/OrdersManager.tsx`) — archivo nuevo
- CRUD completo de pedidos de moldes
- Columnas: Alumno, Producto, Cantidad, Precio unitario, Total, Estado, Pago, Fecha, WhatsApp, Acciones
- Badges de estado: Pendiente (rojo), Listo (amarillo), Entregado (verde)
- Badges de pago: No pagado (outline), Pagado (verde)
- Botón **WhatsApp "Avisar"** — aparece solo cuando el pedido está listo y el alumno tiene teléfono; mensaje incluye producto, cantidad y precio total
- Acciones inline: avanzar estado, marcar pago, editar, eliminar
- Modal con autocompletado de producto desde inventario (`category='moldes'`), total en tiempo real
- Paginación (20 por página), búsqueda, filtro de estado, filtro de pago

### Admin (`src/pages/Admin.tsx`)
- Nuevo tab **Pedidos** con ícono `ClipboardCheck` entre Ventas y Calculadora
- Grilla de tabs extendida a 8 columnas

### Tipos (`src/types/database.ts`)
- `OrderStatus`, `OrderPaymentStatus`, `MoldOrder`, `ORDER_STATUS_LABELS`, `ORDER_PAYMENT_STATUS_LABELS`

---

## [Inscripciones] — Notificación de pendientes

### Admin (`src/pages/Admin.tsx`)
- **Punto amarillo** en el tab Inscripciones cuando hay inscripciones con estado `pending`
- Polling cada 20 segundos + listener `visibilitychange` para mantener el contador actualizado sin Supabase Realtime
- La consulta espera a que el usuario (`user`) esté autenticado antes de ejecutarse (evita bloqueo por RLS)

---

## [Horarios] — Cuotas del mes en tiempo real

### ScheduleGrid (`src/components/admin/ScheduleGrid.tsx`)
- Los badges de cuota ahora muestran el estado **real del mes actual** consultando la tabla `payments`
- Badge verde (`✓`) = pagado, amarillo (`½`) = parcial, rojo (`✗`) = pendiente
- Etiqueta "Cuotas de **Mes Año**" junto a la barra de búsqueda

---

## [Modal Alumno] — Gestión de cuota, notas y WhatsApp

### StudentModal (`src/components/admin/StudentModal.tsx`)
- Sección **Cuota del mes actual** con botones Total / Parcial / Pendiente
- Campo de monto parcial cuando se selecciona "Parcial"
- **Textarea "Nota de pago"** — permite registrar aclaraciones como "paga semana próxima" (se guarda en `payments.notes`)
- La nota se muestra en itálica en modo lectura cuando existe
- **Botón WhatsApp** en el header del modal — abre chat directo con el alumno (solo si tiene teléfono registrado)
- El guardado de cuota propaga `onSave()` para actualizar ScheduleGrid y StudentsList simultáneamente

---

## [Alumnos] — Corrección de orden

### StudentsList (`src/components/admin/StudentsList.tsx`)
- **Orden por apellido y nombre** en lugar de `updated_at DESC`
- Evita que editar un alumno lo mueva al primer lugar de la lista, garantizando el mismo orden en todas las PCs
