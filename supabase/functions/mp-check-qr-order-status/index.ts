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
    const { sale_id, order_id } = await req.json()

    if (!sale_id || !order_id) {
      return new Response(
        JSON.stringify({ error: 'sale_id and order_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/orders/${order_id}`,
      { headers: { 'Authorization': `Bearer ${mpAccessToken}` } },
    )

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpData = await mpResponse.json()

    if (mpData.status !== 'processed') {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const payment = (mpData.transactions?.payments || [])[0]

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    await supabase
      .from('sales')
      .update({
        payment_status: 'paid',
        paid_amount: payment ? Number(payment.amount) : Number(mpData.total_amount),
        mp_payment_id: payment ? String(payment.id) : null,
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
