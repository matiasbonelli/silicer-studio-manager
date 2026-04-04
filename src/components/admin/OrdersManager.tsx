import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Student,
  InventoryItem,
  MoldOrder,
  OrderStatus,
  OrderPaymentStatus,
  ORDER_STATUS_LABELS,
  ORDER_PAYMENT_STATUS_LABELS,
} from '@/types/database';
import { formatCurrency, formatDate } from '@/lib/format';
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
import {
  Plus,
  Search,
  MessageCircle,
  Trash2,
  DollarSign,
  Pencil,
  ChevronRight,
  ChevronLeft,
  ClipboardCheck,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildWhatsAppUrl = (phone: string, message: string): string => {
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/54${clean}?text=${encodeURIComponent(message)}`;
};

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
  const [formPaymentStatus, setFormPaymentStatus] = useState<OrderPaymentStatus>('pending');
  const [formNotes, setFormNotes] = useState('');

  // Delete confirmation
  const [orderToDelete, setOrderToDelete] = useState<MoldOrder | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  useEffect(() => {
    fetchOrders();
    fetchStudents();
    fetchMoldProducts();
  }, [fetchOrders, fetchStudents, fetchMoldProducts]);

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
    setFormPaymentStatus('pending');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (order: MoldOrder) => {
    setEditingOrder(order);
    setFormStudentId(order.student_id);
    setFormSelectedInventoryId('');
    setFormProductName(order.product_name);
    setFormProductPrice(String(order.product_price));
    setFormQuantity(String(order.quantity ?? 1));
    setFormPricingProductId(order.pricing_product_id);
    setFormStatus(order.status);
    setFormPaymentStatus(order.payment_status);
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
      status: formStatus,
      payment_status: formPaymentStatus,
      notes: formNotes || null,
    };

    if (editingOrder) {
      const { error } = await supabase
        .from('mold_orders')
        .update(payload)
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

  const handleTogglePayment = async (order: MoldOrder) => {
    const next: OrderPaymentStatus = order.payment_status === 'paid' ? 'pending' : 'paid';
    const { error } = await supabase
      .from('mold_orders')
      .update({ payment_status: next })
      .eq('id', order.id);
    if (error) {
      toast({ title: 'Error al cambiar pago', variant: 'destructive' });
    } else {
      toast({ title: next === 'paid' ? 'Marcado como pagado' : 'Marcado como no pagado' });
      fetchOrders();
    }
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

  const paymentBadge = (ps: OrderPaymentStatus) => {
    switch (ps) {
      case 'pending':
        return <Badge variant="outline">No pagado</Badge>;
      case 'paid':
        return <Badge className="bg-green-500 hover:bg-green-600">Pagado</Badge>;
    }
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
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16">
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
                const total = order.product_price * qty;
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
                    <TableCell className="text-right">{formatCurrency(order.product_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(total)}</TableCell>
                    <TableCell className="text-center">{statusBadge(order.status)}</TableCell>
                    <TableCell className="text-center">{paymentBadge(order.payment_status)}</TableCell>
                    <TableCell className="text-center text-sm">{formatDate(order.created_at)}</TableCell>
                    <TableCell className="text-center">
                      {canWhatsApp ? (
                        <a
                          href={buildWhatsAppUrl(student!.phone!, whatsAppMsg)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-green-600 hover:text-green-700"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span className="text-xs">Avisar</span>
                          </Button>
                        </a>
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
                          title={order.payment_status === 'paid' ? 'Marcar no pagado' : 'Marcar pagado'}
                          onClick={() => handleTogglePayment(order)}
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

            {/* Total calculado */}
            {formProductPrice && formQuantity && (
              <p className="text-sm text-muted-foreground -mt-2">
                Total:{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency((parseFloat(formProductPrice) || 0) * (parseInt(formQuantity) || 1))}
                </span>
              </p>
            )}

            {/* Estado + Pago */}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label>Pago</Label>
                <Select value={formPaymentStatus} onValueChange={(v) => setFormPaymentStatus(v as OrderPaymentStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">No pagado</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

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
    </div>
  );
}
