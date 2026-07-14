import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { escapeHtml } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/format';
import { InventoryItem, Student, Sale, SaleItem, PaymentMethod, PaymentStatus, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PRODUCT_CATEGORY_LABELS, ProductCategory as DBProductCategory, MONTH_NAMES } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Trash2, ShoppingCart, Printer, Loader2, Search, History, TrendingUp, CalendarDays, DollarSign, Pencil, Upload, FileText, ExternalLink, UserSquare, MessageCircle, Banknote, ArrowRightLeft, CreditCard, Smartphone, QrCode, Receipt, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { whatsAppChatUrl } from '@/lib/whatsapp';
import { QRCodeSVG } from 'qrcode.react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PricingConfig,
  PricingProduct,
  calculateCustomerPiecePrice,
  extractPricingProductId,
} from '@/lib/pricing';
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

// Categorías de productos en ventas
type ProductCategory = 'all' | 'insumos' | 'servicios' | 'moldes' | 'bizcochado' | 'final' | 'cuota';

interface CartItem {
  inventory: InventoryItem;
  quantity: number;
  isCustomerPiece: boolean;
  customerPiecePrice: number | null;
  // Solo presentes en items de categoría 'cuota': cada línea es independiente
  // (no se fusiona con otras) y representa la cuota de un alumno/mes puntual.
  cartItemId?: string;
  cuotaStudentId?: string;
  cuotaMonth?: string; // formato YYYY-MM
}

interface SaleWithItems extends Sale {
  sale_items?: (SaleItem & { inventory: InventoryItem })[];
}

export default function SalesModule() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory>('all');
  const [salesHistory, setSalesHistory] = useState<SaleWithItems[]>([]);
  const [salesTab, setSalesTab] = useState('new');
  const [historySearch, setHistorySearch] = useState('');
  const [filterMonth, setFilterMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'total' | 'partial'>('total');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [editPaymentSale, setEditPaymentSale] = useState<SaleWithItems | null>(null);
  const [editPaymentType, setEditPaymentType] = useState<'total' | 'partial'>('total');
  const [editPartialAmount, setEditPartialAmount] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingSale, setPendingSale] = useState<{sale: Sale, items: CartItem[]} | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptSaleData, setReceiptSaleData] = useState<{sale: Sale, items: CartItem[], paidAmount: number} | null>(null);
  const [historyReceiptSale, setHistoryReceiptSale] = useState<SaleWithItems | null>(null);
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);
  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSaleId, setUploadingSaleId] = useState<string | null>(null);
  const [studentComboOpen, setStudentComboOpen] = useState(false);

  // Modal para agregar una "Cuota Mensual" al carrito (requiere alumno + mes)
  const [cuotaPickerOpen, setCuotaPickerOpen] = useState(false);
  const [cuotaPickerItem, setCuotaPickerItem] = useState<InventoryItem | null>(null);
  const [cuotaPickerStudent, setCuotaPickerStudent] = useState<string>('');
  const [cuotaPickerMonth, setCuotaPickerMonth] = useState<string>('');
  const [cuotaPickerComboOpen, setCuotaPickerComboOpen] = useState(false);

  // Cuotas ya pagadas (student_id|month), para evitar cobrarlas dos veces desde Ventas
  const [paidCuotas, setPaidCuotas] = useState<Set<string>>(new Set());

  // Recargo global (cargado desde app_settings)
  const [recargo, setRecargo] = useState<number>(1);

  // Estado del flujo "Cobrar con Point"
  const [pointWaiting, setPointWaiting] = useState(false);
  const [pointSaleId, setPointSaleId] = useState<string | null>(null);
  const [pointError, setPointError] = useState<string | null>(null);
  const pointChannelRef = useRef<(() => void) | null>(null);
  const pointTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estado del flujo "Cobrar con QR"
  const [qrWaiting, setQrWaiting] = useState(false);
  const [qrSaleId, setQrSaleId] = useState<string | null>(null);
  const [qrOrderId, setQrOrderId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrChannelRef = useRef<(() => void) | null>(null);
  const qrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qrPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estado del flujo "Cobrar con Transferencia"
  const [transferWaiting, setTransferWaiting] = useState(false);
  const [transferSaleId, setTransferSaleId] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [mpAlias, setMpAlias] = useState<string>('');
  const transferChannelRef = useRef<(() => void) | null>(null);
  const transferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transferPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Facturación diaria
  const [uninvoicedSales, setUninvoicedSales] = useState<SaleWithItems[]>([]);
  const [loadingUninvoiced, setLoadingUninvoiced] = useState(false);
  const [markingInvoiced, setMarkingInvoiced] = useState(false);

  // Datos de pricing para recalcular precio cuando "pieza del cliente" está activo
  const [pricingConfig, setPricingConfig] = useState<PricingConfig | null>(null);
  const [pricingProducts, setPricingProducts] = useState<Map<string, PricingProduct>>(new Map());

  const handleUploadReceipt = async (saleId: string, file: File) => {
    setUploadingSaleId(saleId);
    const fileExt = file.name.split('.').pop();
    const filePath = `sales/${saleId}/comprobante.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({
        title: 'Error',
        description: 'No se pudo subir el comprobante',
        variant: 'destructive',
      });
      setUploadingSaleId(null);
      return;
    }

    const { error: updateError } = await supabase
      .from('sales')
      .update({ receipt_url: filePath })
      .eq('id', saleId);

    if (updateError) {
      toast({
        title: 'Error',
        description: 'Comprobante subido pero no se pudo guardar la referencia',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Comprobante cargado correctamente' });
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
    }
    setUploadingSaleId(null);
  };

  const viewReceipt = async (receiptUrl: string) => {
    const { data, error } = await supabase.storage
      .from('receipts')
      .createSignedUrl(receiptUrl, 3600);
    if (error || !data) {
      toast({
        title: 'Error',
        description: 'No se pudo obtener el comprobante',
        variant: 'destructive',
      });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // Get available years for filter (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  const monthNames = [
    { value: 'all', label: 'Todos' },
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  const fetchSalesHistory = async () => {
    const { data } = await supabase
      .from('sales')
      .select('*, student:students(*), sale_items(*, inventory:inventory(*))')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setSalesHistory(data as SaleWithItems[]);
    }
  };

  const fetchPaidCuotas = async () => {
    const { data } = await supabase
      .from('payments')
      .select('student_id, month')
      .eq('status', 'paid');

    if (data) {
      setPaidCuotas(new Set(data.map(p => `${p.student_id}|${p.month}`)));
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const [invRes, studRes, pricingProductsRes, pricingConfigRes, recargoRes, aliasRes] = await Promise.all([
        supabase.from('inventory').select('*').order('name'),
        supabase.from('students').select('*').order('last_name'),
        user
          ? supabase.from('pricing_products').select('*').eq('user_id', user.id)
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('pricing_config').select('*').eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from('app_settings').select('value').eq('key', 'recargo_percent').single(),
        supabase.from('app_settings').select('value').eq('key', 'mp_alias').single(),
      ]);

      if (invRes.data) setInventory(invRes.data as InventoryItem[]);
      if (studRes.data) {
        const sortedStudents = [...(studRes.data as Student[])].sort((a, b) =>
          `${a.first_name} ${a.last_name}`.toLowerCase().localeCompare(`${b.first_name} ${b.last_name}`.toLowerCase(), 'es')
        );
        setStudents(sortedStudents);
      }
      if (recargoRes.data) setRecargo(parseFloat(recargoRes.data.value) || 0);
      if (aliasRes.data) setMpAlias(aliasRes.data.value);
      await fetchPaidCuotas();

      if (pricingProductsRes.data) {
        const map = new Map<string, PricingProduct>();
        for (const p of pricingProductsRes.data) {
          map.set(p.id, {
            id: p.id,
            nombre: p.nombre,
            categoria: p.categoria,
            pesoGramos: Number(p.peso_gramos),
            costoManoObra: Number(p.costo_mano_obra),
            margen: Number(p.margen),
            image_url: p.image_url,
            costoHorneado1: Number(p.costo_horneado1),
            margenBizcochado: Number(p.margen_bizcochado),
            costoEsmaltado: Number(p.costo_esmaltado),
            costoHorneado2: Number(p.costo_horneado2),
            margenFinal: Number(p.margen_final),
          });
        }
        setPricingProducts(map);
      }

      if (pricingConfigRes.data) {
        const cfg = pricingConfigRes.data;
        setPricingConfig({
          precioBarbotina: Number(cfg.precio_barbotina),
          pesoBidon: Number(cfg.peso_bidon),
          margenDefault: Number(cfg.margen_default),
          costoManoObraDefault: Number(cfg.costo_mano_obra_default),
          costoHorneadoDefault: Number(cfg.costo_horneado_default),
          costoEsmaltadoDefault: Number(cfg.costo_esmaltado_default),
          precioEsmalteKg: Number(cfg.precio_esmalte_kg),
          porcentajeEsmalte: Number(cfg.porcentaje_esmalte),
        });
      }

      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Categorías donde aplica el toggle "pieza del cliente"
  const CUSTOMER_PIECE_CATEGORIES = new Set(['bizcochado', 'final']);

  // Dado un item del carrito, calcula su precio unitario efectivo
  const getEffectivePrice = (item: CartItem): number =>
    item.isCustomerPiece && item.customerPiecePrice !== null
      ? item.customerPiecePrice
      : item.inventory.price;

  // Recalcula el precio "pieza del cliente" para un item de inventario.
  // Retorna null si no puede resolverse (falta producto de pricing o config).
  const computeCustomerPiecePrice = (inv: InventoryItem): number | null => {
    if (!pricingConfig) return null;
    if (!CUSTOMER_PIECE_CATEGORIES.has(inv.category ?? '')) return null;
    const productId = extractPricingProductId(inv.description);
    if (!productId) return null;
    const product = pricingProducts.get(productId);
    if (!product) return null;
    const targetStage = inv.category === 'final' ? 'final' : 'bizcochado';
    return calculateCustomerPiecePrice({ product, config: pricingConfig, targetStage });
  };

  const toggleCustomerPiece = (itemId: string) => {
    setCart(prev => prev.map(c => {
      if (c.inventory.id !== itemId) return c;
      if (c.isCustomerPiece) {
        return { ...c, isCustomerPiece: false };
      }
      const price = c.customerPiecePrice ?? computeCustomerPiecePrice(c.inventory);
      if (price === null) {
        toast({
          title: 'No se puede calcular',
          description: 'Falta información del producto o de la configuración de costos.',
          variant: 'destructive',
        });
        return c;
      }
      return { ...c, isCustomerPiece: true, customerPiecePrice: price };
    }));
  };

  // Identificador único de una línea del carrito: las cuotas tienen su propio
  // cartItemId (cada una es independiente), el resto se identifica por inventory.id
  const getCartKey = (item: CartItem): string => item.cartItemId ?? item.inventory.id;

  // Mes actual en formato YYYY-MM
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Opciones de mes para el selector de cuota: 2 meses atrás a 3 meses adelante
  const cuotaMonthOptions = (() => {
    const now = new Date();
    const options: { value: string; label: string }[] = [];
    for (let offset = -2; offset <= 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[String(d.getMonth() + 1).padStart(2, '0')]} ${d.getFullYear()}`;
      options.push({ value, label });
    }
    return options;
  })();

  const studentName = (studentId?: string | null) => {
    const s = students.find(s => s.id === studentId);
    return s ? `${s.first_name} ${s.last_name}` : 'Alumno no encontrado';
  };

  const isCuotaPaid = (studentId: string, month: string) => paidCuotas.has(`${studentId}|${month}`);

  const warnCuotaPaid = (studentId: string, month: string) => {
    toast({
      title: 'Cuota ya pagada',
      description: `La cuota de ${MONTH_NAMES[month.split('-')[1]]} ${month.split('-')[0]} de ${studentName(studentId)} ya está pagada`,
      variant: 'destructive',
    });
  };

  const addCuotaToCart = (item: InventoryItem, studentId: string, month: string) => {
    setCart(prev => [...prev, {
      inventory: item,
      quantity: 1,
      isCustomerPiece: false,
      customerPiecePrice: null,
      cartItemId: crypto.randomUUID(),
      cuotaStudentId: studentId,
      cuotaMonth: month,
    }]);
  };

  const addToCart = (item: InventoryItem) => {
    if (item.category === 'cuota') {
      const month = getCurrentMonth();
      if (selectedStudent) {
        if (isCuotaPaid(selectedStudent, month)) {
          warnCuotaPaid(selectedStudent, month);
          return;
        }
        addCuotaToCart(item, selectedStudent, month);
        return;
      }
      setCuotaPickerItem(item);
      setCuotaPickerStudent('');
      setCuotaPickerMonth(month);
      setCuotaPickerOpen(true);
      return;
    }

    const existing = cart.find(c => c.inventory.id === item.id);
    if (existing) {
      if (existing.quantity >= item.quantity) {
        toast({
          title: 'Stock insuficiente',
          description: `Solo hay ${item.quantity} ${item.unit} disponibles`,
          variant: 'destructive',
        });
        return;
      }
      setCart(cart.map(c =>
        c.inventory.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { inventory: item, quantity: 1, isCustomerPiece: false, customerPiecePrice: null }]);
    }
  };

  const confirmAddCuota = () => {
    if (!cuotaPickerItem || !cuotaPickerStudent || !cuotaPickerMonth) {
      toast({
        title: 'Datos incompletos',
        description: 'Seleccioná un alumno y un mes',
        variant: 'destructive',
      });
      return;
    }
    if (isCuotaPaid(cuotaPickerStudent, cuotaPickerMonth)) {
      warnCuotaPaid(cuotaPickerStudent, cuotaPickerMonth);
      return;
    }
    addCuotaToCart(cuotaPickerItem, cuotaPickerStudent, cuotaPickerMonth);
    if (!selectedStudent) setSelectedStudent(cuotaPickerStudent);
    setCuotaPickerOpen(false);
    setCuotaPickerItem(null);
    setCuotaPickerStudent('');
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (getCartKey(c) === itemId) {
          if (c.cartItemId) return c; // las cuotas no cambian de cantidad
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > c.inventory.quantity) {
            toast({
              title: 'Stock insuficiente',
              variant: 'destructive',
            });
            return c;
          }
          return { ...c, quantity: newQty };
        }
        return c;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => getCartKey(c) !== itemId));
  };

  // Verifica que toda línea de cuota tenga alumno y mes asignados antes de cobrar
  const validateCuotaCart = (): boolean => {
    const invalid = cart.find(c => c.cartItemId && (!c.cuotaStudentId || !c.cuotaMonth));
    if (invalid) {
      toast({
        title: 'Falta alumno o mes',
        description: 'Cada cuota mensual debe tener un alumno y un mes asignado',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const subtotal = cart.reduce((sum, c) => sum + getEffectivePrice(c) * c.quantity, 0);
  const recargoAmount = Math.round(subtotal * recargo / 100);
  const total = subtotal + recargoAmount;

  const handleSale = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Carrito vacío',
        description: 'Agrega productos al carrito',
        variant: 'destructive',
      });
      return;
    }

    if (!validateCuotaCart()) return;

    setLoading(true);

    const { sale: saleData, error: saleError } = await createPendingSale({
      studentId: selectedStudent || null,
      totalAmount: total,
      paymentMethod,
      items: cart.map(c => ({
        inventory_id: c.inventory.id,
        quantity: c.quantity,
        unit_price: getEffectivePrice(c),
        is_customer_piece: c.isCustomerPiece,
        cuota_student_id: c.cuotaStudentId ?? null,
        cuota_month: c.cuotaMonth ?? null,
      })),
    });

    if (!saleData) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar la venta',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const itemsError = saleError;

    if (itemsError) {
      toast({
        title: 'Error',
        description: 'Error al guardar los items',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Venta registrada',
        description: `Total: ${formatCurrency(total)}. Ahora registra el pago.`,
      });

      // Mostrar modal de pago primero
      setPendingSale({ sale: saleData as Sale, items: [...cart] });
      setShowPaymentModal(true);
      setPaymentType('total');
      setPartialAmount('');

      // Refresh inventory and sales history
      const { data: newInv } = await supabase.from('inventory').select('*').order('name');
      if (newInv) setInventory(newInv as InventoryItem[]);

      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);

      setCart([]);
      setSelectedStudent('');
    }

    setLoading(false);
  };

  const printReceipt = () => {
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Recibo - Silicer</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
                h1 { text-align: center; color: #5C329E; font-size: 24px; margin-bottom: 5px; }
                .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                th, td { text-align: left; padding: 8px 4px; border-bottom: 1px solid #eee; }
                .total { font-weight: bold; font-size: 18px; text-align: right; margin-top: 15px; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  // Register payment for a sale (from payment modal after sale)
  const handleRegisterPayment = async () => {
    if (!pendingSale) return;

    const paidAmount = paymentType === 'total'
      ? pendingSale.sale.total_amount
      : parseFloat(partialAmount) || 0;

    if (paymentType === 'partial' && (paidAmount <= 0 || paidAmount >= pendingSale.sale.total_amount)) {
      toast({
        title: 'Monto inválido',
        description: 'El pago parcial debe ser mayor a 0 y menor al total',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await registerSalePayment(pendingSale.sale.id, {
      type: paymentType,
      amount: paidAmount,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar el pago',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Pago registrado',
        description: paymentType === 'total'
          ? `Pago total de ${formatCurrency(paidAmount)} registrado`
          : `Pago parcial de ${formatCurrency(paidAmount)} registrado`,
      });

      // Cerrar modal de pago y mostrar recibo
      setShowPaymentModal(false);
      setReceiptSaleData({
        sale: pendingSale.sale,
        items: pendingSale.items,
        paidAmount: paidAmount,
      });
      setShowReceiptModal(true);
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
      setPaymentType('total');
      setPartialAmount('');
    }
  };

  // Edit payment from history
  const handleEditPayment = async () => {
    if (!editPaymentSale) return;

    const paidAmount = editPaymentType === 'total'
      ? editPaymentSale.total_amount
      : parseFloat(editPartialAmount) || 0;

    if (editPaymentType === 'partial' && (paidAmount <= 0 || paidAmount >= editPaymentSale.total_amount)) {
      toast({
        title: 'Monto inválido',
        description: 'El pago parcial debe ser mayor a 0 y menor al total',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await registerSalePayment(editPaymentSale.id, {
      type: editPaymentType,
      amount: paidAmount,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el pago',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Pago actualizado',
        description: editPaymentType === 'total'
          ? `Pago total de ${formatCurrency(paidAmount)} registrado`
          : `Pago parcial de ${formatCurrency(paidAmount)} registrado`,
      });
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
      setEditPaymentSale(null);
      setEditPaymentType('total');
      setEditPartialAmount('');
    }
  };

  // Get payment status badge color
  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500 hover:bg-green-600">Pagado</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Parcial</Badge>;
      case 'pending':
      default:
        return <Badge variant="destructive">Pendiente</Badge>;
    }
  };

  // Delete sale
  const handleDeleteSale = async (saleId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta venta? Esta acción no se puede deshacer.')) {
      return;
    }

    // First delete sale_items (foreign key constraint)
    const { error: itemsError } = await supabase
      .from('sale_items')
      .delete()
      .eq('sale_id', saleId);

    if (itemsError) {
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar los items de la venta',
        variant: 'destructive',
      });
      return;
    }

    // Then delete the sale
    const { error: saleError } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (saleError) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la venta',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Venta eliminada correctamente' });
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
    }
  };

  // Facturación diaria
  const fetchUninvoicedSales = async () => {
    setLoadingUninvoiced(true);
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const { data } = await supabase
      .from('sales')
      .select('*, student:students(*), sale_items(*, inventory:inventory(*))')
      .is('invoiced_at', null)
      .eq('payment_status', 'paid')
      .not('payment_method', 'in', '(cash,transfer)')
      .gte('created_at', startOfDay)
      .lt('created_at', endOfDay)
      .order('created_at', { ascending: false });

    if (data) setUninvoicedSales(data as SaleWithItems[]);
    setLoadingUninvoiced(false);
  };

  const handleMarkLoteInvoiced = async () => {
    if (uninvoicedSales.length === 0) return;
    setMarkingInvoiced(true);
    const ids = uninvoicedSales.map(s => s.id);
    const { error } = await supabase
      .from('sales')
      .update({ invoiced_at: new Date().toISOString() })
      .in('id', ids);
    if (error) {
      toast({ title: 'Error al marcar el lote', variant: 'destructive' });
    } else {
      toast({ title: `${ids.length} venta${ids.length !== 1 ? 's' : ''} marcada${ids.length !== 1 ? 's' : ''} como facturada${ids.length !== 1 ? 's' : ''}` });
      await fetchUninvoicedSales();
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
    }
    setMarkingInvoiced(false);
  };

  const handleMarkOneInvoiced = async (saleId: string) => {
    const { error } = await supabase
      .from('sales')
      .update({ invoiced_at: new Date().toISOString() })
      .eq('id', saleId);
    if (error) {
      toast({ title: 'Error al facturar', variant: 'destructive' });
    } else {
      toast({ title: 'Venta marcada como facturada' });
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
      if (salesTab === 'invoicing') await fetchUninvoicedSales();
    }
  };

  // Flujo "Cobrar con Point" — Mercado Pago
  const cancelPointPayment = async () => {
    if (pointChannelRef.current) {
      pointChannelRef.current();
      pointChannelRef.current = null;
    }
    if (pointTimeoutRef.current) {
      clearTimeout(pointTimeoutRef.current);
      pointTimeoutRef.current = null;
    }
    if (pointPollRef.current) {
      clearInterval(pointPollRef.current);
      pointPollRef.current = null;
    }
    if (pointSaleId) {
      await deletePendingSale(pointSaleId);
    }
    setPointWaiting(false);
    setPointSaleId(null);
    setPointError(null);
    const { data: newInv } = await supabase.from('inventory').select('*').order('name');
    if (newInv) setInventory(newInv as InventoryItem[]);
  };

  const handlePointSale = async () => {
    if (cart.length === 0) {
      toast({ title: 'Carrito vacío', description: 'Agregá productos al carrito', variant: 'destructive' });
      return;
    }

    if (!validateCuotaCart()) return;

    setLoading(true);

    const { sale: saleData, error: saleError } = await createPendingSale({
      studentId: selectedStudent || null,
      totalAmount: total,
      paymentMethod: 'mercadopago',
      items: cart.map(c => ({
        inventory_id: c.inventory.id,
        quantity: c.quantity,
        unit_price: getEffectivePrice(c),
        is_customer_piece: c.isCustomerPiece,
        cuota_student_id: c.cuotaStudentId ?? null,
        cuota_month: c.cuotaMonth ?? null,
      })),
    });

    if (!saleData) {
      toast({ title: 'Error al registrar la venta', variant: 'destructive' });
      setLoading(false);
      return;
    }
    void saleError;

    const { data: newInv } = await supabase.from('inventory').select('*').order('name');
    if (newInv) setInventory(newInv as InventoryItem[]);

    setLoading(false);
    setPointSaleId(saleData.id);
    setPointError(null);
    setPointWaiting(true);

    // Suscripción Realtime: escucha cuando el webhook confirme el pago
    const unsubscribe = subscribeToSalePayment(saleData.id, async () => {
      if (pointTimeoutRef.current) clearTimeout(pointTimeoutRef.current);
      if (pointPollRef.current) clearInterval(pointPollRef.current);
      pointPollRef.current = null;
      pointChannelRef.current?.();
      pointChannelRef.current = null;
      setPointWaiting(false);
      setPointSaleId(null);
      toast({ title: '¡Pago confirmado!', description: `Total cobrado: ${formatCurrency(total)}` });
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
      setCart([]);
      setSelectedStudent('');
    });

    pointChannelRef.current = unsubscribe;

    // Timeout de 5 minutos
    pointTimeoutRef.current = setTimeout(() => {
      setPointError('El pago no fue confirmado en 5 minutos. Podés cancelar o seguir esperando.');
    }, 5 * 60 * 1000);

    // Enviar la orden al Point Smart vía Edge Function
    try {
      const { error: fnError } = await invokeMpPointCharge(saleData.id, total);
      if (fnError) {
        setPointError('No se pudo enviar la orden al Point. Verificá la configuración de Mercado Pago.');
      }
    } catch {
      setPointError('Error de conexión con Mercado Pago.');
    }

    // Mercado Pago no entrega webhooks de forma confiable para Point en esta cuenta,
    // así que se consulta el estado del pago periódicamente como respaldo.
    pointPollRef.current = setInterval(() => {
      checkMpPointStatus(saleData.id);
    }, 4000);
  };

  // Flujo "Cobrar con QR" — Mercado Pago (orden híbrida vía Orders API)
  const cancelQrSale = async () => {
    if (qrChannelRef.current) {
      qrChannelRef.current();
      qrChannelRef.current = null;
    }
    if (qrTimeoutRef.current) {
      clearTimeout(qrTimeoutRef.current);
      qrTimeoutRef.current = null;
    }
    if (qrPollRef.current) {
      clearInterval(qrPollRef.current);
      qrPollRef.current = null;
    }
    if (qrSaleId) {
      await deletePendingSale(qrSaleId);
    }
    setQrWaiting(false);
    setQrSaleId(null);
    setQrOrderId(null);
    setQrData(null);
    setQrError(null);
    const { data: newInv } = await supabase.from('inventory').select('*').order('name');
    if (newInv) setInventory(newInv as InventoryItem[]);
  };

  const handleQrSale = async () => {
    if (cart.length === 0) {
      toast({ title: 'Carrito vacío', description: 'Agregá productos al carrito', variant: 'destructive' });
      return;
    }

    if (!validateCuotaCart()) return;

    setLoading(true);

    const { sale: saleData, error: saleError } = await createPendingSale({
      studentId: selectedStudent || null,
      totalAmount: total,
      paymentMethod: 'mercadopago',
      items: cart.map(c => ({
        inventory_id: c.inventory.id,
        quantity: c.quantity,
        unit_price: getEffectivePrice(c),
        is_customer_piece: c.isCustomerPiece,
        cuota_student_id: c.cuotaStudentId ?? null,
        cuota_month: c.cuotaMonth ?? null,
      })),
    });

    if (!saleData) {
      toast({ title: 'Error al registrar la venta', variant: 'destructive' });
      setLoading(false);
      return;
    }
    void saleError;

    const { data: newInv } = await supabase.from('inventory').select('*').order('name');
    if (newInv) setInventory(newInv as InventoryItem[]);

    setLoading(false);
    setQrSaleId(saleData.id);
    setQrOrderId(null);
    setQrData(null);
    setQrError(null);
    setQrWaiting(true);

    // Suscripción Realtime: escucha cuando se confirme el pago
    const unsubscribe = subscribeToSalePayment(saleData.id, async () => {
      if (qrTimeoutRef.current) clearTimeout(qrTimeoutRef.current);
      if (qrPollRef.current) clearInterval(qrPollRef.current);
      qrPollRef.current = null;
      qrChannelRef.current?.();
      qrChannelRef.current = null;
      setQrWaiting(false);
      setQrSaleId(null);
      setQrOrderId(null);
      setQrData(null);
      toast({ title: '¡Pago confirmado!', description: `Total cobrado: ${formatCurrency(total)}` });
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
      setCart([]);
      setSelectedStudent('');
    });

    qrChannelRef.current = unsubscribe;

    // Timeout de 5 minutos
    qrTimeoutRef.current = setTimeout(() => {
      setQrError('El pago no fue confirmado en 5 minutos. Podés cancelar o seguir esperando.');
    }, 5 * 60 * 1000);

    // Crear la orden QR híbrida (QR estático de la caja + QR dinámico)
    let orderId: string | null = null;
    try {
      const { data: fnData, error: fnError } = await invokeMpQrCharge(saleData.id, total);
      if (fnError || !fnData?.success) {
        setQrError('No se pudo generar el código QR. Verificá la configuración de Mercado Pago.');
      } else {
        orderId = fnData.order_id;
        setQrOrderId(fnData.order_id);
        setQrData(fnData.qr_data ?? null);
      }
    } catch {
      setQrError('Error de conexión con Mercado Pago.');
    }

    if (!orderId) return;

    // Polling de respaldo: consulta el estado de la orden cada 4s
    qrPollRef.current = setInterval(() => {
      checkMpQrStatus(saleData.id, orderId as string);
    }, 4000);
  };

  // Flujo "Cobrar con Transferencia" — detecta la transferencia entrante en la cuenta de MP
  const cancelTransferSale = async () => {
    if (transferChannelRef.current) {
      transferChannelRef.current();
      transferChannelRef.current = null;
    }
    if (transferTimeoutRef.current) {
      clearTimeout(transferTimeoutRef.current);
      transferTimeoutRef.current = null;
    }
    if (transferPollRef.current) {
      clearInterval(transferPollRef.current);
      transferPollRef.current = null;
    }
    if (transferSaleId) {
      await deletePendingSale(transferSaleId);
    }
    setTransferWaiting(false);
    setTransferSaleId(null);
    setTransferError(null);
    const { data: newInv } = await supabase.from('inventory').select('*').order('name');
    if (newInv) setInventory(newInv as InventoryItem[]);
  };

  const handleTransferSale = async () => {
    if (cart.length === 0) {
      toast({ title: 'Carrito vacío', description: 'Agregá productos al carrito', variant: 'destructive' });
      return;
    }

    if (!validateCuotaCart()) return;

    setLoading(true);

    const { sale: saleData, error: saleError } = await createPendingSale({
      studentId: selectedStudent || null,
      totalAmount: total,
      paymentMethod: 'transfer',
      items: cart.map(c => ({
        inventory_id: c.inventory.id,
        quantity: c.quantity,
        unit_price: getEffectivePrice(c),
        is_customer_piece: c.isCustomerPiece,
        cuota_student_id: c.cuotaStudentId ?? null,
        cuota_month: c.cuotaMonth ?? null,
      })),
    });

    if (!saleData) {
      toast({ title: 'Error al registrar la venta', variant: 'destructive' });
      setLoading(false);
      return;
    }
    void saleError;

    const { data: newInv } = await supabase.from('inventory').select('*').order('name');
    if (newInv) setInventory(newInv as InventoryItem[]);

    setLoading(false);
    setTransferSaleId(saleData.id);
    setTransferError(null);
    setTransferWaiting(true);

    // Suscripción Realtime: escucha cuando se confirme el pago
    const unsubscribe = subscribeToSalePayment(saleData.id, async () => {
      if (transferTimeoutRef.current) clearTimeout(transferTimeoutRef.current);
      if (transferPollRef.current) clearInterval(transferPollRef.current);
      transferPollRef.current = null;
      transferChannelRef.current?.();
      transferChannelRef.current = null;
      setTransferWaiting(false);
      setTransferSaleId(null);
      toast({ title: '¡Pago confirmado!', description: `Total cobrado: ${formatCurrency(total)}` });
      await Promise.all([fetchSalesHistory(), fetchPaidCuotas()]);
      setCart([]);
      setSelectedStudent('');
    });

    transferChannelRef.current = unsubscribe;

    // Timeout de 5 minutos
    transferTimeoutRef.current = setTimeout(() => {
      setTransferError('La transferencia no fue detectada en 5 minutos. Podés cancelar o seguir esperando.');
    }, 5 * 60 * 1000);

    // Polling: busca una transferencia entrante con el mismo monto
    transferPollRef.current = setInterval(() => {
      checkMpTransferStatus(saleData.id);
    }, 4000);
  };

  // Cargar ventas sin facturar al cambiar a la tab de facturación
  useEffect(() => {
    if (salesTab === 'invoicing') {
      fetchUninvoicedSales();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesTab]);

  // Productos disponibles para venta
  const allProducts = inventory.filter(item =>
    item.for_sale && (item.category === 'cuota' || item.quantity > 0)
  );

  // Filtrar por búsqueda y categoría
  const filteredProducts = allProducts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });


  // Filtrar historial de ventas
  const filteredSalesHistory = salesHistory.filter(sale => {
    // Filter by date
    if (filterYear || filterMonth) {
      const saleDate = new Date(sale.created_at);
      if (filterYear && saleDate.getFullYear() !== parseInt(filterYear)) {
        return false;
      }
      if (filterMonth && filterMonth !== 'all' && (saleDate.getMonth() + 1) !== parseInt(filterMonth)) {
        return false;
      }
    }

    // Filter by payment status
    if (filterPaymentStatus && sale.payment_status !== filterPaymentStatus) {
      return false;
    }

    // Filter by search
    if (historySearch) {
      const searchLower = historySearch.toLowerCase();
      const studentName = sale.student ? `${sale.student.first_name} ${sale.student.last_name}`.toLowerCase() : '';
      const products = sale.sale_items?.map(item => item.inventory?.name?.toLowerCase() || '').join(' ') || '';
      if (!studentName.includes(searchLower) && !products.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  // Clear date filters
  const clearDateFilters = () => {
    setFilterMonth('all');
    setFilterYear('');
    setFilterPaymentStatus('');
  };

  // Calculate sales statistics (based on filtered data)
  const totalSales = filteredSalesHistory.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalItemsSold = filteredSalesHistory.reduce((sum, sale) =>
    sum + (sale.sale_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
  );

  // Group sales by product (based on filtered data)
  const productSales = filteredSalesHistory.reduce((acc, sale) => {
    sale.sale_items?.forEach(item => {
      const productName = item.inventory?.name || 'Producto eliminado';
      if (!acc[productName]) {
        acc[productName] = { quantity: 0, total: 0 };
      }
      acc[productName].quantity += item.quantity;
      acc[productName].total += item.quantity * item.unit_price;
    });
    return acc;
  }, {} as Record<string, { quantity: number; total: number }>);

  if (loading && inventory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Tabs value={salesTab} onValueChange={setSalesTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="new" className="flex items-center gap-1.5">
          <ShoppingCart className="w-4 h-4" />
          Nueva Venta
        </TabsTrigger>
        <TabsTrigger value="history" className="flex items-center gap-1.5">
          <History className="w-4 h-4" />
          Historial
        </TabsTrigger>
        <TabsTrigger value="stats" className="flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          Resumen
        </TabsTrigger>
        <TabsTrigger value="invoicing" className="flex items-center gap-1.5">
          <Receipt className="w-4 h-4" />
          Facturación
        </TabsTrigger>
      </TabsList>

      <TabsContent value="new">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-1 bg-muted p-1 rounded-lg flex-wrap">
                {([['all', 'Todos'], ['cuota', 'Cuota'], ['insumos', 'Insumos'], ['servicios', 'Servicios'], ['moldes', 'Moldes'], ['bizcochado', 'Bizc.'], ['final', 'Final']] as const).map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={categoryFilter === value ? 'default' : 'ghost'}
                    onClick={() => setCategoryFilter(value)}
                    className="text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredProducts.map(item => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => addToCart(item)}
                >
                  <CardContent className="p-4">
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="w-full h-24 object-contain rounded-md mb-2 bg-muted" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium truncate flex-1">{item.name}</h4>
                      {item.category && ['moldes', 'bizcochado', 'final'].includes(item.category) && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {item.category === 'moldes' ? 'Molde' : item.category === 'bizcochado' ? 'Bizc.' : 'Final'}
                        </Badge>
                      )}
                    </div>
                    {item.category && !['moldes', 'bizcochado', 'final'].includes(item.category) && item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                    )}
                    {item.category === 'cuota' ? (
                      <p className="text-sm text-muted-foreground mt-1">Por alumno y mes</p>
                    ) : item.category && ['moldes', 'bizcochado', 'final'].includes(item.category) ? (
                      <p className="text-sm text-muted-foreground mt-1">Disponible</p>
                    ) : (
                      <div className="mt-1">
                        <p className="text-sm text-muted-foreground">
                          Stock: {item.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Unidad de venta: {item.unit}
                        </p>
                      </div>
                    )}
                    <p className="text-lg font-bold text-primary mt-1">{formatCurrency(item.price)}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredProducts.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  {['moldes', 'bizcochado', 'final'].includes(categoryFilter)
                    ? 'No hay productos. Agrega productos en la Calculadora de Precios y guarda.'
                    : categoryFilter === 'servicios'
                      ? 'No hay servicios disponibles'
                      : 'No hay productos disponibles para venta'}
                </p>
              )}
            </div>
          </div>

          {/* Cart */}
          <Card className="h-fit sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" /> Carrito
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Carrito vacío</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => {
                    const isCuota = !!item.cartItemId;
                    const cartKey = getCartKey(item);
                    const supportsCustomerPiece = !isCuota && CUSTOMER_PIECE_CATEGORIES.has(item.inventory.category ?? '');
                    const customerPiecePreview = supportsCustomerPiece && !item.isCustomerPiece
                      ? (item.customerPiecePrice ?? computeCustomerPiecePrice(item.inventory))
                      : null;
                    const effectivePrice = getEffectivePrice(item);
                    return (
                      <div key={cartKey} className="flex flex-col gap-2 p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">
                              {isCuota
                                ? `${item.inventory.name} — ${studentName(item.cuotaStudentId)}`
                                : item.inventory.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {isCuota ? (
                                <>
                                  {formatCurrency(effectivePrice)}
                                  {' · '}
                                  {MONTH_NAMES[item.cuotaMonth!.split('-')[1]]} {item.cuotaMonth!.split('-')[0]}
                                </>
                              ) : item.isCustomerPiece ? (
                                <>
                                  <span className="line-through mr-1 opacity-70">{formatCurrency(item.inventory.price)}</span>
                                  <span className="font-medium text-foreground">{formatCurrency(effectivePrice)}</span>
                                  {' '}x {item.quantity}
                                </>
                              ) : (
                                <>{formatCurrency(effectivePrice)} x {item.quantity}</>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {!isCuota && (
                              <>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(cartKey, -1)}>
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-6 text-center text-sm">{item.quantity}</span>
                                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(cartKey, 1)}>
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            <Button size="icon" variant="destructive" className="h-7 w-7 ml-1" onClick={() => removeFromCart(cartKey)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {supportsCustomerPiece && (
                          <label
                            className={`flex items-center gap-2 text-xs ${customerPiecePreview === null && !item.isCustomerPiece ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            title={customerPiecePreview === null && !item.isCustomerPiece ? 'Falta información de pricing para este producto' : ''}
                          >
                            <Checkbox
                              checked={item.isCustomerPiece}
                              disabled={customerPiecePreview === null && !item.isCustomerPiece}
                              onCheckedChange={() => toggleCustomerPiece(item.inventory.id)}
                            />
                            <UserSquare className="w-3 h-3" />
                            <span>Pieza del cliente</span>
                            {customerPiecePreview !== null && !item.isCustomerPiece && (
                              <span className="ml-auto text-muted-foreground">
                                → {formatCurrency(customerPiecePreview)}
                              </span>
                            )}
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label>Alumno (opcional)</Label>
                  <Popover open={studentComboOpen} onOpenChange={setStudentComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={studentComboOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedStudent
                          ? (() => { const s = students.find(s => s.id === selectedStudent); return s ? `${s.first_name} ${s.last_name}` : 'Seleccionar alumno'; })()
                          : 'Seleccionar alumno'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar alumno..." />
                        <CommandList>
                          <CommandEmpty>No se encontró ningún alumno.</CommandEmpty>
                          <CommandGroup>
                            {selectedStudent && (
                              <CommandItem
                                value="__none__"
                                onSelect={() => { setSelectedStudent(''); setStudentComboOpen(false); }}
                              >
                                <Check className="mr-2 h-4 w-4 opacity-0" />
                                Sin alumno
                              </CommandItem>
                            )}
                            {students.map(s => (
                              <CommandItem
                                key={s.id}
                                value={`${s.first_name} ${s.last_name}`}
                                onSelect={() => { setSelectedStudent(s.id); setStudentComboOpen(false); }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${selectedStudent === s.id ? 'opacity-100' : 'opacity-0'}`} />
                                {s.first_name} {s.last_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

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
                        variant={paymentMethod === value ? 'default' : 'outline'}
                        size="sm"
                        className="flex flex-col h-auto py-2 gap-1"
                        onClick={() => setPaymentMethod(value)}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs leading-none">{label}</span>
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant={paymentMethod === 'mercadopago' ? 'default' : 'outline'}
                    size="sm"
                    className={`w-full flex items-center gap-2 transition-colors ${paymentMethod === 'mercadopago' ? 'bg-[#009ee3] hover:bg-[#0082bd] border-[#009ee3] text-white' : 'hover:border-[#009ee3] hover:text-[#009ee3]'}`}
                    onClick={() => setPaymentMethod('mercadopago')}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Mercado Pago — QR</span>
                  </Button>
                </div>

                {/* Desglose de recargo y total */}
                <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Recargo ({recargo}%)</span>
                    <span>{formatCurrency(recargoAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-primary text-lg border-t pt-1.5">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                {paymentMethod === 'mercadopago' ? (
                  <Button
                    className="w-full bg-[#009ee3] hover:bg-[#0082bd] border-[#009ee3] text-white"
                    size="lg"
                    onClick={handleQrSale}
                    disabled={loading || cart.length === 0}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : (
                      <><QrCode className="w-4 h-4 mr-2" /> Cobrar con QR</>
                    )}
                  </Button>
                ) : paymentMethod === 'debit_card' || paymentMethod === 'credit_card' ? (
                  <Button
                    className="w-full bg-[#009ee3] hover:bg-[#0082bd] border-[#009ee3] text-white"
                    size="lg"
                    onClick={handlePointSale}
                    disabled={loading || cart.length === 0}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : (
                      <><Smartphone className="w-4 h-4 mr-2" /> Cobrar con Point</>
                    )}
                  </Button>
                ) : paymentMethod === 'transfer' ? (
                  <Button
                    className="w-full bg-[#009ee3] hover:bg-[#0082bd] border-[#009ee3] text-white"
                    size="lg"
                    onClick={handleTransferSale}
                    disabled={loading || cart.length === 0}
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : (
                      <><ArrowRightLeft className="w-4 h-4 mr-2" /> Cobrar con Transferencia</>
                    )}
                  </Button>
                ) : (
                  <Button className="w-full" size="lg" onClick={handleSale} disabled={loading || cart.length === 0}>
                    {loading ? 'Procesando...' : 'Registrar Venta'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Sales History Tab */}
      <TabsContent value="history">
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por producto o cliente..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[140px]">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPaymentStatus || 'all'} onValueChange={(v) => setFilterPaymentStatus(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-[130px]">
                  <DollarSign className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Pagos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                </SelectContent>
              </Select>
              {((filterMonth && filterMonth !== 'all') || filterYear || filterPaymentStatus) && (
                <Button variant="outline" size="icon" onClick={clearDateFilters}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table className="min-w-[750px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-center">Estado Pago</TableHead>
                  <TableHead className="text-center">Comprobante</TableHead>
                  <TableHead className="text-center">Factura</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSalesHistory.map(sale => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">{formatDate(sale.created_at)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {sale.sale_items?.map(item => (
                          <div key={item.id} className="text-sm font-medium flex items-center gap-1">
                            <span>{item.inventory?.name || 'Producto eliminado'}</span>
                            {item.is_customer_piece && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                                pieza cliente
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {sale.sale_items?.map(item => (
                          <div key={item.id}>
                            {item.inventory?.category ? (
                              <Badge variant="outline" className="text-xs">
                                {PRODUCT_CATEGORY_LABELS[item.inventory.category as DBProductCategory] || item.inventory.category}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-1">
                        {sale.sale_items?.map(item => (
                          <div key={item.id} className="text-sm">
                            {item.quantity}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {sale.student ? (
                        sale.student.phone ? (
                          <a
                            href={whatsAppChatUrl(sale.student.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 hover:underline"
                            title="Abrir chat de WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {sale.student.first_name} {sale.student.last_name}
                          </a>
                        ) : (
                          `${sale.student.first_name} ${sale.student.last_name}`
                        )
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PAYMENT_METHOD_LABELS[sale.payment_method]}</Badge>
                    </TableCell>
                    <TableCell className="align-middle">
                      <button
                        type="button"
                        className="cursor-pointer hover:opacity-70 transition-opacity flex flex-col items-center justify-center w-full"
                        onClick={() => setHistoryReceiptSale(sale)}
                      >
                        {getPaymentStatusBadge(sale.payment_status)}
                        {sale.payment_status === 'partial' && sale.paid_amount && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatCurrency(sale.paid_amount)} de {formatCurrency(sale.total_amount)}
                          </div>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      {sale.receipt_url ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700"
                          aria-label="Ver comprobante"
                          onClick={() => viewReceipt(sale.receipt_url!)}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadReceipt(sale.id, file);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            aria-label="Subir comprobante"
                            disabled={uploadingSaleId === sale.id}
                            asChild
                          >
                            <span>
                              {uploadingSaleId === sale.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                            </span>
                          </Button>
                        </label>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {sale.invoiced_at ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" title={`Facturada el ${formatDate(sale.invoiced_at)}`} />
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-muted-foreground hover:text-primary h-auto p-1"
                          title="Marcar como facturada"
                          onClick={() => handleMarkOneInvoiced(sale.id)}
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(sale.total_amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {sale.payment_status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label="Editar estado de pago"
                            onClick={() => {
                              setEditPaymentSale(sale);
                              setEditPaymentType(sale.payment_status === 'partial' ? 'partial' : 'total');
                              setEditPartialAmount(sale.paid_amount?.toString() || '');
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label="Eliminar venta"
                          onClick={() => handleDeleteSale(sale.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSalesHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No hay ventas registradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </TabsContent>

      {/* Stats Tab */}
      <TabsContent value="stats">
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por producto o cliente..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[140px]">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {((filterMonth && filterMonth !== 'all') || filterYear) && (
                <Button variant="outline" size="icon" onClick={clearDateFilters}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{formatCurrency(totalSales)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Productos Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{totalItemsSold}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Cantidad de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{filteredSalesHistory.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sales by Product - Tabla con mismos conceptos que historial */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Producto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-x-auto">
                <Table className="min-w-[750px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-center">Cant.</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-center">Estado Pago</TableHead>
                      <TableHead className="text-center">Comprobante</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSalesHistory.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-sm">{formatDate(sale.created_at)}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {sale.sale_items?.map(item => (
                              <div key={item.id} className="text-sm font-medium">
                                {item.inventory?.name || 'Producto eliminado'}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {sale.sale_items?.map(item => (
                              <div key={item.id}>
                                {item.inventory?.category ? (
                                  <Badge variant="outline" className="text-xs">
                                    {PRODUCT_CATEGORY_LABELS[item.inventory.category as DBProductCategory] || item.inventory.category}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            {sale.sale_items?.map(item => (
                              <div key={item.id} className="text-sm">
                                {item.quantity}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {sale.student ? (
                            sale.student.phone ? (
                              <a
                                href={whatsAppChatUrl(sale.student.phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 hover:underline"
                                title="Abrir chat de WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {sale.student.first_name} {sale.student.last_name}
                              </a>
                            ) : (
                              `${sale.student.first_name} ${sale.student.last_name}`
                            )
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{PAYMENT_METHOD_LABELS[sale.payment_method]}</Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="cursor-pointer hover:opacity-70 transition-opacity"
                            onClick={() => setHistoryReceiptSale(sale)}
                          >
                            {getPaymentStatusBadge(sale.payment_status)}
                            {sale.payment_status === 'partial' && sale.paid_amount && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {formatCurrency(sale.paid_amount)} de {formatCurrency(sale.total_amount)}
                              </div>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          {sale.receipt_url ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700"
                              aria-label="Ver comprobante"
                              onClick={() => viewReceipt(sale.receipt_url!)}
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                          ) : (
                            <label className="cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleUploadReceipt(sale.id, file);
                                  e.target.value = '';
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground"
                                aria-label="Subir comprobante"
                                disabled={uploadingSaleId === sale.id}
                                asChild
                              >
                                <span>
                                  {uploadingSaleId === sale.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Upload className="w-4 h-4" />
                                  )}
                                </span>
                              </Button>
                            </label>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(sale.total_amount)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label="Eliminar venta"
                            onClick={() => handleDeleteSale(sale.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredSalesHistory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          No hay datos de ventas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* Facturación Tab */}
      <TabsContent value="invoicing">
        <div className="space-y-4">
          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300 flex gap-3 items-start">
            <Receipt className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Facturación manual en AFIP</p>
              <p className="mt-1">Este resumen agrupa las ventas de hoy sin factura emitida. Una vez cargada en AFIP, marcá el lote como facturado.</p>
              <p className="mt-1 font-medium">Tipo de comprobante: Factura C — Consumidor Final</p>
            </div>
          </div>

          {loadingUninvoiced ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-lg border bg-card p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{uninvoicedSales.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Ventas sin facturar hoy</p>
                </div>
                <div className="rounded-lg border bg-card p-4 text-center sm:col-span-2">
                  <p className="text-3xl font-bold text-primary">
                    {formatCurrency(uninvoicedSales.reduce((s, v) => s + v.total_amount, 0))}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Total a consignar en Factura C</p>
                </div>
              </div>

              {uninvoicedSales.length > 0 && (
                <>
                  <div className="rounded-lg border bg-card overflow-x-auto">
                    <Table className="min-w-[500px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hora</TableHead>
                          <TableHead>Productos</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uninvoicedSales.map(sale => (
                          <TableRow key={sale.id}>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(sale.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell className="text-sm">
                              {sale.sale_items?.map(i => i.inventory?.name).filter(Boolean).join(', ') || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {sale.student ? `${sale.student.first_name} ${sale.student.last_name}` : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{PAYMENT_METHOD_LABELS[sale.payment_method]}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(sale.total_amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-1.5">
                    <Button
                      variant="default"
                      className="w-full gap-2"
                      onClick={() => {
                        const amount = uninvoicedSales.reduce((s, v) => s + v.total_amount, 0);
                        navigator.clipboard.writeText(String(Math.round(amount)));
                        window.open('https://auth.afip.gob.ar/contribuyente_/login.xhtml?action=SYSTEM&system=rcel', '_blank', 'noopener,noreferrer');
                        toast({ title: `Monto copiado: ${formatCurrency(amount)}`, description: 'Pegalo en el campo "Importe" dentro de AFIP' });
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ir a Comprobantes en línea (AFIP) y copiar monto
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Se abre Comprobantes en línea (AFIP). Ingresá con CUIT y clave fiscal — el monto ya está copiado en el portapapeles.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    className="w-full"
                    size="lg"
                    onClick={handleMarkLoteInvoiced}
                    disabled={markingInvoiced}
                  >
                    {markingInvoiced ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> Marcar lote como facturado ({uninvoicedSales.length} ventas)</>
                    )}
                  </Button>
                </>
              )}

              {uninvoicedSales.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 text-green-500 opacity-60" />
                  <p className="font-medium">Todo facturado</p>
                  <p className="text-sm">No hay ventas de hoy sin factura emitida.</p>
                </div>
              )}
            </>
          )}
        </div>
      </TabsContent>

      {/* Overlay: Esperando confirmación del Point */}
      <Dialog open={pointWaiting} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-[#009ee3]" />
              Cobrar con Point — {PAYMENT_METHOD_LABELS[paymentMethod]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{formatCurrency(total)}</p>
              <p className="text-sm text-muted-foreground mt-1">Monto enviado al dispositivo</p>
            </div>
            {!pointError ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#009ee3]" />
                <p className="text-sm text-center text-muted-foreground">
                  El Point está listo para cobrar.<br />
                  Esperando que el cliente pague...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <XCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-center text-destructive">{pointError}</p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={cancelPointPayment}
            >
              Cancelar y anular venta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overlay: Cobrar con QR (Mercado Pago) */}
      <Dialog open={qrWaiting} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#009ee3]" />
              Cobrar con QR — Mercado Pago
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{formatCurrency(total)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Escaneá el código con la app de MercadoPago o cualquier billetera, o pagá con tarjeta en el Point
              </p>
            </div>
            {!qrError ? (
              <div className="flex flex-col items-center gap-3 py-2">
                {qrData ? (
                  <div className="p-3 bg-white rounded-md border">
                    <QRCodeSVG value={qrData} size={220} />
                  </div>
                ) : (
                  <Loader2 className="w-8 h-8 animate-spin text-[#009ee3]" />
                )}
                <p className="text-sm text-center text-muted-foreground">
                  Esperando que el cliente pague...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <XCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-center text-destructive">{qrError}</p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={cancelQrSale}
            >
              Cancelar y anular venta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Overlay: Cobrar con Transferencia */}
      <Dialog open={transferWaiting} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#009ee3]" />
              Cobrar con Transferencia
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">{formatCurrency(total)}</p>
              {mpAlias ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Transferí a: <span className="font-semibold text-foreground">{mpAlias}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Pasale tu alias de Mercado Pago al cliente
                </p>
              )}
            </div>
            {!transferError ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#009ee3]" />
                <p className="text-sm text-center text-muted-foreground">
                  Esperando que ingrese la transferencia...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <XCircle className="w-8 h-8 text-destructive" />
                <p className="text-sm text-center text-destructive">{transferError}</p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={cancelTransferSale}
            >
              Cancelar y anular venta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Modal (shows after sale) */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => {
        setShowPaymentModal(open);
        if (!open) {
          setPendingSale(null);
          setPaymentType('total');
          setPartialAmount('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Total de la venta</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(pendingSale?.sale.total_amount || 0)}</p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Tipo de Pago</Label>
              <div className="flex gap-2">
                <Button
                  variant={paymentType === 'total' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPaymentType('total')}
                >
                  Pago Total
                </Button>
                <Button
                  variant={paymentType === 'partial' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPaymentType('partial')}
                >
                  Pago Parcial
                </Button>
              </div>

              {paymentType === 'total' ? (
                <p className="text-sm text-muted-foreground text-center">
                  Se registrará el pago completo de {formatCurrency(pendingSale?.sale.total_amount || 0)}
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="paymentPartialAmount">Monto del pago parcial</Label>
                  <Input
                    id="paymentPartialAmount"
                    type="number"
                    placeholder="Ej: 5000"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total de la venta: {formatCurrency(pendingSale?.sale.total_amount || 0)}
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleRegisterPayment} className="w-full">
              <DollarSign className="w-4 h-4 mr-2" /> Confirmar Pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Modal (shows after payment confirmation) */}
      <Dialog open={showReceiptModal} onOpenChange={(open) => {
        setShowReceiptModal(open);
        if (!open) {
          setReceiptSaleData(null);
          setPendingSale(null);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recibo de Venta</DialogTitle>
          </DialogHeader>

          <div ref={receiptRef} className="flex flex-col items-center justify-center text-center">
            <h1 className="text-2xl font-bold text-primary">Silicer</h1>
            <p className="subtitle text-muted-foreground text-sm mb-4">Taller de Cerámica</p>

            <table className="w-full border-collapse mb-4">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Producto</th>
                  <th className="text-center py-2">Cant.</th>
                  <th className="text-right py-2">Precio</th>
                </tr>
              </thead>
              <tbody>
                {receiptSaleData?.items.map(item => (
                  <tr key={item.inventory.id} className="border-b border-muted">
                    <td className="text-left py-2">{item.inventory.name}</td>
                    <td className="text-center py-2">{item.quantity}</td>
                    <td className="text-right py-2">{formatCurrency(item.inventory.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="total text-xl font-bold text-primary">Total: {formatCurrency(receiptSaleData?.sale.total_amount || 0)}</p>

            {receiptSaleData && receiptSaleData.paidAmount < receiptSaleData.sale.total_amount ? (
              <div className="mt-2 p-2 bg-yellow-100 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Pago Parcial</p>
                <p className="text-sm text-yellow-700">
                  Pagado: {formatCurrency(receiptSaleData.paidAmount)} de {formatCurrency(receiptSaleData.sale.total_amount)}
                </p>
                <p className="text-sm text-yellow-700">
                  Restante: {formatCurrency(receiptSaleData.sale.total_amount - receiptSaleData.paidAmount)}
                </p>
              </div>
            ) : (
              <div className="mt-2 p-2 bg-green-100 rounded-lg">
                <p className="text-sm font-medium text-green-800">Pagado en su totalidad</p>
              </div>
            )}

            <p className="footer text-muted-foreground text-sm mt-4">¡Gracias por tu compra!</p>
          </div>

          <Button onClick={printReceipt} className="w-full" variant="outline">
            <Printer className="w-4 h-4 mr-2" /> Imprimir Recibo
          </Button>
          <input
            ref={receiptFileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && receiptSaleData) {
                handleUploadReceipt(receiptSaleData.sale.id, file);
              }
              e.target.value = '';
            }}
          />
          <Button
            onClick={() => receiptFileInputRef.current?.click()}
            className="w-full"
            variant="outline"
            disabled={uploadingSaleId === receiptSaleData?.sale.id}
          >
            {uploadingSaleId === receiptSaleData?.sale.id ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Cargar Comprobante</>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {/* History Receipt Modal (click on payment status in history) */}
      <Dialog open={!!historyReceiptSale} onOpenChange={(open) => {
        if (!open) setHistoryReceiptSale(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recibo de Venta</DialogTitle>
          </DialogHeader>

          {historyReceiptSale && (
            <div className="flex flex-col items-center justify-center text-center">
              <h1 className="text-2xl font-bold text-primary">Silicer</h1>
              <p className="subtitle text-muted-foreground text-sm mb-4">Taller de Cerámica</p>
              <p className="text-sm text-muted-foreground mb-2">{formatDate(historyReceiptSale.created_at)}</p>

              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Producto</th>
                    <th className="text-center py-2">Cant.</th>
                    <th className="text-right py-2">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {historyReceiptSale.sale_items?.map(item => (
                    <tr key={item.id} className="border-b border-muted">
                      <td className="text-left py-2">{item.inventory?.name || 'Producto eliminado'}</td>
                      <td className="text-center py-2">{item.quantity}</td>
                      <td className="text-right py-2">{formatCurrency(item.unit_price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="total text-xl font-bold text-primary">Total: {formatCurrency(historyReceiptSale.total_amount)}</p>

              {historyReceiptSale.payment_status === 'partial' && historyReceiptSale.paid_amount ? (
                <div className="mt-2 p-2 bg-yellow-100 rounded-lg w-full">
                  <p className="text-sm font-medium text-yellow-800">Pago Parcial</p>
                  <p className="text-sm text-yellow-700">
                    Pagado: {formatCurrency(historyReceiptSale.paid_amount)} de {formatCurrency(historyReceiptSale.total_amount)}
                  </p>
                  <p className="text-sm text-yellow-700">
                    Restante: {formatCurrency(historyReceiptSale.total_amount - historyReceiptSale.paid_amount)}
                  </p>
                </div>
              ) : historyReceiptSale.payment_status === 'paid' ? (
                <div className="mt-2 p-2 bg-green-100 rounded-lg w-full">
                  <p className="text-sm font-medium text-green-800">Pagado en su totalidad</p>
                </div>
              ) : (
                <div className="mt-2 p-2 bg-red-100 rounded-lg w-full">
                  <p className="text-sm font-medium text-red-800">Pago Pendiente</p>
                </div>
              )}

              <p className="footer text-muted-foreground text-sm mt-4">¡Gracias por tu compra!</p>

              <Button
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow && historyReceiptSale) {
                    const itemsHtml = historyReceiptSale.sale_items?.map(item => `
                      <tr>
                        <td style="text-align: left; padding: 8px 4px; border-bottom: 1px solid #eee;">${escapeHtml(item.inventory?.name || 'Producto eliminado')}</td>
                        <td style="text-align: center; padding: 8px 4px; border-bottom: 1px solid #eee;">${item.quantity}</td>
                        <td style="text-align: right; padding: 8px 4px; border-bottom: 1px solid #eee;">${formatCurrency(item.unit_price * item.quantity)}</td>
                      </tr>
                    `).join('') || '';

                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Recibo - Silicer</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; max-width: 300px; margin: 0 auto; }
                            h1 { text-align: center; color: #5C329E; font-size: 24px; margin-bottom: 5px; }
                            .subtitle { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
                            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                            th { text-align: left; padding: 8px 4px; border-bottom: 1px solid #333; }
                            .total { font-weight: bold; font-size: 18px; text-align: center; margin-top: 15px; }
                            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                            .payment-status { padding: 10px; border-radius: 8px; margin-top: 10px; text-align: center; }
                            .partial { background-color: #fef3c7; color: #92400e; }
                            .paid { background-color: #d1fae5; color: #065f46; }
                            .pending { background-color: #fee2e2; color: #991b1b; }
                          </style>
                        </head>
                        <body>
                          <h1>Silicer</h1>
                          <p class="subtitle">Taller de Cerámica</p>
                          <p class="subtitle">${formatDate(historyReceiptSale.created_at)}</p>
                          <table>
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th style="text-align: center;">Cant.</th>
                                <th style="text-align: right;">Precio</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${itemsHtml}
                            </tbody>
                          </table>
                          <p class="total">Total: ${formatCurrency(historyReceiptSale.total_amount)}</p>
                          ${historyReceiptSale.payment_status === 'partial' && historyReceiptSale.paid_amount
                            ? `<div class="payment-status partial">
                                <strong>Pago Parcial</strong><br/>
                                Pagado: ${formatCurrency(historyReceiptSale.paid_amount)} de ${formatCurrency(historyReceiptSale.total_amount)}<br/>
                                Restante: ${formatCurrency(historyReceiptSale.total_amount - historyReceiptSale.paid_amount)}
                              </div>`
                            : historyReceiptSale.payment_status === 'paid'
                              ? `<div class="payment-status paid"><strong>Pagado en su totalidad</strong></div>`
                              : `<div class="payment-status pending"><strong>Pago Pendiente</strong></div>`
                          }
                          <p class="footer">¡Gracias por tu compra!</p>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }}
                className="w-full mt-4"
                variant="outline"
              >
                <Printer className="w-4 h-4 mr-2" /> Imprimir Recibo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Payment Modal */}
      <Dialog open={!!editPaymentSale} onOpenChange={() => {
        setEditPaymentSale(null);
        setEditPaymentType('total');
        setEditPartialAmount('');
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Estado de Pago</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Venta del {editPaymentSale && formatDate(editPaymentSale.created_at)}</p>
              <p className="text-lg font-bold">Total: {formatCurrency(editPaymentSale?.total_amount || 0)}</p>
              {editPaymentSale?.paid_amount && editPaymentSale.paid_amount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Pagado anteriormente: {formatCurrency(editPaymentSale.paid_amount)}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Tipo de Pago</Label>
              <div className="flex gap-2">
                <Button
                  variant={editPaymentType === 'total' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditPaymentType('total')}
                >
                  Pago Total
                </Button>
                <Button
                  variant={editPaymentType === 'partial' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditPaymentType('partial')}
                >
                  Pago Parcial
                </Button>
              </div>

              {editPaymentType === 'total' ? (
                <p className="text-sm text-muted-foreground text-center">
                  Se registrará el pago completo de {formatCurrency(editPaymentSale?.total_amount || 0)}
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="editPartialAmount">Monto del pago parcial</Label>
                  <Input
                    id="editPartialAmount"
                    type="number"
                    placeholder="Ej: 5000"
                    value={editPartialAmount}
                    onChange={(e) => setEditPartialAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total de la venta: {formatCurrency(editPaymentSale?.total_amount || 0)}
                  </p>
                </div>
              )}
            </div>

            <Button onClick={handleEditPayment} className="w-full">
              <DollarSign className="w-4 h-4 mr-2" /> Actualizar Pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Agregar "Cuota Mensual" al carrito: requiere alumno y mes */}
      <Dialog open={cuotaPickerOpen} onOpenChange={(open) => {
        if (!open) {
          setCuotaPickerOpen(false);
          setCuotaPickerItem(null);
          setCuotaPickerStudent('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{cuotaPickerItem?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alumno</Label>
              <Popover open={cuotaPickerComboOpen} onOpenChange={setCuotaPickerComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={cuotaPickerComboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {cuotaPickerStudent
                      ? studentName(cuotaPickerStudent)
                      : 'Seleccionar alumno'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar alumno..." />
                    <CommandList>
                      <CommandEmpty>No se encontró ningún alumno.</CommandEmpty>
                      <CommandGroup>
                        {students.map(s => (
                          <CommandItem
                            key={s.id}
                            value={`${s.first_name} ${s.last_name}`}
                            onSelect={() => { setCuotaPickerStudent(s.id); setCuotaPickerComboOpen(false); }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${cuotaPickerStudent === s.id ? 'opacity-100' : 'opacity-0'}`} />
                            {s.first_name} {s.last_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={cuotaPickerMonth} onValueChange={setCuotaPickerMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent>
                  {cuotaMonthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cuotaPickerItem && (
              <p className="text-lg font-bold text-primary">{formatCurrency(cuotaPickerItem.price)}</p>
            )}

            <Button onClick={confirmAddCuota} className="w-full" disabled={!cuotaPickerStudent || !cuotaPickerMonth}>
              <Plus className="w-4 h-4 mr-2" /> Agregar al carrito
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
