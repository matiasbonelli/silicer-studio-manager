import { supabase } from '@/integrations/supabase/client';
import { Sale, PaymentMethod, PaymentStatus } from '@/types/database';

export interface SaleItemInput {
  inventory_id: string;
  quantity: number;
  unit_price: number;
  is_customer_piece?: boolean;
  cuota_student_id?: string | null;
  cuota_month?: string | null;
}

export interface CreatePendingSaleInput {
  studentId: string | null;
  items: SaleItemInput[];
  paymentMethod: PaymentMethod;
  totalAmount: number;
}

/** Crea una venta en estado 'pending' junto con sus sale_items. Usado por
 * todos los flujos de cobro (efectivo/tarjeta/transferencia y los 3 de MP). */
export async function createPendingSale(
  input: CreatePendingSaleInput
): Promise<{ sale: Sale | null; error: Error | null }> {
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert({
      student_id: input.studentId,
      total_amount: input.totalAmount,
      payment_method: input.paymentMethod,
      payment_status: 'pending',
      paid_amount: 0,
    })
    .select()
    .single();

  if (saleError || !saleData) {
    return { sale: null, error: saleError };
  }

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from('sale_items').insert(
      input.items.map((item) => ({
        sale_id: saleData.id,
        inventory_id: item.inventory_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        is_customer_piece: item.is_customer_piece ?? false,
        cuota_student_id: item.cuota_student_id ?? null,
        cuota_month: item.cuota_month ?? null,
      }))
    );
    if (itemsError) {
      return { sale: saleData as Sale, error: itemsError };
    }
  }

  return { sale: saleData as Sale, error: null };
}

/** Elimina una venta pendiente y sus items (cancelación de un cobro MP que no se confirmó). */
export async function deletePendingSale(saleId: string): Promise<void> {
  await supabase.from('sale_items').delete().eq('sale_id', saleId);
  await supabase.from('sales').delete().eq('id', saleId);
}

export interface RegisterSalePaymentInput {
  type: 'total' | 'partial';
  amount: number;
}

/** Registra (o edita) el pago de una venta: efectivo/tarjeta/transferencia cobrados manualmente. */
export async function registerSalePayment(
  saleId: string,
  input: RegisterSalePaymentInput
): Promise<{ error: Error | null }> {
  const status: PaymentStatus = input.type === 'total' ? 'paid' : 'partial';
  const { error } = await supabase
    .from('sales')
    .update({ payment_status: status, paid_amount: input.amount })
    .eq('id', saleId);
  return { error };
}

/** Se suscribe a los cambios de una venta vía Realtime y llama a onPaid cuando
 * payment_status pasa a 'paid'. Devuelve una función de cleanup. */
export function subscribeToSalePayment(
  saleId: string,
  onPaid: (sale: Sale) => void
): () => void {
  const channel = supabase
    .channel(`sale-payment-${saleId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sales', filter: `id=eq.${saleId}` },
      (payload) => {
        const updated = payload.new as Sale;
        if (updated.payment_status === 'paid') {
          onPaid(updated);
        }
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}

/** Envía la orden al Point Smart (edge function mp-create-payment-intent). */
export async function invokeMpPointCharge(saleId: string, amount: number) {
  return supabase.functions.invoke('mp-create-payment-intent', {
    body: { sale_id: saleId, amount },
  });
}

/** Consulta de respaldo del estado de un cobro Point (webhooks poco confiables). */
export async function checkMpPointStatus(saleId: string) {
  return supabase.functions.invoke('mp-check-payment-status', { body: { sale_id: saleId } });
}

/** Crea la orden QR híbrida (edge function mp-create-qr-order). */
export async function invokeMpQrCharge(saleId: string, amount: number) {
  return supabase.functions.invoke<{ success: boolean; order_id: string; qr_data?: string }>(
    'mp-create-qr-order',
    { body: { sale_id: saleId, amount } }
  );
}

/** Consulta de respaldo del estado de una orden QR. */
export async function checkMpQrStatus(saleId: string, orderId: string) {
  return supabase.functions.invoke('mp-check-qr-order-status', {
    body: { sale_id: saleId, order_id: orderId },
  });
}

/** Consulta de respaldo de una transferencia entrante en la cuenta MP. */
export async function checkMpTransferStatus(saleId: string) {
  return supabase.functions.invoke('mp-check-transfer-status', { body: { sale_id: saleId } });
}
