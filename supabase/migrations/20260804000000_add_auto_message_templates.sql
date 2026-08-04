-- Plantillas de mensajes automáticos de WhatsApp, editables desde
-- Utilidades > Respuestas automáticas. Se guardan en app_settings (mismo
-- mecanismo que cuota_adulto/cuota_nino/recargo_percent) para no crear una
-- tabla nueva solo para esto.

INSERT INTO public.app_settings (key, value)
SELECT 'msg_reminder_pago',
  'Hola {nombre}, te recordamos que tenés la cuota del mes de {mes} pendiente en Silicer. Si ya transferiste o pagaste en efectivo, recordanos o envíanos el comprobante. ¡Cualquier consulta escribinos!' || E'\n\n' || '_Esto es un mensaje automático._'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'msg_reminder_pago');

INSERT INTO public.app_settings (key, value)
SELECT 'msg_pedido_listo',
  'Hola {nombre}, tu pedido está listo para retirar en Silicer Studio! 🎉' || E'\n\n' ||
  '📦 Producto: {producto}' || E'\n' ||
  '🔢 Cantidad: {cantidad}' || E'\n' ||
  '💰 Total: {total}' || E'\n\n' ||
  '¡Cualquier consulta escribinos!'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'msg_pedido_listo');

INSERT INTO public.app_settings (key, value)
SELECT 'msg_cumpleanos',
  'Muy feliz cumple años {nombre} 🥳, esperemos que disfrutes en tu hermoso día 💫. Te saluda Caro y todo el equipo de Silicer 💖'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'msg_cumpleanos');

INSERT INTO public.app_settings (key, value)
SELECT 'msg_confirmacion_turno',
  'Hola de nuevo!' || E'\n\n' ||
  'Te escribimos para confirmar tu turno:' || E'\n\n' ||
  'Dia: {dia}' || E'\n' ||
  'Horario: {horario}' || E'\n\n' ||
  'Muchas gracias, te esperamos!'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'msg_confirmacion_turno');
