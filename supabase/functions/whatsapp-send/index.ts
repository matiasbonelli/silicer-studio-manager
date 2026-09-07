import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { META_TEMPLATES } from './templates.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Chatwoot exige E.164 estricto ("+549..." para celulares argentinos) para CREAR un
// contacto nuevo — sin esto, cualquier variante que la gente tipee en un formulario
// (espacios, sin código de país, con o sin el "9" de celular) falla al crear el contacto.
// Solo "funcionaba" antes por casualidad, cuando el número ya existía como contacto de
// una prueba previa y la búsqueda lo encontraba por substring.
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (!digits.startsWith('54')) {
    digits = digits.startsWith('9') ? `54${digits}` : `549${digits}`
  } else if (!digits.startsWith('549')) {
    // Tiene código de país pero le falta el "9" de celular (ej. limpiado con la
    // versión vieja del lado del cliente, que no lo agregaba).
    digits = `549${digits.slice(2)}`
  }
  return `+${digits}`
}

interface ChatwootContact {
  id: number
}

interface ChatwootConversation {
  id: number
}

async function chatwootFetch(baseUrl: string, apiToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: apiToken,
      ...(init.headers ?? {}),
    },
  })
  return res
}

async function findOrCreateContact(
  baseUrl: string,
  apiToken: string,
  accountId: string,
  inboxId: string,
  phone: string,
): Promise<ChatwootContact> {
  const searchRes = await chatwootFetch(
    baseUrl,
    apiToken,
    `/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(phone)}`,
  )
  if (searchRes.ok) {
    const searchData = await searchRes.json()
    const existing = searchData?.payload?.[0]
    if (existing?.id) return { id: existing.id }
  }

  const createRes = await chatwootFetch(baseUrl, apiToken, `/api/v1/accounts/${accountId}/contacts`, {
    method: 'POST',
    body: JSON.stringify({ inbox_id: Number(inboxId), phone_number: phone }),
  })
  if (!createRes.ok) {
    throw new Error(`No se pudo crear el contacto en Chatwoot: ${await createRes.text()}`)
  }
  const createData = await createRes.json()
  const contactId = createData?.payload?.contact?.id ?? createData?.id
  if (!contactId) throw new Error('Chatwoot no devolvió un id de contacto')
  return { id: contactId }
}

async function findOrCreateConversation(
  baseUrl: string,
  apiToken: string,
  accountId: string,
  inboxId: string,
  contactId: number,
): Promise<ChatwootConversation> {
  const listRes = await chatwootFetch(
    baseUrl,
    apiToken,
    `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
  )
  if (listRes.ok) {
    const listData = await listRes.json()
    const existing = (listData?.payload ?? []).find(
      (c: { inbox_id?: number; id: number }) => c.inbox_id === Number(inboxId),
    )
    if (existing?.id) return { id: existing.id }
  }

  const createRes = await chatwootFetch(baseUrl, apiToken, `/api/v1/accounts/${accountId}/conversations`, {
    method: 'POST',
    body: JSON.stringify({ contact_id: contactId, inbox_id: Number(inboxId) }),
  })
  if (!createRes.ok) {
    throw new Error(`No se pudo crear la conversación en Chatwoot: ${await createRes.text()}`)
  }
  const createData = await createRes.json()
  if (!createData?.id) throw new Error('Chatwoot no devolvió un id de conversación')
  return { id: createData.id }
}

async function sendTemplateMessage(
  baseUrl: string,
  apiToken: string,
  accountId: string,
  conversationId: number,
  template: (typeof META_TEMPLATES)[string],
  variables: Record<string, string>,
) {
  const processedParams = Object.fromEntries(
    template.paramOrder.map((varName, idx) => [String(idx + 1), variables[varName] ?? '']),
  )

  const res = await chatwootFetch(
    baseUrl,
    apiToken,
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        message_type: 'outgoing',
        template_params: {
          name: template.metaTemplateName,
          category: template.category,
          language: template.metaTemplateLang,
          processed_params: processedParams,
        },
      }),
    },
  )

  if (!res.ok) {
    throw new Error(`Chatwoot rechazó el envío: ${await res.text()}`)
  }

  return res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let phone = ''
  let template_key = ''
  let variables: Record<string, string> = {}

  try {
    const body = await req.json()
    phone = body.phone ? normalizePhone(body.phone) : body.phone
    template_key = body.template_key
    variables = body.variables ?? {}

    if (!phone || !template_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'phone y template_key son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const template = META_TEMPLATES[template_key]
    if (!template) {
      return new Response(
        JSON.stringify({ success: false, error: `template_key desconocido: ${template_key}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const baseUrl = Deno.env.get('CHATWOOT_BASE_URL')
    const apiToken = Deno.env.get('CHATWOOT_API_ACCESS_TOKEN')
    const accountId = Deno.env.get('CHATWOOT_ACCOUNT_ID')
    const inboxId = Deno.env.get('CHATWOOT_WHATSAPP_INBOX_ID')

    if (!baseUrl || !apiToken || !accountId || !inboxId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan credenciales de Chatwoot configuradas en Supabase' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const contact = await findOrCreateContact(baseUrl, apiToken, accountId, inboxId, phone)
    const conversation = await findOrCreateConversation(baseUrl, apiToken, accountId, inboxId, contact.id)
    const message = await sendTemplateMessage(baseUrl, apiToken, accountId, conversation.id, template, variables)

    await supabase.from('whatsapp_message_log').insert({
      template_key,
      phone,
      chatwoot_conversation_id: String(conversation.id),
      status: 'sent',
    })

    return new Response(
      JSON.stringify({ success: true, chatwoot_conversation_id: conversation.id, message_id: message?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('whatsapp-send error:', error)

    await supabase.from('whatsapp_message_log').insert({
      template_key: template_key || 'unknown',
      phone: phone || 'unknown',
      status: 'failed',
      error: error.message,
    })

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
