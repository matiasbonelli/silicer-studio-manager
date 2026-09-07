// Mirror de MESSAGE_TEMPLATES en src/lib/messageTemplates.ts — las edge functions no pueden
// importar de src/, así que este mapping se mantiene sincronizado a mano. Si se agrega o
// cambia una plantilla en Meta, actualizar ambos archivos.
//
// `bodyTemplate` es el texto real aprobado en Meta (con {variable} en vez de {{n}}) — se usa
// para armar el campo `content` que le mandamos a Chatwoot junto con `template_params`. Sin
// `content`, Chatwoot no tiene nada que mostrar en su propia pantalla (aunque el mensaje real
// sí le llegue bien a WhatsApp vía template_params) y la conversación queda como "sin
// contenido disponible".

export interface MetaTemplateDef {
  metaTemplateName: string;
  metaTemplateLang: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  paramOrder: string[];
  bodyTemplate: string;
}

export const META_TEMPLATES: Record<string, MetaTemplateDef> = {
  msg_reminder_pago: {
    metaTemplateName: 'recordatorio_cuota_pendiente',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre', 'mes'],
    bodyTemplate:
      'Hola {nombre}, te recordamos que tenés la cuota del mes de {mes} pendiente en Silicer. Si ya transferiste o pagaste en efectivo, recordanos o envíanos el comprobante. ¡Cualquier consulta escribinos!\n\n_Esto es un mensaje automático._',
  },
  msg_pedido_listo: {
    metaTemplateName: 'pedido_listo_retirar',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre', 'producto', 'cantidad', 'total'],
    bodyTemplate:
      'Hola {nombre}, tu pedido está listo para retirar en Silicer Studio! 🎉\n\n📦 Producto: {producto}\n🔢 Cantidad: {cantidad}\n💰 Total: {total}\n\n¡Cualquier consulta escribinos!',
  },
  msg_cumpleanos: {
    metaTemplateName: 'saludo_cumpleanos',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre'],
    bodyTemplate:
      'Muy feliz cumple años {nombre} 🥳, esperemos que disfrutes en tu hermoso día 💫. Te saluda Caro y todo el equipo de Silicer 💖',
  },
  msg_confirmacion_turno: {
    metaTemplateName: 'confirmacion_turno',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['dia', 'horario'],
    bodyTemplate:
      'Hola de nuevo!\n\nTe escribimos para confirmar tu turno:\n\nDia: {dia}\nHorario: {horario}\n\nMuchas gracias, te esperamos!',
  },
  msg_pago_inscripcion_confirmado: {
    metaTemplateName: 'pago_inscripcion_confirmado',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre'],
    bodyTemplate:
      'Hola {nombre}! Te confirmamos que registramos tu pago de inscripción en Silicer 🎉. ¡Te esperamos en tu primera clase!',
  },
  msg_preinscripcion_recibida_adultos_1: {
    metaTemplateName: 'preinscripcion_recibida_adultos_1',
    metaTemplateLang: 'es_AR',
    // Meta clasifica este mensaje (info de pago + pedido de transferencia) como Marketing,
    // no Utilidad — lo rechaza si se manda como Utilidad. Ver historial de esta decisión.
    category: 'MARKETING',
    paramOrder: ['nombre'],
    bodyTemplate:
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
  },
  msg_preinscripcion_recibida_adultos_2: {
    metaTemplateName: 'preinscripcion_recibida_adultos_2',
    metaTemplateLang: 'es_AR',
    // Meta también la aprobó como Marketing, no Utilidad (confirmado en WhatsApp Manager).
    category: 'MARKETING',
    paramOrder: [],
    bodyTemplate:
      '⚠️ Condiciones importantes:\n\n' +
      'La seña no posee devolución.\n\n' +
      'El cupo se guarda únicamente por un mes; pasado el mismo y en caso de no asistir, el lugar queda libre para otra persona.\n\n' +
      'En caso de no asistir más, avisanos con antelación (mínimo 15 días antes de que termine el mes) para poder organizar los materiales y la lista de espera.\n\n' +
      'Las clases son recuperables durante el mes en curso, y únicamente durante la primera semana del mes siguiente, según disponibilidad. Los días feriados no se dictan clases, así que no cuentan como clase recuperable.\n\n' +
      '🙏 Por favor, una vez que hagas la transferencia, enviame el comprobante por acá para confirmar tu turno.\n\n' +
      '📍 Te esperamos en Amadeo Mozart 169, Banda Norte, Río Cuarto.\n\n' +
      '¡Cualquier duda avisame! Tenemos muchas ganas de encontrarnos en el taller 🏺🧉',
  },
  msg_preinscripcion_recibida_ninos_1: {
    metaTemplateName: 'preinscripcion_recibida_ninos_1',
    // Quedó aprobada por error bajo el idioma "English (en)" en vez de es_AR (el texto
    // real sigue siendo en español, es solo la etiqueta de idioma con la que Meta la
    // registró) — confirmado en WhatsApp Manager. Tiene que coincidir exacto o el envío falla.
    metaTemplateLang: 'en',
    // Mismo texto/estilo que adultos_1 → mismo motivo de clasificación como Marketing.
    category: 'MARKETING',
    paramOrder: ['nombre'],
    bodyTemplate:
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
  },
  msg_preinscripcion_recibida_ninos_2: {
    metaTemplateName: 'preinscripcion_recibida_ninos_2',
    // Mismo caso que ninos_1: aprobada como "en", no es_AR.
    metaTemplateLang: 'en',
    category: 'MARKETING',
    paramOrder: [],
    bodyTemplate:
      '⚠️ Condiciones importantes:\n\n' +
      'La seña no posee devolución.\n\n' +
      'El cupo se guarda únicamente por un mes; pasado el mismo y en caso de no asistir, el lugar queda libre para otra persona.\n\n' +
      'En caso de no asistir más, avisanos con antelación (mínimo 15 días antes de que termine el mes) para poder organizar los materiales y la lista de espera.\n\n' +
      'Las clases son recuperables durante el mes en curso, y únicamente durante la primera semana del mes siguiente, según disponibilidad. Los días feriados no se dictan clases, así que no cuentan como clase recuperable.\n\n' +
      '🙏 Por favor, una vez que hagas la transferencia, enviame el comprobante por acá para confirmar tu turno.\n\n' +
      '📍 Te esperamos en Amadeo Mozart 169, Banda Norte, Río Cuarto.\n\n' +
      '¡Cualquier duda avisame! Tenemos muchas ganas de encontrarnos en el taller 🏺🧉',
  },
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (msg, [key, value]) => msg.split(`{${key}}`).join(value),
    template,
  );
}
