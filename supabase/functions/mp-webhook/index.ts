import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// MP sends a GET request to verify the webhook URL during setup
// All other webhook events arrive as POST requests
serve(async (req) => {
  if (req.method === 'GET') {
    return new Response('Webhook activo', { status: 200 })
  }

  try {
    const body = await req.json()
    console.log('MP webhook received:', JSON.stringify(body))

    // Only process payment events
    if (body.type !== 'payment') {
      return new Response('ok', { status: 200 })
    }

    const paymentId = body.data?.id
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN')

    if (!paymentId || !mpAccessToken) {
      console.error('Missing paymentId or MP_ACCESS_TOKEN')
      return new Response('ok', { status: 200 })
    }

    // Fetch full payment details from MP API
    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { 'Authorization': `Bearer ${mpAccessToken}` },
      },
    )

    if (!paymentResponse.ok) {
      console.error('Failed to fetch payment from MP:', await paymentResponse.text())
      return new Response('error', { status: 500 })
    }

    const payment = await paymentResponse.json()
    console.log('Payment status:', payment.status, 'external_reference:', payment.external_reference)

    // external_reference is the sale_id we set when creating the payment intent
    const saleId = payment.external_reference
    if (!saleId) {
      return new Response('ok', { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (payment.status === 'approved') {
      await supabase
        .from('sales')
        .update({
          payment_status: 'paid',
          paid_amount: payment.transaction_amount,
          mp_payment_id: String(paymentId),
        })
        .eq('id', saleId)

      console.log('Sale', saleId, 'marked as paid via Point')
    } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
      // Leave payment_status as 'pending' so the operator can handle it manually
      console.log('Payment', paymentId, 'was', payment.status, '— sale left as pending')
    }

    // Always return 200 so MP stops retrying
    return new Response('ok', { status: 200 })
  } catch (error) {
    console.error('Webhook error:', error)
    // Return 200 to prevent MP from flooding with retries
    return new Response('ok', { status: 200 })
  }
})
