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
import { Plus, Minus, Trash2, ShoppingCart, Printer, Loader2, Search } from 'lucide-react';

interface CartItem {
  inventory: InventoryItem;
  quantity: number;
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
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [invRes, studRes] = await Promise.all([
        supabase.from('inventory').select('*').order('name'),
        supabase.from('students').select('*').order('last_name'),
      ]);

      if (invRes.data) setInventory(invRes.data as InventoryItem[]);
      if (studRes.data) setStudents(studRes.data as Student[]);
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
        description: `Total: $${total.toFixed(2)}`,
      });

      setReceiptData({ sale: saleData as Sale, items: [...cart] });
      
      // Refresh inventory
      const { data: newInv } = await supabase.from('inventory').select('*').order('name');
      if (newInv) setInventory(newInv as InventoryItem[]);

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
    item.name.toLowerCase().includes(search.toLowerCase()) && item.quantity > 0
  );

  if (loading && inventory.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
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
                <p className="text-lg font-bold text-primary">${item.price.toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
          {filteredInventory.length === 0 && (
            <p className="col-span-full text-center text-muted-foreground py-8">
              No hay productos disponibles
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
                      ${item.inventory.price.toFixed(2)} x {item.quantity}
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
              Total: ${total.toFixed(2)}
            </div>

            <Button className="w-full" size="lg" onClick={handleSale} disabled={loading || cart.length === 0}>
              {loading ? 'Procesando...' : 'Registrar Venta'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    <td>${(item.inventory.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <p className="total">Total: ${receiptData?.sale.total_amount.toFixed(2)}</p>
            <p className="footer">¡Gracias por tu compra!</p>
          </div>

          <Button onClick={printReceipt} className="w-full">
            <Printer className="w-4 h-4 mr-2" /> Imprimir Recibo
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
