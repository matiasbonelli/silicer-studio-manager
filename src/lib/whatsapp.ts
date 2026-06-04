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

export function whatsAppChatUrl(phone: string): string {
  return `https://wa.me/${cleanPhone(phone)}`;
}

export function sendWhatsApp(phone: string, message: string, toast: ToastFn): void {
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeWhatsAppText(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  toast({ title: 'WhatsApp abierto', description: 'El mensaje está prellenado en el chat.' });
}

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
