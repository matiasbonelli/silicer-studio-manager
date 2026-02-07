import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem, Student, Sale, SaleItem, PaymentMethod, PaymentStatus, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PRODUCT_CATEGORY_LABELS, ProductCategory as DBProductCategory } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Trash2, ShoppingCart, Printer, Loader2, Search, History, TrendingUp, CalendarDays, DollarSign, Pencil, Upload, FileText, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Formato moneda pesos argentinos
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Keys para localStorage de la calculadora de costos
const PRICING_CONFIG_KEY = 'silicer-pricing-config';
const PRICING_PRODUCTS_KEY = 'silicer-pricing-products';

// Categorías de productos en ventas
type ProductCategory = 'all' | 'insumos' | 'servicios' | 'moldes';

interface PricingProduct {
  id: string;
  nombre: string;
  categoria: string;
  pesoGramos: number;
  costoManoObra: number;
  margen: number;
}

interface PricingConfig {
  precioBarbotina: number;
  pesoBidon: number;
  margenDefault: number;
  costoManoObraDefault: number;
}

// Producto unificado para ventas
interface SaleProduct {
  id: string;
  name: string;
  price: number;
  quantity: number; // stock disponible
  unit: string;
  category: ProductCategory;
  source: 'inventory' | 'moldes';
}

interface CartItem {
  inventory: InventoryItem | SaleProduct;
  quantity: number;
}

interface SaleWithItems extends Sale {
  sale_items?: (SaleItem & { inventory: InventoryItem })[];
}

export default function SalesModule() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [moldesProducts, setMoldesProducts] = useState<SaleProduct[]>([]);
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
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
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
      await fetchSalesHistory();
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
    window.open(data.signedUrl, '_blank');
  };

  // Cargar productos de la calculadora de costos desde localStorage
  const loadMoldesProducts = () => {
    try {
      const savedProducts = localStorage.getItem(PRICING_PRODUCTS_KEY);
      const savedConfig = localStorage.getItem(PRICING_CONFIG_KEY);

      if (savedProducts) {
        const products: PricingProduct[] = JSON.parse(savedProducts);
        const config: PricingConfig = savedConfig
          ? JSON.parse(savedConfig)
          : { precioBarbotina: 11500, pesoBidon: 9000, margenDefault: 50, costoManoObraDefault: 1500 };

        // Convertir productos de calculadora a formato de venta
        const moldes: SaleProduct[] = products.map(p => {
          // Calcular precio usando la misma fórmula de la calculadora
          const costoBarbotina = (config.precioBarbotina / config.pesoBidon) * p.pesoGramos;
          const costoTotal = costoBarbotina + p.costoManoObra;
          const precioVenta = Math.round(costoTotal * (1 + p.margen / 100));

          return {
            id: `molde-${p.id}`,
            name: p.nombre || 'Sin nombre',
            price: precioVenta,
            quantity: 999, // Stock ilimitado para moldes
            unit: 'unidad',
            category: 'moldes' as ProductCategory,
            source: 'moldes' as const,
          };
        }).filter(p => p.name && p.price > 0);

        setMoldesProducts(moldes);
      }
    } catch {
      // Error parsing localStorage
    }
  };

  // Get available years for filter (current year and 2 years back)
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  const monthNames = [
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

  useEffect(() => {
    const fetchData = async () => {
      const [invRes, studRes] = await Promise.all([
        supabase.from('inventory').select('*').order('name'),
        supabase.from('students').select('*').order('last_name'),
      ]);

      if (invRes.data) setInventory(invRes.data as InventoryItem[]);
      if (studRes.data) setStudents(studRes.data as Student[]);

      // Cargar moldes de la calculadora
      loadMoldesProducts();

      await fetchSalesHistory();
      setLoading(false);
    };
    fetchData();

    // Escuchar cambios en localStorage para actualizar moldes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PRICING_PRODUCTS_KEY || e.key === PRICING_CONFIG_KEY) {
        loadMoldesProducts();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addToCart = (item: InventoryItem | SaleProduct) => {
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
      setCart([...cart, { inventory: item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.inventory.id === itemId) {
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          // Moldes no tienen límite de stock
          const isMolde = 'source' in c.inventory && c.inventory.source === 'moldes';
          if (!isMolde && newQty > c.inventory.quantity) {
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
    setCart(prev => prev.filter(c => c.inventory.id !== itemId));
  };

  const total = cart.reduce((sum, c) => sum + c.inventory.price * c.quantity, 0);

  const handleSale = async () => {
    if (cart.length === 0) {
      toast({
        title: 'Carrito vacío',
        description: 'Agrega productos al carrito',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    // Create sale
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        student_id: selectedStudent || null,
        total_amount: total,
        payment_method: paymentMethod,
        payment_status: 'pending',
        paid_amount: 0,
      })
      .select()
      .single();

    if (saleError || !saleData) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar la venta',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Create sale items - solo para items de inventario (no moldes)
    const inventoryItems = cart.filter(c => !('source' in c.inventory) || c.inventory.source !== 'moldes');
    const saleItems = inventoryItems.map(c => ({
      sale_id: saleData.id,
      inventory_id: c.inventory.id,
      quantity: c.quantity,
      unit_price: c.inventory.price,
    }));

    // Solo insertar si hay items de inventario
    let itemsError = null;
    if (saleItems.length > 0) {
      const result = await supabase.from('sale_items').insert(saleItems);
      itemsError = result.error;
    }

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

      await fetchSalesHistory();

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

    const newStatus: PaymentStatus = paymentType === 'total' ? 'paid' : 'partial';

    const { error } = await supabase
      .from('sales')
      .update({
        payment_status: newStatus,
        paid_amount: paidAmount,
      })
      .eq('id', pendingSale.sale.id);

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
      await fetchSalesHistory();
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

    const newStatus: PaymentStatus = editPaymentType === 'total' ? 'paid' : 'partial';

    const { error } = await supabase
      .from('sales')
      .update({
        payment_status: newStatus,
        paid_amount: paidAmount,
      })
      .eq('id', editPaymentSale.id);

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
      await fetchSalesHistory();
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
      await fetchSalesHistory();
    }
  };

  // Combinar productos de inventario y moldes
  const allProducts: (InventoryItem | SaleProduct)[] = [
    // Inventario - usar la categoría del producto o 'insumos' por defecto
    ...inventory.filter(item => item.quantity > 0 && item.for_sale).map(item => ({
      ...item,
      category: (item.category || 'insumos') as ProductCategory,
      source: 'inventory' as const,
    })),
    // Moldes de la calculadora
    ...moldesProducts,
  ];

  // Filtrar por búsqueda y categoría
  const filteredProducts = allProducts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || ('category' in item && item.category === categoryFilter);
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Filtrar historial de ventas
  const filteredSalesHistory = salesHistory.filter(sale => {
    // Filter by date
    if (filterYear || filterMonth) {
      const saleDate = new Date(sale.created_at);
      if (filterYear && saleDate.getFullYear() !== parseInt(filterYear)) {
        return false;
      }
      if (filterMonth && (saleDate.getMonth() + 1) !== parseInt(filterMonth)) {
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
    setFilterMonth('');
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
              <div className="flex gap-1 bg-muted p-1 rounded-lg">
                <Button
                  size="sm"
                  variant={categoryFilter === 'all' ? 'default' : 'ghost'}
                  onClick={() => setCategoryFilter('all')}
                  className="text-xs"
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === 'insumos' ? 'default' : 'ghost'}
                  onClick={() => setCategoryFilter('insumos')}
                  className="text-xs"
                >
                  Insumos
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === 'servicios' ? 'default' : 'ghost'}
                  onClick={() => setCategoryFilter('servicios')}
                  className="text-xs"
                >
                  Servicios
                </Button>
                <Button
                  size="sm"
                  variant={categoryFilter === 'moldes' ? 'default' : 'ghost'}
                  onClick={() => setCategoryFilter('moldes')}
                  className="text-xs"
                >
                  Moldes
                </Button>
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
                    {'image_url' in item && item.image_url && (
                      <img src={item.image_url} alt={item.name} className="w-full h-20 object-cover rounded-md mb-2" />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium truncate flex-1">{item.name}</h4>
                      {'category' in item && item.category === 'moldes' && (
                        <Badge variant="secondary" className="text-xs shrink-0">Molde</Badge>
                      )}
                    </div>
                    {'description' in item && item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{item.description}</p>
                    )}
                    {'source' in item && item.source === 'moldes' ? (
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
                  {categoryFilter === 'moldes'
                    ? 'No hay moldes. Agrega productos en la Calculadora de Precios.'
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
                  {cart.map(item => (
                    <div key={item.inventory.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{item.inventory.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.inventory.price)} x {item.quantity}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.inventory.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.inventory.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7 ml-1" onClick={() => removeFromCart(item.inventory.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label>Alumno (opcional)</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar alumno" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.first_name} {s.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Método de Pago</Label>
                  <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-right text-2xl font-bold text-primary">
                  Total: {formatCurrency(total)}
                </div>

                <Button className="w-full" size="lg" onClick={handleSale} disabled={loading || cart.length === 0}>
                  {loading ? 'Procesando...' : 'Registrar Venta'}
                </Button>
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
              <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                <SelectTrigger className="w-[130px]">
                  <DollarSign className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Pagos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                </SelectContent>
              </Select>
              {(filterMonth || filterYear || filterPaymentStatus) && (
                <Button variant="outline" size="icon" onClick={clearDateFilters}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
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
                      {sale.student ? `${sale.student.first_name} ${sale.student.last_name}` : '-'}
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
                      <div className="flex gap-1">
                        {sale.payment_status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="outline"
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
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
              {(filterMonth || filterYear) && (
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
              <div className="rounded-lg border">
                <Table>
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
                          {sale.student ? `${sale.student.first_name} ${sale.student.last_name}` : '-'}
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
                        <td style="text-align: left; padding: 8px 4px; border-bottom: 1px solid #eee;">${item.inventory?.name || 'Producto eliminado'}</td>
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
    </Tabs>
  );
}
