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
    const { sale_id } = await req.json()

    if (!sale_id) {
      return new Response(
        JSON.stringify({ error: 'sale_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

    // MP no entrega webhooks de forma confiable para pagos de Point en esta cuenta,
    // así que se consulta el estado directamente por external_reference.
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${sale_id}`,
      { headers: { 'Authorization': `Bearer ${mpAccessToken}` } },
    )

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpData = await mpResponse.json()
    const payment = (mpData.results || []).find((p: any) => p.status === 'approved')

    if (!payment) {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await supabase
      .from('sales')
      .update({
        payment_status: 'paid',
        paid_amount: payment.transaction_amount,
        mp_payment_id: String(payment.id),
      })
      .eq('id', sale_id)
      .eq('payment_status', 'pending')

    return new Response(
      JSON.stringify({ status: 'approved' }),
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
