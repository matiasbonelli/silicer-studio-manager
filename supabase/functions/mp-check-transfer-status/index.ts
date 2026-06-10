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
    const { sale_id, amount, since } = await req.json()

    if (!sale_id || !amount || !since) {
      return new Response(
        JSON.stringify({ error: 'sale_id, amount and since are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

    const mpResponse = await fetch(
      'https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=30',
      { headers: { 'Authorization': `Bearer ${mpAccessToken}` } },
    )

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const mpData = await mpResponse.json()
    console.log('MP payments search response:', JSON.stringify(mpData))

    const sinceTime = new Date(since).getTime()

    const match = (mpData.results || []).find((payment: { operation_type?: string; status?: string; transaction_amount?: number; date_created?: string }) => {
      if (payment.operation_type !== 'money_transfer') return false
      if (payment.status !== 'approved') return false
      if (!payment.date_created || new Date(payment.date_created).getTime() < sinceTime) return false
      return Math.abs(Number(payment.transaction_amount) - Number(amount)) < 0.01
    })

    if (!match) {
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
        paid_amount: Number(match.transaction_amount),
        mp_payment_id: String(match.id),
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
