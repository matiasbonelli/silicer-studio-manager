import { supabase } from '@/integrations/supabase/client';

export type TemplateKey =
  | 'msg_reminder_pago'
  | 'msg_recordatorio_cuota_mora'
  | 'msg_pedido_listo'
  | 'msg_cumpleanos'
  | 'msg_confirmacion_inscripcion_senia'
  | 'msg_confirmacion_inscripcion_pago_total'
  | 'msg_seguimiento_preinscripcion'
  | 'msg_preinscripcion_recibida_adultos_1'
  | 'msg_preinscripcion_recibida_adultos_2'
  | 'msg_preinscripcion_recibida_ninos_1'
  | 'msg_preinscripcion_recibida_ninos_2';

export interface MessageTemplateDef {
  key: TemplateKey;
  title: string;
  description: string;
  placeholders: string[];
  defaultMessage: string;
  /** Nombre exacto de la plantilla aprobada en Meta (WhatsApp Business Platform). */
  metaTemplateName: string;
  /** Código de idioma de la plantilla aprobada en Meta, ej. 'es_AR'. */
  metaTemplateLang: string;
  /** Orden posicional de las variables tal como fueron aprobadas en Meta ({{1}}, {{2}}, ...). */
  paramOrder: string[];
}

export const MESSAGE_TEMPLATES: MessageTemplateDef[] = [
  {
    key: 'msg_reminder_pago',
    title: 'Recordatorio de cuota pendiente',
    description: 'Se envía desde Resumen y Alumnos para avisar que la cuota mensual está pendiente (días 1 al 10, sin recargo).',
    placeholders: ['nombre', 'mes', 'monto'],
    defaultMessage:
      'Hola {nombre}, te recordamos que tenés la cuota del mes de {mes} pendiente en Silicer (valor: ${monto}). Si ya transferiste o pagaste en efectivo, recordanos o envíanos el comprobante. ¡Cualquier consulta escribinos!\n\n_Esto es un mensaje automático._',
    metaTemplateName: 'recordatorio_cuota_pendiente',
    metaTemplateLang: 'es_AR',
    paramOrder: ['nombre', 'mes', 'monto'],
  },
  {
    key: 'msg_recordatorio_cuota_mora',
    title: 'Recordatorio de cuota con recargo (mora)',
    description: 'Igual que el recordatorio de cuota, pero para cuando ya pasó el día 10 — incluye el monto con recargo ya calculado según la fecha de envío.',
    placeholders: ['nombre', 'mes', 'monto', 'porcentaje'],
    defaultMessage:
      'Hola {nombre}, tu cuota de {mes} sigue pendiente. Por la fecha, el valor actual es ${monto} (incluye {porcentaje}% de recargo).\n\n' +
      'Si ya transferiste o pagaste en efectivo anteriormente, recordanos o envíanos el comprobante. ¡Cualquier consulta escribinos!\n\n' +
      'Podés pagarla hoy para no seguir acumulando recargo. Gracias.',
    metaTemplateName: 'recordatorio_cuota_mora',
    metaTemplateLang: 'es_AR',
    paramOrder: ['nombre', 'mes', 'monto', 'porcentaje'],
  },
  {
    key: 'msg_pedido_listo',
    title: 'Pedido listo para retirar',
    description: 'Se envía desde Pedidos cuando un pedido pasa a estado "Listo".',
    placeholders: ['nombre', 'producto', 'cantidad', 'total'],
    defaultMessage:
      'Hola {nombre}, tu pedido está listo para retirar en Silicer!\n\n📦 Producto: {producto}\n🔢 Cantidad: {cantidad}\n💰 Total: {total}\n\n¡Cualquier consulta escribinos!',
    metaTemplateName: 'pedido_listo_retirar',
    metaTemplateLang: 'es_AR',
    paramOrder: ['nombre', 'producto', 'cantidad', 'total'],
  },
  {
    key: 'msg_cumpleanos',
    title: 'Saludo de cumpleaños',
    description: 'Se muestra en el aviso de cumpleaños del día al abrir el sistema.',
    placeholders: ['nombre'],
    defaultMessage:
      'Muy feliz cumple años {nombre} 🥳, esperemos que disfrutes en tu hermoso día 💫. Te saluda Caro y todo el equipo de Silicer 💖',
    metaTemplateName: 'saludo_cumpleanos',
    metaTemplateLang: 'es_AR',
    paramOrder: ['nombre'],
  },
  {
    key: 'msg_confirmacion_inscripcion_senia',
    title: 'Confirmación de inscripción — con seña',
    description: 'Se envía desde Inscripciones cuando se registra una seña (pago parcial): confirma el monto recibido y el turno.',
    placeholders: ['monto', 'dia', 'horario'],
    defaultMessage:
      'Hola de nuevo!\n\nRegistramos tu pago de inscripción por un valor de ${monto} en Silicer 🎉. Podés abonar el saldo restante el día de tu primera clase.\n\n' +
      'Te recordamos tu turno:\nDía: {dia}\nHorario: {horario}\n\n¡Te esperamos en tu primera clase!',
    metaTemplateName: 'confirmacion_inscripcion_senia',
    metaTemplateLang: 'es_AR',
    paramOrder: ['monto', 'dia', 'horario'],
  },
  {
    key: 'msg_confirmacion_inscripcion_pago_total',
    title: 'Confirmación de inscripción — pago total',
    description: 'Se envía desde Inscripciones cuando se registra el pago total (sin seña previa, o al completar una seña anterior): confirma el pago y el turno.',
    placeholders: ['dia', 'horario'],
    defaultMessage:
      'Hola de nuevo!\n\nRegistramos el pago total de tu inscripción en Silicer 🎉\n\n' +
      'Te recordamos tu turno:\nDía: {dia}\nHorario: {horario}\n\n¡Te esperamos en tu primera clase!',
    metaTemplateName: 'confirmacion_inscripcion_pago_total',
    metaTemplateLang: 'es_AR',
    paramOrder: ['dia', 'horario'],
  },
  {
    key: 'msg_seguimiento_preinscripcion',
    title: 'Seguimiento de preinscripción sin pago',
    description: 'Se envía a mano desde Inscripciones cuando ya se contactó al alumno pero sigue sin señar/pagar, para saber si sigue interesado.',
    placeholders: ['nombre'],
    defaultMessage:
      '¡Hola {nombre}! Queríamos saber qué te pareció la información que te mandamos sobre nuestro taller en Silicer. ¿Seguís interesado/a en sumarte? Si tenés alguna duda o consulta, no dudes en escribirnos🏺',
    metaTemplateName: 'seguimiento_preinscripcion',
    metaTemplateLang: 'es_AR',
    paramOrder: ['nombre'],
  },
  {
    key: 'msg_preinscripcion_recibida_adultos_1',
    title: 'Preinscripción recibida — Adultos, 1/2 (landing pública)',
    description: 'Primer mensaje (info de pago) al recibir una preinscripción en un horario de lunes a viernes.',
    placeholders: ['nombre'],
    defaultMessage:
      '¡Hola {nombre}! Nos alegra mucho que te hayas preinscripto para sumarte a SILICER este año. ✨\n\n' +
      'Te paso toda la info detallada para concretar tu reserva y que ya tengas un lugar en el taller:\n\n' +
      '💳 Valor de la cuota mensual: $40.000 (los materiales y las horneadas se abonan aparte).\n\n' +
      '📅 La cuota se abona del 1 al 10 de cada mes. Pasada esa fecha, se agregarán recargos, sin excepción.\n\n' +
      '📍 Para reservar tu lugar: Es necesario realizar una seña del 50% ($20.000) o el pago total del mes.\n\n' +
      'Podés transferir a:\n' +
      '📌 Alias: silicer\n' +
      '📌 CVU: 0000003100056515034890\n' +
      '📌 Nombre: Flavia Carola Del Bel\n' +
      '📌 Mercado Pago',
    metaTemplateName: 'preinscripcion_recibida_adultos_1',
    metaTemplateLang: 'es_AR',
    paramOrder: ['nombre'],
  },
  {
    key: 'msg_preinscripcion_recibida_adultos_2',
    title: 'Preinscripción recibida — Adultos, 2/2 (landing pública)',
    description: 'Segundo mensaje (condiciones y cierre) al recibir una preinscripción en un horario de lunes a viernes.',
    placeholders: [],
    defaultMessage:
      '⚠️ Condiciones importantes:\n\n' +
      'La seña no posee devolución.\n\n' +
      'El cupo se guarda únicamente por un mes; pasado el mismo y en caso de no asistir, el lugar queda libre para otra persona.\n\n' +
      'En caso de no asistir más, avisanos con antelación (mínimo 15 días antes de que termine el mes) para poder organizar los materiales y la lista de espera.\n\n' +
      'Las clases son recuperables durante el mes en curso, y únicamente durante la primera semana del mes siguiente, según disponibilidad. Los días feriados no se dictan clases, así que no cuentan como clase recuperable.\n\n' +
      '🙏 Por favor, una vez que hagas la transferencia, enviame el comprobante por acá para confirmar tu turno.\n\n' +
      '📍 Te esperamos en Amadeo Mozart 169, Banda Norte, Río Cuarto.\n\n' +
      '¡Cualquier duda avisame! Tenemos muchas ganas de encontrarnos en el taller 🏺🧉',
    metaTemplateName: 'preinscripcion_recibida_adultos_2',
    metaTemplateLang: 'es_AR',
    paramOrder: [],
  },
  {
    key: 'msg_preinscripcion_recibida_ninos_1',
    title: 'Preinscripción recibida — Niños, sábados, 1/2 (landing pública)',
    description: 'Primer mensaje (info de pago) al recibir una preinscripción en el horario de sábado (sólo niños).',
    placeholders: ['nombre'],
    defaultMessage:
      '¡Hola {nombre}! Nos alegra mucho que te hayas preinscripto para sumarte a SILICER este año. ✨\n\n' +
      'Te paso toda la info detallada para concretar tu reserva y que ya tengas un lugar en el taller:\n\n' +
      '💳 Valor de la cuota mensual: $65.000 (los materiales y las horneadas se abonan aparte).\n\n' +
      '📅 La cuota se abona del 1 al 10 de cada mes. Pasada esa fecha, se agregarán recargos, sin excepción.\n\n' +
      '📍 Para reservar tu lugar: Es necesario realizar una seña del 50% ($32.500) o el pago total del mes.\n\n' +
      'Podés transferir a:\n' +
      '📌 Alias: silicer\n' +
      '📌 CVU: 0000003100056515034890\n' +
      '📌 Nombre: Flavia Carola Del Bel\n' +
      '📌 Mercado Pago',
    metaTemplateName: 'preinscripcion_recibida_ninos_1',
    metaTemplateLang: 'es_AR',
    paramOrder: ['nombre'],
  },
  {
    key: 'msg_preinscripcion_recibida_ninos_2',
    title: 'Preinscripción recibida — Niños, sábados, 2/2 (landing pública)',
    description: 'Segundo mensaje (condiciones y cierre) al recibir una preinscripción en el horario de sábado (sólo niños).',
    placeholders: [],
    defaultMessage:
      '⚠️ Condiciones importantes:\n\n' +
      'La seña no posee devolución.\n\n' +
      'El cupo se guarda únicamente por un mes; pasado el mismo y en caso de no asistir, el lugar queda libre para otra persona.\n\n' +
      'En caso de no asistir más, avisanos con antelación (mínimo 15 días antes de que termine el mes) para poder organizar los materiales y la lista de espera.\n\n' +
      'Las clases son recuperables durante el mes en curso, y únicamente durante la primera semana del mes siguiente, según disponibilidad. Los días feriados no se dictan clases, así que no cuentan como clase recuperable.\n\n' +
      '🙏 Por favor, una vez que hagas la transferencia, enviame el comprobante por acá para confirmar tu turno.\n\n' +
      '📍 Te esperamos en Amadeo Mozart 169, Banda Norte, Río Cuarto.\n\n' +
      '¡Cualquier duda avisame! Tenemos muchas ganas de encontrarnos en el taller 🏺🧉',
    metaTemplateName: 'preinscripcion_recibida_ninos_2',
    metaTemplateLang: 'es_AR',
    paramOrder: [],
  },
];

const DEFAULTS_BY_KEY: Record<string, string> = Object.fromEntries(
  MESSAGE_TEMPLATES.map((t) => [t.key, t.defaultMessage]),
);

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, value]) => msg.split(`{${key}}`).join(value),
    template,
  );
}

export async function fetchMessageTemplates(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', MESSAGE_TEMPLATES.map((t) => t.key));
  if (error) throw error;

  const stored = new Map((data ?? []).map((row) => [row.key, row.value]));
  return Object.fromEntries(
    MESSAGE_TEMPLATES.map((t) => [t.key, stored.get(t.key) ?? t.defaultMessage]),
  );
}

export async function fetchMessageTemplate(key: string): Promise<string> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? DEFAULTS_BY_KEY[key] ?? '';
}

export async function saveMessageTemplate(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
