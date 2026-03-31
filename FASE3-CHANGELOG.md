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

### Fix adicional — Modal de cumpleaños

**Archivo modificado:** `src/components/admin/BirthdayModal.tsx`

- **Problema:** el modal reaparecía cada vez que se cambiaba de tab o se refrescaba la página.
- **Solución:** se usa `localStorage` con clave por fecha (`birthday-modal-dismissed-YYYY-MM-DD`) para recordar que ya fue descartado.
- Al día siguiente la clave cambia, por lo que el modal vuelve a aparecer normalmente.

---

## Pendiente de implementación

### Punto 3 — Empty states mejorados

**Archivos:** `StudentsList.tsx`, `InventoryManager.tsx`, `EnrollmentsManager.tsx`

Reemplazar textos planos como "No se encontraron alumnos" por bloques con icono + mensaje descriptivo + sugerencia de acción.

### Punto 4 — Ordenamiento + paginación en tablas

**Archivo:** `StudentsList.tsx`

- Headers clickeables para ordenar por Nombre y Estado de pago.
- Paginación de 20 registros con controles Anterior/Siguiente.

### Punto 5 — Tablas responsive (mobile)

**Archivos:** `StudentsList.tsx`, `EnrollmentsManager.tsx`, `InventoryManager.tsx`, `SalesModule.tsx`

Envolver tablas con `overflow-x-auto` y `min-w` para scroll horizontal en mobile.

### Punto 6 — Accesibilidad (aria-labels)

**Archivos:** `StudentsList.tsx`, `EnrollmentsManager.tsx`, `SalesModule.tsx`

Agregar `aria-label` a los 15 botones de solo icono para lectores de pantalla.

### Punto 7 — Dashboard KPIs (solo planificación)

No implementar aún. Discutir con el usuario qué métricas mostrar, ubicación y diseño.

---

## Resumen de commits

| Commit | Descripción |
|--------|-------------|
| `40151de` | feat: validación inline en formularios de inscripción y login |
| `9c4de0c` | fix: eliminar atributo required del HTML para que Zod maneje la validación |
| `60ee73d` | feat: reemplazar spinners por skeleton loaders en tablas de admin |
| `915da14` | fix: evitar que el modal de cumpleaños reaparezca al cambiar de tab |
| `f7d4252` | fix: deshabilitar validación nativa del browser y persistir dismiss de cumpleaños |
