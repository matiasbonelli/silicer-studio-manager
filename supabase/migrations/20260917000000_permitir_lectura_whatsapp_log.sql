-- whatsapp_message_log tenía RLS activado sin ninguna policy (todo denegado salvo
-- service role). Se necesita lectura desde el admin panel para poder armar un link
-- directo a la conversación de Chatwoot de un alumno (buscando su último
-- chatwoot_conversation_id registrado por teléfono).
CREATE POLICY "Admins can view whatsapp_message_log"
  ON public.whatsapp_message_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
