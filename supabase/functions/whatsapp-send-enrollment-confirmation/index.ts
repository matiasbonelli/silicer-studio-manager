import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Esta función es invocable por usuarios anónimos (landing pública), así que no acepta
// template_key/phone/variables arbitrarios como whatsapp-send — solo el id de una
// inscripción ya creada, y busca el teléfono/nombre/horario server-side. La info se manda
// en dos plantillas seguidas (info de pago + condiciones) porque el texto completo supera
// el límite de 1024 caracteres de una sola plantilla de Meta. El par (adultos o niños) se
// elige solo según el día del horario elegido: sábado es "sólo niños" (ver DAY_NAMES en
// src/types/database.ts), el resto son adultos.
const TEMPLATE_KEYS_ADULTOS = ['msg_preinscripcion_recibida_adultos_1', 'msg_preinscripcion_recibida_adultos_2']
const TEMPLATE_KEYS_NINOS = ['msg_preinscripcion_recibida_ninos_1', 'msg_preinscripcion_recibida_ninos_2']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { enrollment_id } = await req.json()

    if (!enrollment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'enrollment_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: enrollment, error: fetchError } = await supabase
      .from('enrollments')
      .select('first_name, last_name, phone, schedule:schedules(day_of_week)')
      .eq('id', enrollment_id)
      .maybeSingle()

    if (fetchError || !enrollment) {
      return new Response(
        JSON.stringify({ success: false, error: 'Inscripción no encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!enrollment.phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'La inscripción no tiene teléfono cargado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const templateKeys = enrollment.schedule?.day_of_week === 'saturday'
      ? TEMPLATE_KEYS_NINOS
      : TEMPLATE_KEYS_ADULTOS

    const results = []
    for (const [index, templateKey] of templateKeys.entries()) {
      // Aunque estos envíos ya se esperan uno a uno, Chatwoot los encola como jobs de
      // fondo (Sidekiq) y puede procesarlos fuera de orden si hay más de un worker —
      // esta pausa le da tiempo al primero de salir antes de encolar el segundo.
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, 15000))
      }
      const sendRes = await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone: enrollment.phone,
          template_key: templateKey,
          variables: { nombre: enrollment.first_name },
          contact_name: [enrollment.first_name, enrollment.last_name].filter(Boolean).join(' '),
        },
      })
      results.push({ template_key: templateKey, error: sendRes.error?.message, data: sendRes.data })
    }

    const failed = results.filter((r) => r.error || r.data?.success === false)
    if (failed.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Uno o más mensajes fallaron', results }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('whatsapp-send-enrollment-confirmation error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
