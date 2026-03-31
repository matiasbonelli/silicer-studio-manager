# Fase 3 — Changelog y Roadmap

## Cambios realizados

### Punto 1 — Validación inline en formularios

**Archivos modificados:** `src/pages/Index.tsx`, `src/pages/Auth.tsx`

- Reemplazados los toasts genéricos de validación Zod por mensajes de error inline (texto rojo debajo de cada campo).
- Los errores se limpian automáticamente al modificar el campo correspondiente.
- Se creó helper `updateField()` en Index.tsx para centralizar la actualización de estado y limpieza de errores.
- Eliminados los atributos `required` de los `<Input>` para evitar la validación nativa del browser.
- Agregado `noValidate` a los `<form>` para que solo Zod maneje la validación.

**Campos con validación inline:**
- **Index.tsx:** `first_name`, `last_name`, `email`, `phone`, `schedule_id`, `message`
- **Auth.tsx:** `email`, `password`

---

### Punto 2 — Skeleton loaders

**Archivos modificados:** `src/components/admin/StudentsList.tsx`, `src/components/admin/InventoryManager.tsx`, `src/components/admin/EnrollmentsManager.tsx`

- Reemplazados los spinners centrados (`Loader2 animate-spin`) por 5 filas skeleton que imitan la estructura de cada tabla.
- Cada tabla tiene skeletons con anchos y layouts que reflejan sus columnas reales (nombre, badges, botones, etc.).
- Los empty states se integran dentro del mismo ternario de carga (loading → skeleton, vacío → mensaje, datos → filas reales).

---

### Punto 7 — Gestor de cuotas + Tab Resumen (Dashboard KPIs)

**Archivos modificados/creados:** `src/components/admin/StudentsList.tsx`, `src/components/admin/Dashboard.tsx` (nuevo), `src/pages/Admin.tsx`

#### Gestor de cuotas (StudentsList)
- El selector de mes ya **no filtra** alumnos — ahora los muestra a todos y **calcula el estado de pago** de cada uno para el mes seleccionado.
- Lógica de estado computado:
  - `payment_month === mes seleccionado` → estado real (pagado / parcial / pendiente)
  - `payment_month` anterior al seleccionado → 🔴 Pendiente + chip "Pagó hasta [mes]"
  - `payment_month` posterior al seleccionado → 🔵 Adelantado + chip "Pagó hasta [mes]"
  - Sin `payment_month` → 🔴 Pendiente
- Contador resumen encima de la tabla: `● X pagados · ● Y parciales · ● Z pendientes · ● W adelantados`
- El sort por columna Estado usa el estado computado (no el campo crudo).

#### Tab Resumen (Dashboard)
- Nuevo tab **"Resumen"** al final de la barra de navegación (`LayoutDashboard` icon).
- Nuevo componente `Dashboard.tsx` con 4 secciones:
  - **💰 Ingresos del mes:** total recaudado, N ventas, cobrado vs pendiente.
  - **👩‍🎨 Cuotas del mes:** X/Y pagaron, barra de progreso, pendientes y parciales.
  - **⏳ Cobros pendientes:** monto de ventas sin cobrar, N transacciones.
  - **📦 Stock bajo:** productos con `quantity ≤ min_stock`.
- Paneles de detalle: lista de alumnos con cuota pendiente (+ WhatsApp), desglose de ventas por método de pago, lista de productos bajo mínimo, cumpleaños de esta semana (+ WhatsApp).
- Skeleton loaders durante la carga, empty states en cada panel, botón "Actualizar".

---

### Punto 6 — Accesibilidad (aria-labels)

**Archivos modificados:** `src/components/admin/StudentsList.tsx`, `src/components/admin/EnrollmentsManager.tsx`, `src/components/admin/SalesModule.tsx`

- Agregado `aria-label` a los **17 botones de solo icono** identificados en los tres archivos.
- **StudentsList (4):** Abrir WhatsApp, Ver comprobante de pago, Registrar pago, Eliminar alumno.
- **EnrollmentsManager (6):** Ver detalle, Editar pre-inscripción, Enviar WhatsApp, Registrar pago, Convertir a alumno, Eliminar pre-inscripción.
- **SalesModule (7):** Ver comprobante ×2, Subir comprobante ×2, Editar estado de pago, Eliminar venta ×2 (una por cada tabla).

---

### Punto 5 — Tablas responsive (mobile)

**Archivos modificados:** `src/components/admin/StudentsList.tsx`, `src/components/admin/InventoryManager.tsx`, `src/components/admin/EnrollmentsManager.tsx`, `src/components/admin/SalesModule.tsx`

- Todos los wrappers de tabla tienen `overflow-x-auto` para habilitar scroll horizontal en pantallas pequeñas.
- Cada `<Table>` tiene un `min-w` acorde a su cantidad de columnas: `min-w-[800px]` (alumnos, 9 col), `min-w-[700px]` (inventario y pre-inscripciones, 7–8 col), `min-w-[750px]` (ventas, 10 col).
- `SalesModule` tenía dos tablas separadas (historial y resumen por producto); ambas fueron actualizadas.
- `EnrollmentsManager` ya tenía `overflow-x-auto`; solo se le agregó el `min-w`.

---

### Punto 4 — Ordenamiento + paginación en tablas

**Archivo modificado:** `src/components/admin/StudentsList.tsx`

- Headers **Nombre** y **Estado** son clickeables; un segundo click invierte el orden. Icono visual indica el campo y dirección activos (`ArrowUp`/`ArrowDown`/`ArrowUpDown`).
- Orden de estado de pago: Pendiente → Parcial → Pagado (ascendente).
- Paginación de 20 registros por página con controles Anterior/Siguiente y conteo "X–Y de Z alumnos".
- Cambiar búsqueda, mes o columna de sort reinicia a la primera página.

---

### Punto 3 — Empty states mejorados

**Archivos modificados:** `src/components/admin/StudentsList.tsx`, `src/components/admin/InventoryManager.tsx`, `src/components/admin/EnrollmentsManager.tsx`

- Reemplazados los textos planos por bloques centrados con icono + mensaje principal + sugerencia de acción.
- Los mensajes son contextuales: distinguen entre "sin datos" y "sin resultados para la búsqueda/filtro activo".
- Iconos usados: `Users` (alumnos), `Package` (inventario), `UserPlus` (pre-inscripciones), todos con `opacity-30` para no saturar.

**Casos cubiertos:**
- **StudentsList:** sin búsqueda activa → "Todavía no hay alumnos registrados"; con búsqueda → "No se encontraron alumnos / Intentá con otro nombre".
- **InventoryManager:** sin filtros → "El inventario está vacío / Agregá productos con el botón…"; con filtro → "No se encontraron productos / Probá con otro nombre o cambiá la categoría".
- **EnrollmentsManager:** sin filtros → "Todavía no hay pre-inscripciones / Cuando alguien complete el formulario…"; con filtro → "No se encontraron pre-inscripciones / Intentá con otro nombre o estado".

---

### Fix adicional — Modal de cumpleaños

**Archivo modificado:** `src/components/admin/BirthdayModal.tsx`

- **Problema:** el modal reaparecía cada vez que se cambiaba de tab o se refrescaba la página.
- **Solución:** se usa `localStorage` con clave por fecha (`birthday-modal-dismissed-YYYY-MM-DD`) para recordar que ya fue descartado.
- Al día siguiente la clave cambia, por lo que el modal vuelve a aparecer normalmente.

---

## Pendiente de implementación

_Todos los puntos de la Fase 3 están implementados._

---

## Resumen de commits

| Commit | Descripción |
|--------|-------------|
| `40151de` | feat: validación inline en formularios de inscripción y login |
| `9c4de0c` | fix: eliminar atributo required del HTML para que Zod maneje la validación |
| `60ee73d` | feat: reemplazar spinners por skeleton loaders en tablas de admin |
| `915da14` | fix: evitar que el modal de cumpleaños reaparezca al cambiar de tab |
| `f7d4252` | fix: deshabilitar validación nativa del browser y persistir dismiss de cumpleaños |
