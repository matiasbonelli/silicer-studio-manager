-- Registro de envíos de WhatsApp automáticos (vía edge function whatsapp-send),
-- para poder auditar/debuggear si un mensaje realmente salió. Sin UI asociada por
-- ahora, solo lo escribe la edge function con el service role.

CREATE TABLE public.whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  template_key text NOT NULL,
  phone text NOT NULL,
  chatwoot_conversation_id text,
  status text NOT NULL, -- 'sent' | 'failed'
  error text,
  related_entity_type text,
  related_entity_id uuid
);

ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;
