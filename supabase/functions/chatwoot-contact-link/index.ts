import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Espejo de normalizePhone en whatsapp-send/index.ts.
function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (!digits.startsWith('54')) {
    digits = digits.startsWith('9') ? `54${digits}` : `549${digits}`
  } else if (!digits.startsWith('549')) {
    digits = `549${digits.slice(2)}`
  }
  return `+${digits}`
}

async function chatwootFetch(baseUrl: string, apiToken: string, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      api_access_token: apiToken,
      ...(init.headers ?? {}),
    },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, contact_name } = await req.json()
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'phone es requerido' }),
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

    const normalized = normalizePhone(phone)

    // Buscar contacto existente por coincidencia exacta de teléfono (no por índice 0 del
    // search, que puede traer falsos positivos por substring).
    const searchRes = await chatwootFetch(
      baseUrl, apiToken,
      `/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(normalized)}`,
    )
    let contactId: number | undefined
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const match = (searchData?.payload ?? []).find(
        (c: { phone_number?: string }) => c.phone_number === normalized,
      )
      contactId = match?.id
    }

    // No existe todavía: lo creamos (sin mandar ningún mensaje) para poder linkear
    // directo a su ficha y que desde ahí se inicie la conversación a mano.
    if (!contactId) {
      const createRes = await chatwootFetch(baseUrl, apiToken, `/api/v1/accounts/${accountId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ inbox_id: Number(inboxId), phone_number: normalized, name: contact_name || normalized }),
      })
      if (!createRes.ok) {
        throw new Error(`No se pudo crear el contacto en Chatwoot: ${await createRes.text()}`)
      }
      const createData = await createRes.json()
      contactId = createData?.payload?.contact?.id ?? createData?.id
    }

    if (!contactId) throw new Error('Chatwoot no devolvió un id de contacto')

    // Si ya tiene alguna conversación (de cualquier inbox), linkear directo a esa.
    const convRes = await chatwootFetch(
      baseUrl, apiToken,
      `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
    )
    let conversationId: number | undefined
    if (convRes.ok) {
      const convData = await convRes.json()
      const sorted = [...(convData?.payload ?? [])].sort(
        (a: { last_activity_at?: number }, b: { last_activity_at?: number }) =>
          (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0),
      )
      conversationId = sorted[0]?.id
    }

    const url = conversationId
      ? `${baseUrl}/app/accounts/${accountId}/conversations/${conversationId}`
      : `${baseUrl}/app/accounts/${accountId}/contacts/${contactId}`

    return new Response(
      JSON.stringify({ success: true, url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('chatwoot-contact-link error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
