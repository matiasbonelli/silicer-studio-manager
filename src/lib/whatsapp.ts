import { supabase } from '@/integrations/supabase/client';
import type { TemplateKey } from './messageTemplates';

type ToastFn = (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('54') ? digits : `54${digits}`;
}

// WhatsApp's parser breaks on percent-encoded 4-byte emoji (%F0%9F...).
// Encode only ASCII/BMP characters; leave supplementary chars (emoji, U+10000+) as raw
// UTF-8 so the browser encodes them natively when issuing the HTTP request.
function encodeWhatsAppText(text: string): string {
  return Array.from(text)
    .map(char => {
      const cp = char.codePointAt(0)!;
      if (cp > 0xFFFF) return char;
      return encodeURIComponent(char);
    })
    .join('');
}

/** Abre un chat de WhatsApp para que un humano escriba a mano — no envía nada por sí solo. */
export function whatsAppChatUrl(phone: string): string {
  return `https://wa.me/${cleanPhone(phone)}`;
}

/** @deprecated Migrar a `sendTemplateMessage` (API oficial vía Chatwoot) — este método
 * abre una ventana con el mensaje prellenado y arriesga que WhatsApp banee el número por
 * comportamiento de spam. Se mantiene solo hasta terminar de migrar todos los flujos. */
export function sendWhatsApp(phone: string, message: string, toast: ToastFn): void {
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeWhatsAppText(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  toast({ title: 'WhatsApp abierto', description: 'El mensaje está prellenado en el chat.' });
}

/** @deprecated Migrar a `sendTemplateMessageBulk` (API oficial vía Chatwoot) — abrir muchas
 * ventanas en loop es el patrón que más arriesga un baneo del número. */
export function sendWhatsAppBulk(
  students: { phone: string; message: string }[],
  toast: ToastFn,
): void {
  if (students.length === 0) return;

  students.forEach(({ phone, message }) => {
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeWhatsAppText(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  toast({
    title: `Se abrieron ${students.length} chats`,
    description: 'El mensaje está prellenado en cada chat.',
  });
}

interface WhatsappSendResponse {
  success: boolean;
  error?: string;
}

/** Envía un mensaje automático usando una plantilla aprobada en Meta, vía la edge function
 * `whatsapp-send` (que a su vez pasa por Chatwoot para que quede en el historial compartido). */
export async function sendTemplateMessage(
  phone: string,
  templateKey: TemplateKey,
  variables: Record<string, string>,
  toast: ToastFn,
): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke<WhatsappSendResponse>('whatsapp-send', {
    body: { phone: cleanPhone(phone), template_key: templateKey, variables },
  });

  if (error || !data?.success) {
    toast({
      title: 'No se pudo enviar el WhatsApp',
      description: data?.error ?? error?.message ?? 'Intentá de nuevo en unos minutos.',
      variant: 'destructive',
    });
    return false;
  }

  toast({ title: 'Mensaje enviado', description: 'El WhatsApp se envió correctamente.' });
  return true;
}

export interface BulkTemplateTarget {
  phone: string;
  variables: Record<string, string>;
}

/** Envía el mismo template a varios destinatarios, uno por uno vía la edge function
 * (reemplaza el viejo patrón de abrir muchas ventanas de WhatsApp en loop). */
export async function sendTemplateMessageBulk(
  templateKey: TemplateKey,
  targets: BulkTemplateTarget[],
  toast: ToastFn,
): Promise<void> {
  if (targets.length === 0) return;

  let sent = 0;
  let failed = 0;

  for (const { phone, variables } of targets) {
    const { data, error } = await supabase.functions.invoke<WhatsappSendResponse>('whatsapp-send', {
      body: { phone: cleanPhone(phone), template_key: templateKey, variables },
    });
    if (error || !data?.success) {
      failed++;
    } else {
      sent++;
    }
  }

  toast({
    title: failed === 0 ? `${sent} mensajes enviados` : `${sent} enviados, ${failed} fallaron`,
    variant: failed > 0 && sent === 0 ? 'destructive' : 'default',
  });
}
