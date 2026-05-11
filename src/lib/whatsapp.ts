type ToastFn = (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;

function cleanPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('54') ? digits : `54${digits}`;
}

export function whatsAppChatUrl(phone: string): string {
  return `https://wa.me/${cleanPhone(phone)}`;
}

export function sendWhatsApp(phone: string, message: string, toast: ToastFn): void {
  // api.whatsapp.com/send avoids the wa.me redirect that mangles multi-byte emoji encoding
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  toast({ title: 'WhatsApp abierto', description: 'El mensaje está prellenado en el chat.' });
}

export function sendWhatsAppBulk(
  students: { phone: string; message: string }[],
  toast: ToastFn,
): void {
  if (students.length === 0) return;

  students.forEach(({ phone, message }) => {
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });

  toast({
    title: `Se abrieron ${students.length} chats`,
    description: 'El mensaje está prellenado en cada chat.',
  });
}
