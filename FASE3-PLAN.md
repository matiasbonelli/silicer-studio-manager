# Fase 3 — Mejoras UI/UX

## Resumen del proyecto

**Silicer Studio Manager** es una SPA (React 18 + Vite + TypeScript) con Supabase como backend. Usa shadcn/ui (Radix), Tailwind CSS y React Router v6. El branch de trabajo es `claude/code-review-analysis-DioZO`.

### Fases anteriores completadas

- **Fase 1 (Seguridad):** XSS con `escapeHtml()`, `window.open` con `noopener,noreferrer` (excepto print windows), RPC atómico para inscripciones (`submit_enrollment`), trigger para stock negativo, deshabilitación de sign-up, `.env.example`.
- **Fase 2 (Calidad de código):** TypeScript strict mode, ESLint limpio (0 errores), extracción de utilidades duplicadas a `src/lib/format.ts` (`formatCurrency`, `formatDate`), eliminación de `react-query` no usado.

---

## Puntos de la Fase 3 (1 al 6)

### 1. Validación inline en formularios

**Archivos:** `src/pages/Index.tsx`, `src/pages/Auth.tsx`

**Estado actual:**
- Ambos archivos ya tienen schemas Zod definidos (`enrollmentSchema`, `authSchema`) pero los errores se muestran solo via toast genérico.
- Los formularios usan `useState` manual (no React Hook Form).

**Cambios:**
- Agregar estado `formErrors` con `useState<Record<string, string>>({})`.
- En `handleSubmit`, usar `schema.safeParse()` y poblar `formErrors` con `error.flatten().fieldErrors`.
- Debajo de cada `<Input>`, agregar:
  ```tsx
  {formErrors.campo && (
    <p className="text-sm text-destructive mt-1">{formErrors.campo}</p>
  )}
  ```
- Limpiar errores del campo al cambiar su valor (`onChange`).

**Campos de Index.tsx:** `first_name`, `last_name`, `email`, `phone`, `schedule_id`, `message`  
**Campos de Auth.tsx:** `email`, `password`

---

### 2. Skeleton loaders (reemplazo de spinners)

**Archivos:** `src/components/admin/StudentsList.tsx`, `src/components/admin/InventoryManager.tsx`, `src/components/admin/EnrollmentsManager.tsx`

**Componente disponible:** `src/components/ui/skeleton.tsx` — `<Skeleton className="h-4 w-[250px]" />`

**Estado actual:**
- Los tres archivos muestran un `<Loader2 className="animate-spin" />` centrado mientras cargan datos.

**Cambios:**
- Importar `Skeleton` desde `@/components/ui/skeleton`.
- Reemplazar el spinner por un bloque de 5 filas skeleton que imiten la estructura de la tabla:
  ```tsx
  {loading ? (
    <TableBody>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          {/* ... columnas según la tabla */}
        </TableRow>
      ))}
    </TableBody>
  ) : ( /* datos reales */ )}
  ```

---

### 3. Empty states mejorados

**Archivos:** `StudentsList.tsx`, `InventoryManager.tsx`, `EnrollmentsManager.tsx`

**Estado actual:**
- Texto plano tipo `"No se encontraron alumnos"` en un `<TableCell colSpan>`.

**Cambios:**
- Reemplazar por un bloque con icono + mensaje + CTA (cuando aplique):
  ```tsx
  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
    <Users className="h-12 w-12 mb-4 opacity-50" />
    <p className="text-lg font-medium">No se encontraron alumnos</p>
    <p className="text-sm">Ajustá los filtros o agregá un nuevo alumno</p>
  </div>
  ```
- Iconos sugeridos: `Users` (alumnos), `Package` (inventario), `ClipboardList` (inscripciones).

---

### 4. Ordenamiento + paginación en tablas

**Archivo principal:** `src/components/admin/StudentsList.tsx`

**Estado actual:**
- Sin ordenamiento. Sin paginación (todos los registros en una tabla).

**Cambios — Ordenamiento:**
- Agregar estado: `sortField` (string) y `sortDirection` (`'asc' | 'desc'`).
- Headers clickeables con ícono `ChevronUp`/`ChevronDown`:
  ```tsx
  <TableHead className="cursor-pointer select-none" onClick={() => handleSort('last_name')}>
    Nombre {sortField === 'last_name' && (sortDirection === 'asc' ? <ChevronUp /> : <ChevronDown />)}
  </TableHead>
  ```
- Aplicar `.sort()` al array filtrado antes de renderizar.
- Columnas ordenables: Nombre, Estado de pago.

**Cambios — Paginación:**
- Constante `PAGE_SIZE = 20`.
- Estado `currentPage` (number).
- Slice del array: `filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)`.
- Controles de paginación debajo de la tabla:
  ```tsx
  <div className="flex items-center justify-between mt-4">
    <span className="text-sm text-muted-foreground">
      Mostrando {start}-{end} de {total}
    </span>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={prev}>Anterior</Button>
      <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={next}>Siguiente</Button>
    </div>
  </div>
  ```

---

### 5. Tablas responsive (mobile)

**Archivos:** `StudentsList.tsx`, `EnrollmentsManager.tsx`, `InventoryManager.tsx`, `SalesModule.tsx`

**Estado actual:**
- Las tablas NO tienen wrapper con overflow. En mobile se cortan o rompen el layout.

**Cambios:**
- Envolver cada `<Table>` con:
  ```tsx
  <div className="overflow-x-auto">
    <Table> ... </Table>
  </div>
  ```
- Agregar `min-w-[600px]` o similar al `<Table>` si es necesario para evitar que las columnas se compriman demasiado.

---

### 6. Accesibilidad (aria-labels)

**Archivos:** `StudentsList.tsx`, `EnrollmentsManager.tsx`, `SalesModule.tsx`

**Estado actual:**
- Botones con solo iconos (sin texto visible) carecen de `aria-label`. Los lectores de pantalla no pueden identificar su función.

**Cambios — Botones a actualizar:**

| Archivo | Icono | aria-label |
|---------|-------|------------|
| StudentsList | `MessageCircle` (WhatsApp) | `"Contactar por WhatsApp"` |
| StudentsList | `FileText` (comprobante) | `"Ver comprobante de pago"` |
| StudentsList | `DollarSign` (registrar pago) | `"Registrar pago"` |
| StudentsList | `Trash2` (eliminar) | `"Eliminar alumno"` |
| EnrollmentsManager | `MessageCircle` (WhatsApp) | `"Contactar por WhatsApp"` |
| EnrollmentsManager | `Eye` (ver detalle) | `"Ver detalle"` |
| EnrollmentsManager | `Trash2` (eliminar) | `"Eliminar inscripción"` |
| EnrollmentsManager | `UserPlus` (convertir) | `"Convertir a alumno"` |
| SalesModule | `Printer` (imprimir) | `"Imprimir recibo"` |
| SalesModule | `Pencil` (editar) | `"Editar venta"` |
| SalesModule | `FileText` (comprobante) | `"Ver comprobante"` |
| SalesModule | `Trash2` (eliminar) | `"Eliminar ítem"` |
| SalesModule | `Plus`/`Minus` (cantidad) | `"Aumentar cantidad"` / `"Disminuir cantidad"` |

---

## Punto 7 — Dashboard KPIs (solo planificación)

> **No implementar aún.** Después de completar los puntos 1-6, discutir con el usuario qué métricas mostrar, dónde ubicar el dashboard, y cómo diseñar la feature.

Ideas iniciales:
- Alumnos activos vs. capacidad total
- Ingresos del mes (ventas + cuotas)
- Pagos pendientes
- Inscripciones nuevas del mes
- Stock bajo (inventario con alerta)

---

## Flujo de trabajo

1. Implementar cada punto en orden (1 → 6)
2. Hacer commit con mensaje descriptivo por cada punto
3. Al finalizar los 6 puntos: `git push -u origin claude/code-review-analysis-DioZO`
4. Indicar al usuario cómo hacer pull y testear los cambios

---

## Archivos clave de referencia

| Archivo | Rol |
|---------|-----|
| `src/pages/Index.tsx` | Formulario público de inscripción |
| `src/pages/Auth.tsx` | Login admin (sin registro) |
| `src/components/admin/StudentsList.tsx` | Tabla de alumnos |
| `src/components/admin/InventoryManager.tsx` | Gestión de inventario |
| `src/components/admin/EnrollmentsManager.tsx` | Pre-inscripciones |
| `src/components/admin/SalesModule.tsx` | Módulo de ventas |
| `src/components/ui/skeleton.tsx` | Componente Skeleton (ya existe) |
| `src/lib/format.ts` | Utilidades compartidas (formatCurrency, formatDate) |
| `src/lib/utils.ts` | escapeHtml, cn() |
