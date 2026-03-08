Hallazgos (priorizados)

Flujo de ventas y stock no atómico: se crea sale, luego sale_items, y después se actualiza estado de pago en pasos separados. Si falla un paso, queda inconsistente. Referencias: SalesModule.tsx:227, SalesModule.tsx:258, SalesModule.tsx:342.
Lógica de cupos vulnerable a race condition: validás cupo en frontend y luego insertás sin validación transaccional en backend. Puede sobre-vender cupos con solicitudes simultáneas. Referencias: Index.tsx:110, Index.tsx:120.
Formulario público sin barreras anti-abuso: la política permite inserts anónimos sin restricciones adicionales, expuesto a spam/flood. Referencias: 20260130141622_...sql:212, 20260130141622_...sql:214.
Trigger de stock permite negativos: descuenta siempre sin validar piso 0. Referencias: 20260303000000_...sql:77.
Seguridad UI de admin incompleta: isAdmin se obtiene pero no se usa para bloquear /admin; hoy se depende solo de RLS. Referencias: Admin.tsx:18, App.tsx:24.
Riesgo de inyección HTML al imprimir: se interpolan strings de BD en document.write sin escape. Referencia: SalesModule.tsx:1384.
Múltiples operaciones críticas sin chequeo de error en pasos intermedios (delete/update encadenados), especialmente en inscripciones/alumnos. Referencias: EnrollmentsManager.tsx:196, EnrollmentsManager.tsx:202, StudentsList.tsx:170, StudentsList.tsx:176.
Inconsistencia de path de comprobantes: en un lugar guardás receipts/<file> y en otro creás signed URL asumiendo path directo. Referencias: StudentModal.tsx:127, EnrollmentsManager.tsx:20.
Bug de asset: se referencia /hero-background.jpg pero existe hero-background.png. Referencias: Index.tsx:206, public/hero-background.png.
Calidad técnica: TypeScript poco estricto + tipos desalineados + lint roto. Referencias: tsconfig.app.json:19, tsconfig.json:14, types.ts:482, command.tsx:24, textarea.tsx:5, tailwind.config.ts:102.
Optimización y buenas prácticas

Mover operaciones críticas a RPC/Edge Functions transaccionales (registrar_venta, confirmar_inscripcion, eliminar_alumno) con rollback.
Agregar validaciones server-side: cupos por horario, no-stock-negativo, y políticas más finas de integridad.
Estandarizar capa de datos: helper único para supabase con manejo uniforme de errores.
Paginación y filtros en SQL (no en memoria) para historial de ventas/alumnos.
Dividir componentes grandes (SalesModule, EnrollmentsManager) en hooks + subcomponentes.
Endurecer seguridad web: window.open(..., '_blank', 'noopener,noreferrer'), escapar HTML al imprimir, headers CSP en deploy.
Si seguís con cookies de sesión en SPA, documentar que no son HttpOnly (riesgo XSS) y considerar BFF/SSR para cookies seguras reales.
Nuevas features recomendadas

Lista de espera automática cuando un horario se llena.
Recordatorios automáticos (WhatsApp/email) por vencimiento de cuota.
Dashboard KPI (ventas, morosidad, ocupación por horario) con rango de fechas.
Auditoría de acciones admin (quién cambió pagos, eliminó ventas, etc.).
Exportación CSV/PDF por módulo (ventas, alumnos, inscripciones).
Notas de verificación

lint hoy falla con 3 errores y 9 warnings.
test no corrió por entorno (spawn EPERM en Vitest/esbuild).
No hice cambios en este pedido; fue revisión y diagnóstico.
Si querés, en el próximo paso te propongo un plan de implementación por fases (seguridad primero, luego consistencia, luego performance).