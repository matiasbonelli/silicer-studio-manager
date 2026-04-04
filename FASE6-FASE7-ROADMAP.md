# Fase 6 y Fase 7 — Roadmap

---

## Fase 6 — Reportes y exportación

### Contexto

El Dashboard actual muestra KPIs de ventas pero no de cuotas en pesos. Tampoco hay forma de exportar datos. Esta fase agrega visibilidad financiera sobre las cuotas y la posibilidad de exportar listas operativas.

---

### Punto 1 — KPI de ingresos por cuotas en Dashboard

**Dónde:** `src/components/admin/Dashboard.tsx`

Agregar una card de "Ingresos por cuotas" que muestre:
- Total recaudado en cuotas del mes actual (suma de `payments.amount` donde `status = 'paid'` o `status = 'partial'`)
- Desglose: pagos totales vs. parciales
- Comparación opcional con el mes anterior

**Fetch necesario:** ya se trae `payments` para el mes actual (solo `student_id, status`). Extender el select para incluir `amount`.

---

### Punto 2 — Exportar CSV desde StudentsList

**Dónde:** `src/components/admin/StudentsList.tsx`

Agregar un botón "Exportar" en la barra superior de la lista de alumnos.

Exporta un CSV con:
- Nombre completo
- Teléfono
- Horario
- Estado de cuota del mes seleccionado (pagado / parcial / pendiente)
- Monto pagado (si parcial)
- Fecha de pago

**Implementación:** generación client-side con `Blob` + `URL.createObjectURL` — sin dependencias externas. Respeta el mes y filtros activos al momento de exportar.

---

### Punto 3 — Gráfico histórico de recaudación

**Dónde:** `src/components/admin/Dashboard.tsx` (nueva sección) o tab propio

Gráfico de barras con los últimos 6-12 meses mostrando:
- Monto recaudado en cuotas por mes
- Cantidad de alumnos que pagaron

**Librería sugerida:** `recharts` (ya incluida en el proyecto como dependencia de shadcn).

**Fetch necesario:** `payments` agrupados por mes, últimos 12 meses.

---

### Resumen de archivos a modificar — Fase 6

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/Dashboard.tsx` | Card KPI cuotas en $ + gráfico histórico |
| `src/components/admin/StudentsList.tsx` | Botón exportar CSV |

---

## Fase 7 — Recordatorios WhatsApp

### Contexto

Los alumnos con cuota pendiente se pueden ver en el Dashboard y en StudentsList. Hoy para contactarlos hay que ir alumno por alumno. Esta fase agrega un flujo para enviar recordatorios a todos los pendientes del mes con un solo punto de entrada.

**Aclaración técnica:** no usa API de WhatsApp Business. Abre links `wa.me/54{telefono}?text=...` con el mensaje pre-cargado en WhatsApp Web/Desktop. El envío sigue siendo manual por cada alumno (click por click), pero el texto ya está escrito y listo.

---

### Punto 1 — Botón "Recordar pendientes" en Dashboard

**Dónde:** `src/components/admin/Dashboard.tsx`, card de "Cuotas pendientes"

Agregar botón "Recordar a todos" junto a la lista de alumnos pendientes.

Al hacer click abre un modal con:
- Textarea con el mensaje predeterminado (editable)
- Lista de alumnos pendientes con teléfono
- Botón "Abrir WhatsApp" por cada alumno (genera el link con el mensaje personalizado)
- Botón "Abrir todos" que abre todos los links en secuencia (con aviso de que el browser puede bloquear popups)

---

### Punto 2 — Mensaje predeterminado con variables

El mensaje soporta variables que se reemplazan por alumno:

| Variable | Reemplaza por |
|----------|---------------|
| `[nombre]` | Nombre del alumno |
| `[mes]` | Mes de la cuota (ej: "Abril 2025") |

**Mensaje predeterminado:**
```
Hola [nombre], te recordamos que tenés la cuota de [mes] pendiente en Silicer Studio. ¡Cualquier consulta escribinos!
```

El mensaje es editable en el modal antes de enviar. No se persiste en DB (solo en estado local del modal).

---

### Punto 3 — Acceso rápido desde StudentsList (opcional)

En la lista de alumnos, el botón de WhatsApp existente podría pre-cargar el mensaje de recordatorio en lugar de abrir un chat vacío. Toggle entre "chat libre" y "recordatorio de cuota".

---

### Resumen de archivos a modificar — Fase 7

| Archivo | Cambio |
|---------|--------|
| `src/components/admin/Dashboard.tsx` | Modal de recordatorios + botón "Recordar a todos" |
| `src/components/admin/StudentsList.tsx` | (opcional) Pre-cargar mensaje en botón WhatsApp |

---

## Estado

| Fase | Estado |
|------|--------|
| Fase 6 — Reportes y exportación | ✅ Completo |
| Fase 7 — Recordatorios WhatsApp | ✅ Completo |
