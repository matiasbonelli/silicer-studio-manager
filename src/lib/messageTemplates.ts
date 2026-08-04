import { supabase } from '@/integrations/supabase/client';

export interface MessageTemplateDef {
  key: string;
  title: string;
  description: string;
  placeholders: string[];
  defaultMessage: string;
}

export const MESSAGE_TEMPLATES: MessageTemplateDef[] = [
  {
    key: 'msg_reminder_pago',
    title: 'Recordatorio de cuota pendiente',
    description: 'Se envía desde Resumen y Alumnos para avisar que la cuota mensual está pendiente.',
    placeholders: ['nombre', 'mes'],
    defaultMessage:
      'Hola {nombre}, te recordamos que tenés la cuota del mes de {mes} pendiente en Silicer. Si ya transferiste o pagaste en efectivo, recordanos o envíanos el comprobante. ¡Cualquier consulta escribinos!\n\n_Esto es un mensaje automático._',
  },
  {
    key: 'msg_pedido_listo',
    title: 'Pedido listo para retirar',
    description: 'Se envía desde Pedidos cuando un pedido pasa a estado "Listo".',
    placeholders: ['nombre', 'producto', 'cantidad', 'total'],
    defaultMessage:
      'Hola {nombre}, tu pedido está listo para retirar en Silicer Studio! 🎉\n\n📦 Producto: {producto}\n🔢 Cantidad: {cantidad}\n💰 Total: {total}\n\n¡Cualquier consulta escribinos!',
  },
  {
    key: 'msg_cumpleanos',
    title: 'Saludo de cumpleaños',
    description: 'Se muestra en el aviso de cumpleaños del día al abrir el sistema.',
    placeholders: ['nombre'],
    defaultMessage:
      'Muy feliz cumple años {nombre} 🥳, esperemos que disfrutes en tu hermoso día 💫. Te saluda Caro y todo el equipo de Silicer 💖',
  },
  {
    key: 'msg_confirmacion_turno',
    title: 'Confirmación de turno (pre-inscripción)',
    description: 'Se envía desde Inscripciones para confirmar día y horario de una pre-inscripción.',
    placeholders: ['dia', 'horario'],
    defaultMessage:
      'Hola de nuevo!\n\nTe escribimos para confirmar tu turno:\n\nDia: {dia}\nHorario: {horario}\n\nMuchas gracias, te esperamos!',
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
