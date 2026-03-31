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
