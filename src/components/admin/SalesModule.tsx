import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem, Student, Sale, SaleItem, PaymentMethod, PAYMENT_METHOD_LABELS } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Minus, Trash2, ShoppingCart, Printer, Loader2, Search, History, TrendingUp, FileText } from 'lucide-react';
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

interface CartItem {
  inventory: InventoryItem;
  quantity: number;
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
  const [receiptData, setReceiptData] = useState<{sale: Sale, items: CartItem[]} | null>(null);
  const [salesHistory, setSalesHistory] = useState<SaleWithItems[]>([]);
  const [salesTab, setSalesTab] = useState('new');
  const [historySearch, setHistorySearch] = useState('');
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

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

      await fetchSalesHistory();
      setLoading(false);
    };
    fetchData();
  }, []);

  const addToCart = (item: InventoryItem) => {
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
        payment_status: 'paid',
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

    // Create sale items
    const saleItems = cart.map(c => ({
      sale_id: saleData.id,
      inventory_id: c.inventory.id,
      quantity: c.quantity,
      unit_price: c.inventory.price,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);

    if (itemsError) {
      toast({
        title: 'Error',
        description: 'Error al guardar los items',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Venta registrada',
        description: `Total: ${formatCurrency(total)}`,
      });

      setReceiptData({ sale: saleData as Sale, items: [...cart] });

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

  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) && item.quantity > 0 && item.for_sale
  );

  // Calculate sales statistics
  const totalSales = salesHistory.reduce((sum, sale) => sum + sale.total_amount, 0);
  const totalItemsSold = salesHistory.reduce((sum, sale) =>
    sum + (sale.sale_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
  );

  // Group sales by product
  const productSales = salesHistory.reduce((acc, sale) => {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Filtrar historial de ventas
  const filteredSalesHistory = salesHistory.filter(sale => {
    if (!historySearch) return true;
    const searchLower = historySearch.toLowerCase();
    const studentName = sale.student ? `${sale.student.first_name} ${sale.student.last_name}`.toLowerCase() : '';
    const products = sale.sale_items?.map(item => item.inventory?.name?.toLowerCase() || '').join(' ') || '';
    return studentName.includes(searchLower) || products.includes(searchLower);
  });

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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredInventory.map(item => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => addToCart(item)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-medium truncate">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">Stock: {item.quantity}</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(item.price)}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredInventory.length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-8">
                  No hay productos disponibles para venta
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por producto o cliente..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-center">Cant.</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-center">Comprobante</TableHead>
                  <TableHead className="text-right">Total</TableHead>
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
                    <TableCell className="text-center">
                      {sale.student?.payment_receipt_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(sale.student!.payment_receipt_url!, '_blank')}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(sale.total_amount)}</TableCell>
                  </TableRow>
                ))}
                {filteredSalesHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
                <p className="text-3xl font-bold">{salesHistory.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Sales by Product */}
          <Card>
            <CardHeader>
              <CardTitle>Ventas por Producto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-center">Cantidad Vendida</TableHead>
                      <TableHead className="text-right">Importe Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(productSales)
                      .sort((a, b) => b[1].total - a[1].total)
                      .map(([productName, data]) => (
                        <TableRow key={productName}>
                          <TableCell className="font-medium">{productName}</TableCell>
                          <TableCell className="text-center">{data.quantity}</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(data.total)}</TableCell>
                        </TableRow>
                      ))}
                    {Object.keys(productSales).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
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

      {/* Receipt Modal */}
      <Dialog open={!!receiptData} onOpenChange={() => setReceiptData(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recibo de Venta</DialogTitle>
          </DialogHeader>

          <div ref={receiptRef}>
            <h1>Silicer</h1>
            <p className="subtitle">Taller de Cerámica</p>

            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {receiptData?.items.map(item => (
                  <tr key={item.inventory.id}>
                    <td>{item.inventory.name}</td>
                    <td>{item.quantity}</td>
                    <td>{formatCurrency(item.inventory.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="total">Total: {formatCurrency(receiptData?.sale.total_amount || 0)}</p>
            <p className="footer">¡Gracias por tu compra!</p>
          </div>

          <Button onClick={printReceipt} className="w-full">
            <Printer className="w-4 h-4 mr-2" /> Imprimir Recibo
          </Button>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
