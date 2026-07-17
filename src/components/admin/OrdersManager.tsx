import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Student,
  InventoryItem,
  MoldOrder,
  OrderStatus,
  PaymentMethod,
  ORDER_STATUS_LABELS,
} from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/format';
import {
  createPendingSale,
  deletePendingSale,
  registerSalePayment,
  subscribeToSalePayment,
  invokeMpPointCharge,
  checkMpPointStatus,
  invokeMpQrCharge,
  checkMpQrStatus,
  checkMpTransferStatus,
} from '@/lib/sales';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { sendWhatsApp } from '@/lib/whatsapp';
import { QRCodeSVG } from 'qrcode.react';
import {
  Plus,
  Minus,
  Search,
  MessageCircle,
  Trash2,
  DollarSign,
  Pencil,
  ChevronRight,
  ChevronLeft,
  ClipboardCheck,
  Loader2,
  Banknote,
  ArrowRightLeft,
  CreditCard,
  Smartphone,
  QrCode,
  XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// WhatsApp helper removed – using shared sendWhatsApp from @/lib/whatsapp

const nextStatus: Record<OrderStatus, OrderStatus | null> = {
  pending: 'ready',
  ready: 'delivered',
  delivered: null,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrdersManager() {
  const [orders, setOrders] = useState<MoldOrder[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [moldProducts, setMoldProducts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Recargo global (mismo que aplica Ventas, cargado desde app_settings)
  const [recargo, setRecargo] = useState<number>(1);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MoldOrder | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formStudentId, setFormStudentId] = useState('');
  const [formProductName, setFormProductName] = useState('');
  const [formProductPrice, setFormProductPrice] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formPricingProductId, setFormPricingProductId] = useState<string | null>(null);
  const [formSelectedInventoryId, setFormSelectedInventoryId] = useState<string>('');
  const [formStatus, setFormStatus] = useState<OrderStatus>('pending');
  const [formNotes, setFormNotes] = useState('');

  // Delete confirmation
  const [orderToDelete, setOrderToDelete] = useState<MoldOrder | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Registrar pago (misma lógica que Ventas)
  const [paymentOrder, setPaymentOrder] = useState<MoldOrder | null>(null);
  const [pmMethod, setPmMethod] = useState<PaymentMethod>('cash');
  const [pmCreating, setPmCreating] = useState(false);
  const [pmSaleId, setPmSaleId] = useState<string | null>(null);
  const [pmManualStep, setPmManualStep] = useState(false);
  const [pmPaymentType, setPmPaymentType] = useState<'total' | 'partial'>('total');
  const [pmPartialAmount, setPmPartialAmount] = useState('');
  const [pmWaiting, setPmWaiting] = useState(false);
  const [pmError, setPmError] = useState<string | null>(null);
  const [pmQrData, setPmQrData] = useState<string | null>(null);
  const pmChannelRef = useRef<(() => void) | null>(null);
  const pmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pmPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { toast } = useToast();

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mold_orders')
      .select('*, student:students(id, first_name, last_name, phone)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'No se pudieron cargar los pedidos', variant: 'destructive' });
    } else {
      setOrders((data ?? []) as MoldOrder[]);
    }
    setLoading(false);
  }, [toast]);

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('students')
      .select('id, first_name, last_name, phone')
      .order('first_name');
    if (data) setStudents(data as Student[]);
  }, []);

  const fetchMoldProducts = useCallback(async () => {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('category', 'moldes')
      .eq('for_sale', true)
      .order('name');
    if (data) setMoldProducts(data as InventoryItem[]);
  }, []);

  const fetchRecargo = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'recargo_percent')
      .single();
    if (data) setRecargo(parseFloat(data.value) || 0);
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchStudents();
    fetchMoldProducts();
    fetchRecargo();
  }, [fetchOrders, fetchStudents, fetchMoldProducts, fetchRecargo]);

  // ---------------------------------------------------------------------------
  // Filtering & pagination
  // ---------------------------------------------------------------------------

  const filtered = orders.filter((o) => {
    const text = search.toLowerCase();
    const studentName = o.student
      ? `${o.student.first_name} ${o.student.last_name}`.toLowerCase()
      : '';
    const matchesSearch =
      !text || studentName.includes(text) || o.product_name.toLowerCase().includes(text);
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------

  const openCreateModal = () => {
    setEditingOrder(null);
    setFormStudentId('');
    setFormSelectedInventoryId('');
    setFormProductName('');
    setFormProductPrice('');
    setFormQuantity('1');
    setFormPricingProductId(null);
    setFormStatus('pending');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (order: MoldOrder) => {
    setEditingOrder(order);
    setFormStudentId(order.student_id);
    setFormSelectedInventoryId(order.inventory_id ?? '');
    setFormProductName(order.product_name);
    setFormProductPrice(String(order.product_price));
    setFormQuantity(String(order.quantity ?? 1));
    setFormPricingProductId(order.pricing_product_id);
    setFormStatus(order.status);
    setFormNotes(order.notes ?? '');
    setIsModalOpen(true);
  };

  const handleProductSelect = (inventoryId: string) => {
    const product = moldProducts.find((p) => p.id === inventoryId);
    if (product) {
      setFormSelectedInventoryId(inventoryId);
      setFormProductName(product.name);
      setFormProductPrice(String(product.price));
      // pricing_product_id referencia pricing_products (distinto a inventory),
      // lo dejamos null ya que es un campo opcional de referencia futura.
      setFormPricingProductId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!formStudentId || !formProductName) {
      toast({ title: 'Completá alumno y producto', variant: 'destructive' });
      return;
    }

    const qty = Math.max(1, parseInt(formQuantity) || 1);

    setSaving(true);
    const payload = {
      student_id: formStudentId,
      product_name: formProductName,
      product_price: parseFloat(formProductPrice) || 0,
      quantity: qty,
      pricing_product_id: formPricingProductId,
      inventory_id: formSelectedInventoryId || null,
      status: formStatus,
      notes: formNotes || null,
    };

    if (editingOrder) {
      const { error } = await supabase
        .from('mold_orders')
        .update({ ...payload, produced_quantity: Math.min(editingOrder.produced_quantity, qty) })
        .eq('id', editingOrder.id);
      if (error) {
        toast({ title: 'Error al actualizar', variant: 'destructive' });
      } else {
        toast({ title: 'Pedido actualizado' });
        setIsModalOpen(false);
        fetchOrders();
      }
    } else {
      const { error } = await supabase.from('mold_orders').insert(payload);
      if (error) {
        toast({ title: 'Error al crear pedido', variant: 'destructive' });
      } else {
        toast({ title: 'Pedido creado' });
        setIsModalOpen(false);
        fetchOrders();
      }
    }
    setSaving(false);
  };

  const handleAdvanceStatus = async (order: MoldOrder) => {
    const next = nextStatus[order.status];
    if (!next) return;
    const { error } = await supabase
      .from('mold_orders')
      .update({ status: next })
      .eq('id', order.id);
    if (error) {
      toast({ title: 'Error al cambiar estado', variant: 'destructive' });
    } else {
      toast({ title: `Estado: ${ORDER_STATUS_LABELS[next]}` });
      fetchOrders();
    }
  };

  // ---------------------------------------------------------------------------
  // Seguimiento de producción: cuántas unidades del pedido ya están hechas
  // ---------------------------------------------------------------------------

  const handleProducedDelta = async (order: MoldOrder, delta: number) => {
    const qty = order.quantity ?? 1;
    const next = Math.max(0, Math.min(qty, order.produced_quantity + delta));
    if (next === order.produced_quantity) return;

    const completingNow = next === qty && order.produced_quantity < qty;
    const payload: Record<string, unknown> = { produced_quantity: next };
    if (completingNow && order.status === 'pending') {
      payload.status = 'ready';
    }

    const { error } = await supabase.from('mold_orders').update(payload).eq('id', order.id);
    if (error) {
      toast({ title: 'Error al actualizar producción', variant: 'destructive' });
    } else {
      if (completingNow && order.status === 'pending') {
        toast({ title: 'Producción completa', description: 'El pedido pasó a "Listo"' });
      }
      fetchOrders();
    }
  };

  // ---------------------------------------------------------------------------
  // Registrar pago (misma lógica que Ventas: crea sale + sale_item y pasa por
  // el mismo flujo de cobro, incluido Mercado Pago)
  // ---------------------------------------------------------------------------

  const cleanupPaymentFlow = () => {
    if (pmChannelRef.current) {
      pmChannelRef.current();
      pmChannelRef.current = null;
    }
    if (pmTimeoutRef.current) {
      clearTimeout(pmTimeoutRef.current);
      pmTimeoutRef.current = null;
    }
    if (pmPollRef.current) {
      clearInterval(pmPollRef.current);
      pmPollRef.current = null;
    }
  };

  const closePaymentModal = () => {
    cleanupPaymentFlow();
    setPaymentOrder(null);
    setPmMethod('cash');
    setPmCreating(false);
    setPmSaleId(null);
    setPmManualStep(false);
    setPmPaymentType('total');
    setPmPartialAmount('');
    setPmWaiting(false);
    setPmError(null);
    setPmQrData(null);
  };

  const openPaymentModal = (order: MoldOrder) => {
    setPaymentOrder(order);
    setPmMethod('cash');
  };

  const cancelPaymentFlow = async () => {
    cleanupPaymentFlow();
    if (pmSaleId && paymentOrder) {
      await deletePendingSale(pmSaleId);
      await supabase.from('mold_orders').update({ sale_id: null }).eq('id', paymentOrder.id);
    }
    setPmWaiting(false);
    setPmSaleId(null);
    setPmManualStep(false);
    setPmError(null);
    setPmQrData(null);
    fetchOrders();
  };

  const applyRecargo = (subtotal: number) => subtotal + Math.round(subtotal * recargo / 100);

  const orderTotal = (order: MoldOrder) => applyRecargo(order.product_price * (order.quantity ?? 1));

  const startMpWaitingFlow = (order: MoldOrder, saleId: string) => {
    setPmWaiting(true);
    setPmError(null);

    const unsubscribe = subscribeToSalePayment(saleId, async () => {
      cleanupPaymentFlow();
      toast({ title: '¡Pago confirmado!', description: `Total cobrado: ${formatCurrency(orderTotal(order))}` });
      closePaymentModal();
      fetchOrders();
    });
    pmChannelRef.current = unsubscribe;

    pmTimeoutRef.current = setTimeout(() => {
      setPmError('El pago no fue confirmado en 5 minutos. Podés cancelar o seguir esperando.');
    }, 5 * 60 * 1000);
  };

  const handleConfirmPaymentMethod = async () => {
    if (!paymentOrder || !paymentOrder.inventory_id) return;
    setPmCreating(true);

    const total = orderTotal(paymentOrder);
    const isPointMethod = pmMethod === 'debit_card' || pmMethod === 'credit_card';
    const isQrMethod = pmMethod === 'mercadopago';
    const isTransferMethod = pmMethod === 'transfer';

    const { sale, error } = await createPendingSale({
      studentId: paymentOrder.student_id,
      totalAmount: total,
      paymentMethod: isPointMethod || isQrMethod ? 'mercadopago' : pmMethod,
      items: [
        {
          inventory_id: paymentOrder.inventory_id,
          quantity: paymentOrder.quantity ?? 1,
          unit_price: paymentOrder.product_price,
        },
      ],
    });

    setPmCreating(false);

    if (!sale || error) {
      toast({ title: 'Error', description: 'No se pudo registrar la venta', variant: 'destructive' });
      return;
    }

    await supabase.from('mold_orders').update({ sale_id: sale.id }).eq('id', paymentOrder.id);
    setPmSaleId(sale.id);

    if (isPointMethod) {
      startMpWaitingFlow(paymentOrder, sale.id);
      try {
        const { error: fnError } = await invokeMpPointCharge(sale.id, total);
        if (fnError) {
          setPmError('No se pudo enviar la orden al Point. Verificá la configuración de Mercado Pago.');
        }
      } catch {
        setPmError('Error de conexión con Mercado Pago.');
      }
      pmPollRef.current = setInterval(() => {
        checkMpPointStatus(sale.id);
      }, 4000);
    } else if (isQrMethod) {
      startMpWaitingFlow(paymentOrder, sale.id);
      let orderId: string | null = null;
      try {
        const { data: fnData, error: fnError } = await invokeMpQrCharge(sale.id, total);
        if (fnError || !fnData?.success) {
          setPmError('No se pudo generar el código QR. Verificá la configuración de Mercado Pago.');
        } else {
          orderId = fnData.order_id;
          setPmQrData(fnData.qr_data ?? null);
        }
      } catch {
        setPmError('Error de conexión con Mercado Pago.');
      }
      if (!orderId) return;
      pmPollRef.current = setInterval(() => {
        checkMpQrStatus(sale.id, orderId as string);
      }, 4000);
    } else if (isTransferMethod) {
      startMpWaitingFlow(paymentOrder, sale.id);
      pmPollRef.current = setInterval(() => {
        checkMpTransferStatus(sale.id);
      }, 4000);
    } else {
      // Efectivo / registro manual: pedir total o parcial
      setPmManualStep(true);
    }
  };

  const handleConfirmManualPayment = async () => {
    if (!pmSaleId || !paymentOrder) return;
    const total = orderTotal(paymentOrder);
    const paidAmount = pmPaymentType === 'total' ? total : parseFloat(pmPartialAmount) || 0;

    if (pmPaymentType === 'partial' && (paidAmount <= 0 || paidAmount >= total)) {
      toast({ title: 'Monto inválido', description: 'El pago parcial debe ser mayor a 0 y menor al total', variant: 'destructive' });
      return;
    }

    const { error } = await registerSalePayment(pmSaleId, { type: pmPaymentType, amount: paidAmount });
    if (error) {
      toast({ title: 'Error', description: 'No se pudo registrar el pago', variant: 'destructive' });
      return;
    }

    toast({ title: 'Pago registrado' });
    closePaymentModal();
    fetchOrders();
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    setIsDeleting(true);
    const { error } = await supabase.from('mold_orders').delete().eq('id', orderToDelete.id);
    setIsDeleting(false);
    if (error) {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    } else {
      toast({ title: 'Pedido eliminado' });
      setIsDeleteModalOpen(false);
      setOrderToDelete(null);
      fetchOrders();
    }
  };

  // ---------------------------------------------------------------------------
  // Badge renderers
  // ---------------------------------------------------------------------------

  const statusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="destructive">Pendiente</Badge>;
      case 'ready':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Listo</Badge>;
      case 'delivered':
        return <Badge className="bg-green-500 hover:bg-green-600">Entregado</Badge>;
    }
  };

  const paymentBadge = (order: MoldOrder) => {
    if (order.payment_status === 'pending') {
      return <Badge variant="outline">No pagado</Badge>;
    }
    if (!order.sale_id) {
      return (
        <Badge className="bg-green-500/70 hover:bg-green-600/70" title="Pagado antes de vincularse con Ventas">
          Pagado (histórico)
        </Badge>
      );
    }
    return <Badge className="bg-green-500 hover:bg-green-600">Pagado</Badge>;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Pedidos de Moldes</h2>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo Pedido
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar alumno o producto..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-44">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="ready">Listo</SelectItem>
              <SelectItem value="delivered">Entregado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-44">
          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(0); }}>
            <SelectTrigger>
              <SelectValue placeholder="Pago" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pagos</SelectItem>
              <SelectItem value="pending">No pagado</SelectItem>
              <SelectItem value="paid">Pagado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumen */}
      {!loading && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {filtered.filter((o) => o.status === 'pending').length} pendientes
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
            {filtered.filter((o) => o.status === 'ready').length} listos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {filtered.filter((o) => o.status === 'delivered').length} entregados
          </span>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center">Cant.</TableHead>
              <TableHead className="text-center">Producción</TableHead>
              <TableHead className="text-right">P. unitario</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-center">Pago</TableHead>
              <TableHead className="text-center">Fecha</TableHead>
              <TableHead className="text-center">WhatsApp</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <ClipboardCheck className="h-10 w-10 opacity-30" />
                    {search || statusFilter !== 'all' || paymentFilter !== 'all' ? (
                      <>
                        <p className="font-medium">No se encontraron pedidos</p>
                        <p className="text-sm">Probá cambiando los filtros.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Todavía no hay pedidos</p>
                        <p className="text-sm">Creá un nuevo pedido para empezar a llevar el registro.</p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((order) => {
                const student = order.student;
                const studentName = student
                  ? `${student.first_name} ${student.last_name}`
                  : 'Alumno eliminado';
                const qty = order.quantity ?? 1;
                const total = orderTotal(order);
                const canWhatsApp = order.status === 'ready' && student?.phone;
                const whatsAppMsg =
                  `Hola ${student?.first_name ?? ''}, tu pedido está listo para retirar en Silicer Studio! 🎉\n\n` +
                  `📦 Producto: ${order.product_name}\n` +
                  `🔢 Cantidad: ${qty}\n` +
                  `💰 Total: ${formatCurrency(total)}\n\n` +
                  `¡Cualquier consulta escribinos!`;

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{studentName}</TableCell>
                    <TableCell>{order.product_name}</TableCell>
                    <TableCell className="text-center">{qty}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0"
                          title="Restar unidad producida"
                          disabled={order.produced_quantity <= 0}
                          onClick={() => handleProducedDelta(order, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span
                          className={`text-sm tabular-nums min-w-[2.5rem] ${order.produced_quantity >= qty ? 'text-green-600 font-medium' : ''}`}
                        >
                          {order.produced_quantity}/{qty}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 w-6 p-0"
                          title="Sumar unidad producida"
                          disabled={order.produced_quantity >= qty}
                          onClick={() => handleProducedDelta(order, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(order.product_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                    <TableCell className="text-center">{statusBadge(order.status)}</TableCell>
                    <TableCell className="text-center">{paymentBadge(order)}</TableCell>
                    <TableCell className="text-center text-sm">{formatDate(order.created_at)}</TableCell>
                    <TableCell className="text-center">
                      {canWhatsApp ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-green-600 hover:text-green-700"
                          onClick={() => sendWhatsApp(student!.phone!, whatsAppMsg, toast)}
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs">Avisar</span>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {nextStatus[order.status] && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            title={`Avanzar a ${ORDER_STATUS_LABELS[nextStatus[order.status]!]}`}
                            onClick={() => handleAdvanceStatus(order)}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-7 px-2 ${order.payment_status === 'paid' ? 'text-green-600' : ''}`}
                          title={
                            order.payment_status === 'paid'
                              ? 'Pagado'
                              : order.inventory_id
                                ? 'Registrar pago'
                                : 'Editá el pedido y seleccioná un producto de inventario para poder cobrarlo'
                          }
                          disabled={order.payment_status === 'paid' || !order.inventory_id}
                          onClick={() => openPaymentModal(order)}
                        >
                          <DollarSign className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          title="Editar"
                          onClick={() => openEditModal(order)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-destructive hover:text-destructive"
                          title="Eliminar"
                          onClick={() => {
                            setOrderToDelete(order);
                            setIsDeleteModalOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} pedidos
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <span className="px-2">Página {page + 1} de {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
              Siguiente <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Crear/Editar */}
      <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) setIsModalOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingOrder ? 'Editar Pedido' : 'Nuevo Pedido'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Alumno */}
            <div className="space-y-2">
              <Label>Alumno</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alumno" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Producto */}
            <div className="space-y-2">
              <Label>Producto (molde)</Label>
              <Select
                value={formSelectedInventoryId}
                onValueChange={handleProductSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar molde" />
                </SelectTrigger>
                <SelectContent>
                  {moldProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatCurrency(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad + Precio unitario */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={formQuantity}
                  onChange={(e) => setFormQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio unitario</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formProductPrice}
                  onChange={(e) => setFormProductPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Total calculado (con recargo, igual que Ventas) */}
            {formProductPrice && formQuantity && (
              <p className="text-sm text-muted-foreground -mt-2">
                Total (con recargo {recargo}%):{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(applyRecargo((parseFloat(formProductPrice) || 0) * (parseInt(formQuantity) || 1)))}
                </span>
              </p>
            )}

            {/* Estado */}
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as OrderStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="ready">Listo</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingOrder && (
              <p className="text-xs text-muted-foreground -mt-2">
                El pago se gestiona con el botón <DollarSign className="w-3 h-3 inline" /> "Registrar pago" de la tabla, no desde este formulario.
              </p>
            )}

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                placeholder="Observaciones del pedido..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingOrder ? 'Guardar' : 'Crear Pedido'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Eliminar */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Pedido</DialogTitle>
          </DialogHeader>
          {orderToDelete && (
            <p>
              ¿Eliminar el pedido de <strong>{orderToDelete.product_name}</strong> para{' '}
              <strong>
                {orderToDelete.student
                  ? `${orderToDelete.student.first_name} ${orderToDelete.student.last_name}`
                  : 'alumno'}
              </strong>
              ? Esta acción no se puede deshacer.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Registrar Pago */}
      <Dialog
        open={!!paymentOrder && !pmWaiting}
        onOpenChange={(open) => { if (!open) closePaymentModal(); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>

          {paymentOrder && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">{paymentOrder.product_name}</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(orderTotal(paymentOrder))}</p>
                {recargo > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Incluye recargo del {recargo}% ({formatCurrency(orderTotal(paymentOrder) - paymentOrder.product_price * (paymentOrder.quantity ?? 1))})
                  </p>
                )}
              </div>

              {!pmManualStep ? (
                <>
                  <div className="space-y-2">
                    <Label>Método de Pago</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { value: 'cash', label: 'Efectivo', Icon: Banknote },
                          { value: 'transfer', label: 'Transferencia', Icon: ArrowRightLeft },
                          { value: 'debit_card', label: 'T. Débito', Icon: CreditCard },
                          { value: 'credit_card', label: 'T. Crédito', Icon: CreditCard },
                        ] as const
                      ).map(({ value, label, Icon }) => (
                        <Button
                          key={value}
                          type="button"
                          variant={pmMethod === value ? 'default' : 'outline'}
                          size="sm"
                          className="flex flex-col h-auto py-2 gap-1"
                          onClick={() => setPmMethod(value)}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-xs leading-none">{label}</span>
                        </Button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant={pmMethod === 'mercadopago' ? 'default' : 'outline'}
                      size="sm"
                      className={`w-full flex items-center gap-2 transition-colors ${pmMethod === 'mercadopago' ? 'bg-[#009ee3] hover:bg-[#0082bd] border-[#009ee3] text-white' : 'hover:border-[#009ee3] hover:text-[#009ee3]'}`}
                      onClick={() => setPmMethod('mercadopago')}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Mercado Pago — QR</span>
                    </Button>
                  </div>

                  <Button
                    className={`w-full ${pmMethod !== 'cash' ? 'bg-[#009ee3] hover:bg-[#0082bd] border-[#009ee3] text-white' : ''}`}
                    size="lg"
                    onClick={handleConfirmPaymentMethod}
                    disabled={pmCreating}
                  >
                    {pmCreating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : pmMethod === 'cash' ? (
                      'Continuar'
                    ) : (
                      <><DollarSign className="w-4 h-4 mr-2" /> Cobrar</>
                    )}
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Tipo de Pago</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={pmPaymentType === 'total' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setPmPaymentType('total')}
                    >
                      Pago Total
                    </Button>
                    <Button
                      variant={pmPaymentType === 'partial' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1"
                      onClick={() => setPmPaymentType('partial')}
                    >
                      Pago Parcial
                    </Button>
                  </div>

                  {pmPaymentType === 'total' ? (
                    <p className="text-sm text-muted-foreground text-center">
                      Se registrará el pago completo de {formatCurrency(orderTotal(paymentOrder))}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="pmPartialAmount">Monto del pago parcial</Label>
                      <Input
                        id="pmPartialAmount"
                        type="number"
                        placeholder="Ej: 5000"
                        value={pmPartialAmount}
                        onChange={(e) => setPmPartialAmount(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Total del pedido: {formatCurrency(orderTotal(paymentOrder))}
                      </p>
                    </div>
                  )}

                  <Button onClick={handleConfirmManualPayment} className="w-full">
                    <DollarSign className="w-4 h-4 mr-2" /> Confirmar Pago
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Overlay: esperando confirmación de Mercado Pago (Point / QR / Transferencia) */}
      <Dialog open={pmWaiting} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {pmMethod === 'mercadopago' ? (
                <><QrCode className="w-5 h-5 text-[#009ee3]" /> Cobrar con QR — Mercado Pago</>
              ) : pmMethod === 'transfer' ? (
                <><ArrowRightLeft className="w-5 h-5 text-[#009ee3]" /> Cobrar con Transferencia</>
              ) : (
                <><Smartphone className="w-5 h-5 text-[#009ee3]" /> Cobrar con Point</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">
                {formatCurrency(paymentOrder ? orderTotal(paymentOrder) : 0)}
              </p>
              {pmMethod === 'mercadopago' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Escaneá el código con la app de MercadoPago o cualquier billetera, o pagá con tarjeta en el Point
                </p>
              )}
              {pmMethod === 'transfer' && (
                <p className="text-sm text-muted-foreground mt-1">Pasale tu alias de Mercado Pago al cliente</p>
              )}
            </div>

            {!pmError ? (
              <div className="flex flex-col items-center gap-3 py-2">
                {pmMethod === 'mercadopago' ? (
                  pmQrData ? (
                    <div className="p-3 bg-white rounded-md border">
                      <QRCodeSVG value={pmQrData} size={220} />
                    </div>
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin text-[#009ee3]" />
                  )
                ) : (
                  <Loader2 className="w-8 h-8 animate-spin text-[#009ee3]" />
                )}
                <p className="text-sm text-center text-muted-foreground">
                  Esperando que se confirme el pago...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <XCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-center text-destructive">{pmError}</p>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={cancelPaymentFlow}>
              Cancelar y anular venta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
