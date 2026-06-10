import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sale_id, amount } = await req.json()

    if (!sale_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'sale_id and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')
    const mpDeviceId = Deno.env.get('MP_DEVICE_ID')

    if (!mpAccessToken || !mpDeviceId) {
      return new Response(
        JSON.stringify({ error: 'MP_ACCESS_TOKEN and MP_DEVICE_ID must be configured in Supabase Vault' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Send payment intent to the Point Smart device
    const mpResponse = await fetch(
      `https://api.mercadopago.com/point/integration-api/devices/${mpDeviceId}/payment-intents`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Point Integration API expects amount in cents (centavos)
          amount: Math.round(amount * 100),
          additional_info: {
            external_reference: sale_id,
            print_on_terminal: true,
          },
        }),
      },
    )

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.text()
      console.error('MP API error:', errorBody)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment intent', details: errorBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpData = await mpResponse.json()

    // Persist the payment intent ID in the sale record
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await supabase
      .from('sales')
      .update({ mp_payment_id: mpData.id })
      .eq('id', sale_id)

    return new Response(
      JSON.stringify({ success: true, payment_intent_id: mpData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Unhandled error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
