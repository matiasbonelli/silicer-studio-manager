# Fase 4 — Changelog y Roadmap

## Contexto

La Fase 4 resuelve el problema de **atomización de pagos**. Hasta la Fase 3, cada alumno tenía un único campo de pago (`payment_status`, `payment_month`, `paid_amount`) que se sobreescribía con cada registro. Esto hacía imposible distinguir entre:

- Un alumno que pagó su preinscripción en Febrero y todavía no pagó Marzo.
- Un alumno que pagó por adelantado cubriendo varios meses.
- El historial real de pagos de un alumno a lo largo del tiempo.

La solución es introducir una tabla `payments` en Supabase que registre un pago por alumno por mes, y migrar toda la lógica de pagos a este nuevo modelo.

---

## Cambios realizados

_(se irán completando a medida que se implementa)_

---

## Pendiente de implementación

### Punto 1 — Migración de base de datos: tabla `payments`

**Dónde:** Supabase (nueva tabla + RLS)

Crear la tabla `payments` con la siguiente estructura:

```sql
CREATE TABLE payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  month       text NOT NULL,          -- formato YYYY-MM
  status      text NOT NULL DEFAULT 'paid'
                CHECK (status IN ('paid', 'partial', 'pending')),
  amount      numeric,               -- monto pagado (null si status = 'pending')
  payment_date timestamptz,
  receipt_url text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Un registro por alumno por mes
CREATE UNIQUE INDEX payments_student_month_idx ON payments(student_id, month);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can do everything" ON payments
  USING (true) WITH CHECK (true);
```

Actualizar también `src/types/database.ts` con el nuevo tipo `Payment`.

---

### Punto 2 — Migración de datos existentes

Antes de cambiar el frontend, migrar los datos actuales de `students` a la nueva tabla `payments`:

- Por cada alumno que tenga `payment_month` y `payment_status != 'pending'`, insertar un registro en `payments` con esos datos.
- Este paso se puede hacer desde el panel de Supabase con un script SQL.

```sql
INSERT INTO payments (student_id, month, status, amount, payment_date)
SELECT
  id,
  payment_month,
  payment_status,
  paid_amount,
  payment_date
FROM students
WHERE payment_month IS NOT NULL
  AND payment_status != 'pending'
ON CONFLICT (student_id, month) DO NOTHING;
```

---

### Punto 3 — Actualizar `StudentsList.tsx`

**Cambio principal:** en lugar de leer `student.payment_status` y `student.payment_month`, consultar la tabla `payments` para el mes seleccionado y cruzar con la lista de alumnos.

- Fetch de `payments` filtrado por `month = selectedMonth` (cuando no es 'all').
- Cruzar con `students` para obtener el estado de cada alumno:
  - Tiene registro en `payments` para ese mes → usar ese status.
  - No tiene registro → mostrar como `pending`.
- El modal de pago debe **crear o actualizar** un registro en `payments` (no tocar `students`).
- Mantener toda la UI actual (badges, sort, paginación, contador resumen).

---

### Punto 4 — Actualizar `Dashboard.tsx`

- El KPI de cuotas debe consultar `payments` del mes actual en lugar de `students.payment_status`.
- La lista de "pendientes" = alumnos sin registro en `payments` para el mes actual.

---

### Punto 5 — Historial de pagos en `StudentModal.tsx`

- Agregar una sección "Historial de pagos" dentro del modal de alumno.
- Listar todos sus registros en `payments` ordenados por mes descendente.
- Mostrar: mes, estado (badge), monto, fecha de pago.

---

### Punto 6 — Limpieza (opcional, post-migración)

Una vez validado que todo funciona con la nueva tabla:
- Evaluar si los campos `payment_status`, `payment_month`, `paid_amount`, `payment_date`, `payment_receipt_url` en `students` pueden ser deprecados o eliminados.
- Esto es opcional y se decide al final de la fase.

---

## Notas de arquitectura

- La tabla `payments` tiene un índice único `(student_id, month)` — un alumno no puede tener dos registros para el mismo mes. El modal de pago usará `upsert`.
- Los campos de pago en `students` se mantienen durante la migración para no romper nada. Se eliminan solo en el Punto 6.
- El campo `receipt_url` se mueve a `payments` — el comprobante es por cuota, no por alumno.

---

## Resumen de commits

| Commit | Descripción |
|--------|-------------|
| _(pendiente)_ | |
