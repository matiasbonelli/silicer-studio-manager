import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Loader2, AlertTriangle, ShoppingCart, Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

// Formato moneda pesos argentinos
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    quantity: 0,
    unit: 'unidad',
    min_stock: 0,
    cost: 0,
    margin_percent: 0,
    for_sale: false,
  });

  // Calculate price from cost and margin
  const calculatedPrice = formData.cost > 0
    ? Math.round(formData.cost * (1 + formData.margin_percent / 100))
    : 0;
  const [inventoryTab, setInventoryTab] = useState('all');
  const { toast } = useToast();

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .order('name');

    if (data) {
      setItems(data as InventoryItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openModal = (item?: InventoryItem) => {
    if (item) {
      // Calculate margin percent from existing cost and price
      const marginPercent = item.cost > 0
        ? Math.round(((item.price - item.cost) / item.cost) * 100)
        : 0;

      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        quantity: item.quantity,
        unit: item.unit,
        min_stock: item.min_stock,
        cost: item.cost ?? 0,
        margin_percent: marginPercent,
        for_sale: item.for_sale ?? false,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        quantity: 0,
        unit: 'unidad',
        min_stock: 0,
        cost: 0,
        margin_percent: 0,
        for_sale: false,
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSave = {
      name: formData.name,
      description: formData.description || null,
      quantity: formData.quantity,
      unit: formData.unit,
      min_stock: formData.min_stock,
      price: calculatedPrice,
      cost: formData.cost,
      for_sale: formData.for_sale,
    };

    let error;

    if (editingItem) {
      const result = await supabase.from('inventory').update(dataToSave).eq('id', editingItem.id);
      error = result.error;
    } else {
      const result = await supabase.from('inventory').insert(dataToSave);
      error = result.error;
    }

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el producto',
        variant: 'destructive',
      });
    } else {
      toast({
        title: editingItem ? 'Producto actualizado' : 'Producto creado',
      });
      fetchItems();
      setIsModalOpen(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`¿Eliminar "${item.name}"?`)) return;

    const { error } = await supabase.from('inventory').delete().eq('id', item.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el producto',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Producto eliminado' });
      fetchItems();
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    if (inventoryTab === 'for_sale') {
      return matchesSearch && item.for_sale;
    } else if (inventoryTab === 'general') {
      return matchesSearch && !item.for_sale;
    }
    return matchesSearch; // 'all' tab
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={inventoryTab} onValueChange={setInventoryTab}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <TabsList>
            <TabsTrigger value="all" className="flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Todos
            </TabsTrigger>
            <TabsTrigger value="for_sale" className="flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4" />
              Para Venta
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Inv. General
            </TabsTrigger>
          </TabsList>
          <Button onClick={() => openModal()}>
            <Plus className="w-4 h-4 mr-2" /> Agregar Producto
          </Button>
        </div>
      </Tabs>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center">Tipo</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-right">Costo</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <span className="font-medium">{item.name}</span>
                    {item.description && (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={item.for_sale ? 'default' : 'secondary'}>
                    {item.for_sale ? 'Venta' : 'General'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {item.quantity <= item.min_stock && (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                    <Badge variant={item.quantity <= item.min_stock ? 'destructive' : 'secondary'}>
                      {item.quantity} {item.unit}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCurrency(item.cost || 0)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(item.price)}
                </TableCell>
                <TableCell className="text-right">
                  {item.cost > 0 ? (
                    <Badge variant={item.price - item.cost > 0 ? 'default' : 'destructive'}>
                      {formatCurrency(item.price - item.cost)} ({Math.round(((item.price - item.cost) / item.cost) * 100)}%)
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openModal(item)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(item)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No hay productos en el inventario
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity">Cantidad</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unidad</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="min_stock">Stock Mínimo</Label>
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Costo</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.cost}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="margin_percent">Margen (%)</Label>
                <Input
                  id="margin_percent"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.margin_percent}
                  onChange={(e) => setFormData(prev => ({ ...prev, margin_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Precio de Venta</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-medium">
                  {formData.cost > 0 ? (
                    <span className="text-primary">{formatCurrency(calculatedPrice)}</span>
                  ) : (
                    <span className="text-muted-foreground">Ingresá el costo</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="for_sale">Disponible para Venta</Label>
                <p className="text-sm text-muted-foreground">
                  Marcar si este producto puede venderse a clientes
                </p>
              </div>
              <Switch
                id="for_sale"
                checked={formData.for_sale}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, for_sale: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
