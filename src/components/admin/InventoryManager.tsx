import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InventoryItem, ProductCategory, PRODUCT_CATEGORY_LABELS } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Search, Loader2, AlertTriangle, ShoppingCart, Package, Tag, ImagePlus, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/format';

// Parse stored unit field: "1 kg" → { bulk: 1, unit: "kg" }
// Falls back to { bulk: 1, unit: raw } for legacy data like "unidad"
const parseStoredUnit = (stored: string): { bulk: number; unit: string } => {
  const match = stored.match(/^(\d+)\s+(.+)$/);
  if (match) {
    return { bulk: parseInt(match[1]), unit: match[2] };
  }
  return { bulk: 1, unit: stored };
};

// Select all text on focus for number inputs
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

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
    unit: 'kg',
    min_stock: 0,
    cost_total: 0,
    total_quantity: 1,
    bulk_quantity: 1,
    margin_percent: 0,
    for_sale: false,
    category: '' as ProductCategory | '',
  });

  // Calculate unit cost: (cost_total / total_quantity) * bulk_quantity
  // E.g.: $1000 / 100kg * 1kg per bulto = $10 per bulto
  const costPerUnit = formData.total_quantity > 0
    ? formData.cost_total / formData.total_quantity
    : 0;
  const unitCost = costPerUnit * formData.bulk_quantity;
  const calculatedPrice = unitCost > 0
    ? Math.round(unitCost * (1 + formData.margin_percent / 100))
    : 0;
  const [inventoryTab, setInventoryTab] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory | 'all'>('all');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
      const parsed = parseStoredUnit(item.unit);
      // Calculate margin percent from existing cost and price
      const marginPercent = item.cost > 0
        ? Math.round(((item.price - item.cost) / item.cost) * 100)
        : 0;

      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        quantity: item.quantity,
        unit: parsed.unit,
        min_stock: item.min_stock,
        // On edit: cost_total = stored unit cost, total_quantity = bulk so math works
        cost_total: item.cost ?? 0,
        total_quantity: parsed.bulk,
        bulk_quantity: parsed.bulk,
        margin_percent: marginPercent,
        for_sale: item.for_sale ?? false,
        category: item.category || '',
      });
      setImagePreview(item.image_url || null);
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        quantity: 0,
        unit: 'kg',
        min_stock: 0,
        cost_total: 0,
        total_quantity: 1,
        bulk_quantity: 1,
        margin_percent: 0,
        for_sale: false,
        category: '',
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Store unit as "bulk unit" format (e.g., "1 kg", "500 gr")
    const storedUnit = `${formData.bulk_quantity} ${formData.unit}`;

    // Upload image if a new file was selected
    let imageUrl = imagePreview;
    if (imageFile) {
      setUploadingImage(true);
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          contentType: imageFile.type,
          upsert: false,
        });

      if (uploadError) {
        toast({
          title: 'Error al subir imagen',
          description: uploadError.message,
          variant: 'destructive',
        });
        setUploadingImage(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      imageUrl = urlData.publicUrl;
      setUploadingImage(false);
    }

    const dataToSave = {
      name: formData.name,
      description: formData.description || null,
      quantity: formData.quantity,
      unit: storedUnit,
      min_stock: formData.min_stock,
      price: calculatedPrice,
      cost: Math.round(unitCost * 100) / 100,
      for_sale: formData.for_sale,
      category: formData.category || null,
      image_url: imageUrl || null,
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
      await fetchItems();
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
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    if (inventoryTab === 'for_sale') {
      return matchesSearch && matchesCategory && item.for_sale;
    } else if (inventoryTab === 'general') {
      return matchesSearch && matchesCategory && !item.for_sale;
    }
    return matchesSearch && matchesCategory; // 'all' tab
  });

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
          {([['all', 'Todos'], ['insumos', 'Insumos'], ['servicios', 'Servicios'], ['moldes', 'Moldes'], ['bizcochado', 'Bizc.'], ['final', 'Final']] as const).map(([value, label]) => (
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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead className="text-center">Tipo</TableHead>
              <TableHead className="text-center">Categoría</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-right">Costo Unit.</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Margen</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="flex items-center gap-3"><Skeleton className="w-10 h-10 rounded-md" /><Skeleton className="h-4 w-28" /></div></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto rounded-full" /></TableCell>
                  <TableCell><div className="flex justify-center gap-2"><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-8 w-8 rounded" /></div></TableCell>
                </TableRow>
              ))
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Package className="h-10 w-10 opacity-30" />
                    {search || categoryFilter !== 'all' ? (
                      <>
                        <p className="font-medium">No se encontraron productos</p>
                        <p className="text-sm">Probá con otro nombre o cambiá el filtro de categoría.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">El inventario está vacío</p>
                        <p className="text-sm">Agregá productos con el botón "Agregar Producto".</p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredItems.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 object-contain rounded-md border shrink-0 bg-muted" />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <span className="font-medium">{item.name}</span>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={item.for_sale ? 'default' : 'secondary'}>
                    {item.for_sale ? 'Venta' : 'General'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {item.category ? (
                    <Badge variant="outline">
                      {PRODUCT_CATEGORY_LABELS[item.category]}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {item.quantity <= item.min_stock && (
                      <AlertTriangle className="w-4 h-4 text-warning" />
                    )}
                    <Badge variant={item.quantity <= item.min_stock ? 'destructive' : 'secondary'}>
                      {item.quantity}
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
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <div className="space-y-2">
              <Label>Imagen</Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                      toast({ title: 'La imagen no puede superar 2MB', variant: 'destructive' });
                      return;
                    }
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                  }
                  e.target.value = '';
                }}
              />
              {imagePreview ? (
                <div className="relative w-20 h-20">
                  <img src={imagePreview} alt="Preview" className="w-20 h-20 object-contain rounded-lg border bg-muted" />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()}>
                  <ImagePlus className="w-4 h-4 mr-2" /> Agregar imagen
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cost_total">Costo Total</Label>
                <Input
                  id="cost_total"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.cost_total}
                  onFocus={selectOnFocus}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost_total: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_quantity">Cantidad Total</Label>
                <Input
                  id="total_quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.total_quantity}
                  onFocus={selectOnFocus}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setFormData(prev => {
                      const newStock = !editingItem && prev.bulk_quantity > 0
                        ? Math.floor(val / prev.bulk_quantity)
                        : prev.quantity;
                      return { ...prev, total_quantity: val, quantity: newStock };
                    });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="unit">Unidad de Venta</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, unit: value }))}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="gr">gr</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="unidad">unidad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk_quantity">Cantidad por Bulto</Label>
                <Input
                  id="bulk_quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.bulk_quantity}
                  onFocus={selectOnFocus}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setFormData(prev => {
                      const newStock = !editingItem && val > 0
                        ? Math.floor(prev.total_quantity / val)
                        : prev.quantity;
                      return { ...prev, bulk_quantity: val, quantity: newStock };
                    });
                  }}
                />
              </div>
            </div>
            {unitCost > 0 && (
              <div className="p-2 bg-muted rounded-md text-sm text-center">
                Costo Unitario: <span className="font-semibold text-primary">{formatCurrency(Math.round(unitCost))}</span>
                <span className="text-muted-foreground"> / {formData.bulk_quantity} {formData.unit}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="margin_percent">Margen (%)</Label>
                <Input
                  id="margin_percent"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.margin_percent}
                  onFocus={selectOnFocus}
                  onChange={(e) => setFormData(prev => ({ ...prev, margin_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Precio de Venta</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted font-medium">
                  {unitCost > 0 ? (
                    <span className="text-primary">{formatCurrency(calculatedPrice)} <span className="text-muted-foreground text-xs font-normal">/ {formData.bulk_quantity} {formData.unit}</span></span>
                  ) : (
                    <span className="text-muted-foreground">Ingresá costo y cantidades</span>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity">Stock</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onFocus={selectOnFocus}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock">Stock Mínimo</Label>
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onFocus={selectOnFocus}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
                />
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
            {formData.for_sale && (
              <div className="space-y-2">
                <Label htmlFor="category">Categoría de Venta</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as ProductCategory }))}
                >
                  <SelectTrigger>
                    <Tag className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {PRODUCT_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Esta categoría se usará para filtrar en el módulo de ventas
                </p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={uploadingImage}>
                {uploadingImage ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</> : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
