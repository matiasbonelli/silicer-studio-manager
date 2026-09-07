// Mirror de MESSAGE_TEMPLATES en src/lib/messageTemplates.ts — las edge functions no pueden
// importar de src/, así que este mapping se mantiene sincronizado a mano. Si se agrega o
// cambia una plantilla en Meta, actualizar ambos archivos.

export interface MetaTemplateDef {
  metaTemplateName: string;
  metaTemplateLang: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  paramOrder: string[];
}

export const META_TEMPLATES: Record<string, MetaTemplateDef> = {
  msg_reminder_pago: {
    metaTemplateName: 'recordatorio_cuota_pendiente',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre', 'mes'],
  },
  msg_pedido_listo: {
    metaTemplateName: 'pedido_listo_retirar',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre', 'producto', 'cantidad', 'total'],
  },
  msg_cumpleanos: {
    metaTemplateName: 'saludo_cumpleanos',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre'],
  },
  msg_confirmacion_turno: {
    metaTemplateName: 'confirmacion_turno',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['dia', 'horario'],
  },
  msg_pago_inscripcion_confirmado: {
    metaTemplateName: 'pago_inscripcion_confirmado',
    metaTemplateLang: 'es_AR',
    category: 'UTILITY',
    paramOrder: ['nombre'],
  },
  msg_preinscripcion_recibida_adultos_1: {
    metaTemplateName: 'preinscripcion_recibida_adultos_1',
    metaTemplateLang: 'es_AR',
    // Meta clasifica este mensaje (info de pago + pedido de transferencia) como Marketing,
    // no Utilidad — lo rechaza si se manda como Utilidad. Ver historial de esta decisión.
    category: 'MARKETING',
    paramOrder: ['nombre'],
  },
  msg_preinscripcion_recibida_adultos_2: {
    metaTemplateName: 'preinscripcion_recibida_adultos_2',
    metaTemplateLang: 'es_AR',
    // Meta también la aprobó como Marketing, no Utilidad (confirmado en WhatsApp Manager).
    category: 'MARKETING',
    paramOrder: [],
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
  },
  msg_preinscripcion_recibida_ninos_2: {
    metaTemplateName: 'preinscripcion_recibida_ninos_2',
    // Mismo caso que ninos_1: aprobada como "en", no es_AR.
    metaTemplateLang: 'en',
    // TODO: confirmar en WhatsApp Manager — se asume Marketing por ser texto idéntico a
    // adultos_2 (que sí se confirmó como Marketing), pero no se verificó puntualmente.
    category: 'MARKETING',
    paramOrder: [],
  },
};
