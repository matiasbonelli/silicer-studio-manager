type ToastFn = (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('54') ? digits : `54${digits}`;
}

export function whatsAppChatUrl(phone: string): string {
  return `https://wa.me/${cleanPhone(phone)}`;
}

export async function sendWhatsApp(phone: string, message: string, toast: ToastFn): Promise<void> {
  const url = whatsAppChatUrl(phone);

  try {
    await navigator.clipboard.writeText(message);
    window.open(url, '_blank', 'noopener,noreferrer');
    toast({ title: 'Mensaje copiado', description: 'Pegalo en WhatsApp con Ctrl+V' });
  } catch {
    // Fallback: include message in URL (emojis may break on some devices)
    window.open(`${url}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    toast({ title: 'WhatsApp abierto', description: 'Los emojis pueden no verse correctamente', variant: 'destructive' });
  }
}

export async function sendWhatsAppBulk(
  students: { phone: string; message: string }[],
  toast: ToastFn,
): Promise<void> {
  if (students.length === 0) return;

  // Copy the first student's message to clipboard as reference
  const firstMsg = students[0].message;
  try {
    await navigator.clipboard.writeText(firstMsg);
  } catch {
    // ignore clipboard errors for bulk
  }

  students.forEach(({ phone }) => {
    window.open(whatsAppChatUrl(phone), '_blank', 'noopener,noreferrer');
  });

  toast({
    title: `Se abrieron ${students.length} chats`,
    description: 'El mensaje fue copiado al portapapeles. Pegalo en cada chat con Ctrl+V',
  });
}
