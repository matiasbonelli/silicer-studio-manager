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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Leemos el monto y la hora de creación desde la DB — nunca confiar en
    // valores que mande el cliente para esto, son la base del matching.
    const { data: sale } = await supabase
      .from('sales')
      .select('total_amount, created_at, payment_status')
      .eq('id', sale_id)
      .single()

    if (!sale || sale.payment_status !== 'pending') {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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

    const sinceTime = new Date(sale.created_at).getTime()
    const amount = Number(sale.total_amount)

    const candidates = (mpData.results || []).filter((payment: { operation_type?: string; status?: string; transaction_amount?: number; date_created?: string }) => {
      if (payment.operation_type !== 'money_transfer') return false
      if (payment.status !== 'approved') return false
      if (!payment.date_created || new Date(payment.date_created).getTime() < sinceTime) return false
      return Math.abs(Number(payment.transaction_amount) - amount) < 0.01
    })

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Evitar que la misma transferencia se use para marcar como pagada más
    // de una venta (ej. dos ventas pendientes con el mismo monto).
    const candidateIds = candidates.map((p: { id: number | string }) => String(p.id))
    const { data: alreadyUsed } = await supabase
      .from('sales')
      .select('mp_payment_id')
      .in('mp_payment_id', candidateIds)

    const usedIds = new Set((alreadyUsed || []).map(s => s.mp_payment_id))
    const match = candidates.find((p: { id: number | string }) => !usedIds.has(String(p.id)))

    if (!match) {
      return new Response(
        JSON.stringify({ status: 'pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

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
