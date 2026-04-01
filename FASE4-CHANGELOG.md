# Fase 4 — Changelog y Roadmap

## Contexto

La Fase 4 resuelve el problema de **atomización de pagos**. Hasta la Fase 3, cada alumno tenía un único campo de pago (`payment_status`, `payment_month`, `paid_amount`) que se sobreescribía con cada registro. Esto hacía imposible distinguir entre:

- Un alumno que pagó su preinscripción en Febrero y todavía no pagó Marzo.
- Un alumno que pagó por adelantado cubriendo varios meses.
- El historial real de pagos de un alumno a lo largo del tiempo.

La solución es introducir una tabla `payments` en Supabase que registre un pago por alumno por mes, y migrar toda la lógica de pagos a este nuevo modelo.

---

## Cambios realizados

### ✅ Punto 1 — Migración de base de datos: tabla `payments`
- Tabla `payments` creada en Supabase con índice único `(student_id, month)` y RLS habilitado.
- Interfaz `Payment` agregada en `src/types/database.ts` reutilizando el tipo `PaymentStatus` existente.

### ✅ Punto 2 — Migración de datos existentes
- Script SQL ejecutado para migrar registros de pago de `students` a `payments`.

### ✅ Punto 3 — Actualizar `StudentsList.tsx`
- Fetch de `payments` filtrado por `month = selectedMonth` (mapa `Record<string, Payment>` indexado por `student_id`).
- `getComputedStatus` lee del mapa de pagos en lugar de `student.payment_status` / `student.payment_month`.
- `handlePaymentSubmit` hace upsert en `payments` con `onConflict: 'student_id,month'` — no toca `students`.
- Fecha de pago y comprobante provienen del registro en `payments` para el mes seleccionado.
- Se eliminó el estado "adelantado" (no aplica al modelo por-mes).
- Modo "todos los meses" mantiene fallback a campos legacy de `students` para compatibilidad.

---

### ✅ Punto 4 — Actualizar `Dashboard.tsx`

- Fetch paralelo de `payments` para el mes actual (`student_id, status`).
- KPI de cuotas calculado desde el mapa de pagos: paid/partial/pending según registro en `payments`.
- Lista de pendientes = alumnos sin registro en `payments` para el mes actual.
- Se eliminó `getStudentMonthStatus` y el tipo `MonthStatus` (obsoletos).

---

### ✅ Punto 5 — Historial de pagos en `StudentModal.tsx`

- Sección "Historial de pagos" al editar un alumno existente.
- Fetch de todos los registros en `payments` para ese alumno, ordenados por mes descendente.
- Muestra: mes, badge de estado (verde/amarillo/rojo), monto en parciales, fecha de pago.
- Si no hay registros: muestra "Sin registros de pago."

---

### ✅ Punto 6 — Limpieza (aplicada en código)

- Removidos campos de pago del form de `StudentModal`: `payment_status`, `paid_amount`, comprobante de pago.
- El pago se gestiona exclusivamente desde la tabla `payments` (botón $ en `StudentsList`).
- Los inserts de nuevos alumnos incluyen `payment_status: 'pending'` implícitamente para compatibilidad con el schema.
- Los campos legacy en la tabla `students` se mantienen en el DB (no se dropean columnas).

---

## Notas de arquitectura

- La tabla `payments` tiene un índice único `(student_id, month)` — un alumno no puede tener dos registros para el mismo mes. El modal de pago usará `upsert`.
- Los campos de pago en `students` se mantienen durante la migración para no romper nada. Se eliminan solo en el Punto 6.
- El campo `receipt_url` se mueve a `payments` — el comprobante es por cuota, no por alumno.

---

## Resumen de commits

| Commit | Descripción |
|--------|-------------|
| feat: agregar interfaz Payment y tabla payments en Supabase (Fase 4 - Punto 1) | |
| feat: migrar datos de pagos de students a payments (Fase 4 - Punto 2) | |
| feat: leer y escribir pagos desde tabla payments en StudentsList (Fase 4 - Punto 3) | |
| feat: actualizar Dashboard para usar tabla payments en KPI de cuotas (Fase 4 - Punto 4) | |
| feat: historial de pagos en StudentModal y limpieza de campos legacy (Fase 4 - Puntos 5 y 6) | |
