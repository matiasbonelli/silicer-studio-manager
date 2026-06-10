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
    const mpPosExternalId = Deno.env.get('MP_POS_EXTERNAL_ID')

    if (!mpAccessToken || !mpPosExternalId) {
      return new Response(
        JSON.stringify({ error: 'MP_ACCESS_TOKEN and MP_POS_EXTERNAL_ID must be configured in Supabase Vault' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const totalAmount = amount.toFixed(2)

    // Orders API: orden de tipo QR en modo híbrido (combina el QR estático
    // de la caja con un QR dinámico exclusivo para esta venta)
    const mpResponse = await fetch(
      'https://api.mercadopago.com/v1/orders',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          type: 'qr',
          external_reference: sale_id,
          total_amount: totalAmount,
          transactions: {
            payments: [{ amount: totalAmount }],
          },
          config: {
            qr: {
              external_pos_id: mpPosExternalId,
              mode: 'hybrid',
            },
          },
        }),
      },
    )

    if (!mpResponse.ok) {
      const errorBody = await mpResponse.text()
      console.error('MP API error:', errorBody)
      return new Response(
        JSON.stringify({ error: 'Failed to create QR order', details: errorBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpData = await mpResponse.json()
    console.log('MP order response:', JSON.stringify(mpData))

    const qrData = mpData?.config?.qr?.qr_data ?? mpData?.qr_data ?? null

    // Persist the order ID in the sale record
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await supabase
      .from('sales')
      .update({ mp_order_id: mpData.id })
      .eq('id', sale_id)

    return new Response(
      JSON.stringify({ success: true, order_id: mpData.id, qr_data: qrData }),
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
