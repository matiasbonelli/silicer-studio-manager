import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Settings, Save, Plus, Trash2, Loader2, ImagePlus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ProductCategory } from '@/types/database';
import {
  CATEGORIAS,
  CAPACIDAD_HORNO,
  PricingConfig,
  PricingProduct,
  calculateCosts as calculateCostsShared,
  parseNumberSafe,
} from '@/lib/pricing';

type ProductCost = PricingProduct;

const defaultConfig: PricingConfig = {
  precioBarbotina: 11500,
  pesoBidon: 9000,
  margenDefault: 50,
  costoManoObraDefault: 1500,
  costoHorneadoDefault: 0,
  costoEsmaltadoDefault: 0,
  precioEsmalteKg: 0,
  porcentajeEsmalte: 0,
};

// Select all text on focus
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

const PAGE_SIZE = 10;

// Orden de categoría según CATEGORIAS; sin categoría (producto nuevo) va al final.
const categoryIndex = (categoria: string) => {
  const idx = CATEGORIAS.indexOf(categoria);
  return idx === -1 ? CATEGORIAS.length : idx;
};

const sortByCategory = (list: ProductCost[]) =>
  [...list].sort((a, b) => {
    const catDiff = categoryIndex(a.categoria) - categoryIndex(b.categoria);
    if (catDiff !== 0) return catDiff;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

// Mano de obra y márgenes ya no se editan por producto: se aplica siempre
// el valor global de Configuración de Costos (por ahora es el mismo para todos).
const effectiveProduct = (product: ProductCost, config: PricingConfig): ProductCost => ({
  ...product,
  costoManoObra: config.costoManoObraDefault,
  margen: config.margenDefault,
  margenBizcochado: config.margenDefault,
  margenFinal: config.margenDefault,
});

export default function PricingCalculator() {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [configId, setConfigId] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductCost[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeImageProductId, setActiveImageProductId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductForm, setNewProductForm] = useState<{
    nombre: string;
    categoria: string;
    pesoGramos: string;
    imageFile: File | null;
    imagePreview: string | null;
  }>({ nombre: '', categoria: '', pesoGramos: '', imageFile: null, imagePreview: null });
  const { toast } = useToast();

  // Cargar configuraci�n y productos desde Supabase
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          setConfig(defaultConfig);
          setProducts([]);
          return;
        }

        const { data: configData, error: configError } = await supabase
          .from('pricing_config')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (configError) throw configError;

        if (configData) {
          setConfigId(configData.id);
          setConfig({
            precioBarbotina: Number(configData.precio_barbotina),
            pesoBidon: Number(configData.peso_bidon),
            margenDefault: Number(configData.margen_default),
            costoManoObraDefault: Number(configData.costo_mano_obra_default),
            costoHorneadoDefault: Number(configData.costo_horneado_default),
            costoEsmaltadoDefault: Number(configData.costo_esmaltado_default),
            precioEsmalteKg: Number(configData.precio_esmalte_kg),
            porcentajeEsmalte: Number(configData.porcentaje_esmalte),
          });
        }

        const { data: productsData, error: productsError } = await supabase
          .from('pricing_products')
          .select('*')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true });
        if (productsError) throw productsError;

        if (productsData && productsData.length > 0) {
          setProducts(sortByCategory(productsData.map(p => ({
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
          }))));
        } else {
          setProducts([]);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudieron cargar costos desde la base de datos';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
      }

      setLoading(false);
    };

    loadData();
  }, [toast]);

  // Guardar configuración en Supabase (update si ya existe, insert si no)
  const saveConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      const configValues = {
        precio_barbotina: config.precioBarbotina,
        peso_bidon: config.pesoBidon,
        margen_default: config.margenDefault,
        costo_mano_obra_default: config.costoManoObraDefault,
        costo_horneado_default: config.costoHorneadoDefault,
        costo_esmaltado_default: config.costoEsmaltadoDefault,
        precio_esmalte_kg: config.precioEsmalteKg,
        porcentaje_esmalte: config.porcentajeEsmalte,
      };

      if (configId) {
        const { error } = await supabase
          .from('pricing_config')
          .update(configValues)
          .eq('id', configId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('pricing_config')
          .insert({ user_id: user.id, ...configValues })
          .select('id')
          .single();
        if (error) throw error;
        if (data) setConfigId(data.id);
      }

      toast({ title: 'Configuración guardada' });
    } catch (error) {
      const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string } | null;
      console.error('[pricing_config] save error', {
        message: supabaseError?.message,
        code: supabaseError?.code,
        details: supabaseError?.details,
        hint: supabaseError?.hint,
        raw: error,
      });
      const message = supabaseError?.message ?? 'No se pudo guardar la configuración en la base de datos';
      toast({
        title: 'Error',
        description: supabaseError?.details ? `${message} (${supabaseError.details})` : message,
        variant: 'destructive',
      });
    }
  };

  const calculateCosts = (product: ProductCost) => calculateCostsShared(effectiveProduct(product, config), config);

  // Subir imagen
  const handleImageUpload = async (productId: string, file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'La imagen no puede superar 2MB', variant: 'destructive' });
      return;
    }

    setUploadingImage(productId);
    const fileExt = file.name.split('.').pop();
    const fileName = `molde-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      toast({ title: 'Error al subir imagen', description: uploadError.message, variant: 'destructive' });
      setUploadingImage(null);
      return;
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    updateProduct(productId, 'image_url', urlData.publicUrl);
    setUploadingImage(null);
  };

  // Sincronizar productos con inventario (Supabase) - 3 etapas por producto
  const syncToInventory = async (productsToSync: ProductCost[]) => {
    setSyncing(true);

    try {
      // Obtener todos los productos de costos actuales en inventario
      const { data: existingItems, error: existingItemsError } = await supabase
        .from('inventory')
        .select('id, description')
        .in('category', ['moldes', 'bizcochado', 'final']);
      if (existingItemsError) throw existingItemsError;

      const existingMap = new Map<string, string>();
      existingItems?.forEach(item => {
        if (item.description) {
          existingMap.set(item.description, item.id);
        }
      });

      const stages: { suffix: string; category: ProductCategory; getCost: (c: ReturnType<typeof calculateCosts>) => number; getPrice: (c: ReturnType<typeof calculateCosts>) => number; label: string }[] = [
        { suffix: 'molde', category: 'moldes', getCost: c => c.costoTotalMolde, getPrice: c => c.precioVentaMolde, label: 'Molde' },
        { suffix: 'bizcochado', category: 'bizcochado', getCost: c => c.costoTotalBizcochado, getPrice: c => c.precioVentaBizcochado, label: 'Bizcochado' },
        { suffix: 'final', category: 'final', getCost: c => c.costoTotalFinal, getPrice: c => c.precioVentaFinal, label: 'Final' },
      ];

      // Preparar upsert de las 3 etapas por producto y ejecutarlas en paralelo
      // (antes iban una por una en un for-await, lo que hacía el guardado muy lento)
      const pendingWrites: PromiseLike<{ error: { message: string; code?: string } | null }>[] = [];

      for (const product of productsToSync) {
        if (!product.nombre || product.pesoGramos <= 0) continue;

        const costs = calculateCosts(product);

        for (const stage of stages) {
          const descKey = `${stage.suffix}-${product.id}`;
          const stageName = stage.suffix === 'molde'
            ? product.nombre
            : `${product.nombre} (${stage.label})`;

          const inventoryData = {
            name: stageName,
            description: descKey,
            quantity: 999,
            unit: '1 unidad',
            min_stock: 0,
            price: Math.round(stage.getPrice(costs)),
            cost: Math.round(stage.getCost(costs) * 100) / 100,
            for_sale: true,
            category: stage.category,
            image_url: product.image_url || null,
          };

          const existingId = existingMap.get(descKey);
          if (existingId) {
            existingMap.delete(descKey);
            pendingWrites.push(supabase.from('inventory').update(inventoryData).eq('id', existingId));
          } else {
            pendingWrites.push(supabase.from('inventory').insert(inventoryData));
          }
        }
      }

      const writeResults = await Promise.all(pendingWrites);
      const writeError = writeResults.find(r => r.error)?.error;
      if (writeError) throw writeError;

      // Eliminar items que ya no existen. Si un item tiene ventas asociadas,
      // Postgres rechaza el DELETE (409, FK violation) para no romper el
      // historial de ventas; en ese caso lo ocultamos en vez de borrarlo.
      const idsToDelete = Array.from(existingMap.values());
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase.from('inventory').delete().in('id', idsToDelete);
        if (deleteError) {
          if (deleteError.code === '23503') {
            const { error: hideError } = await supabase
              .from('inventory')
              .update({ for_sale: false, quantity: 0 })
              .in('id', idsToDelete);
            if (hideError) throw hideError;
          } else {
            throw deleteError;
          }
        }
      }

      toast({ title: 'Productos guardados y sincronizados con inventario y ventas' });
    } catch (error) {
      const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string } | null;
      console.error('[inventory] sync error', {
        message: supabaseError?.message,
        code: supabaseError?.code,
        details: supabaseError?.details,
        hint: supabaseError?.hint,
        raw: error,
      });
      const message = supabaseError?.message ?? 'No se pudo sincronizar con inventario';
      toast({
        title: 'Error',
        description: supabaseError?.details ? `${message} (${supabaseError.details})` : message,
        variant: 'destructive',
      });
    }

    setSyncing(false);
  };

  // Guardar productos en Supabase y sincronizar inventario
  const saveProducts = async () => {
    // Reorganizar por categoría antes de guardar, para que el sort_order
    // persistido refleje el nuevo orden.
    const sortedProducts = sortByCategory(products);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Sesion expirada. Volve a iniciar sesion.');

      setProducts(sortedProducts);
      setPage(0);

      const rows = sortedProducts.map((p, index) => ({
        id: p.id,
        user_id: user.id,
        nombre: p.nombre,
        categoria: p.categoria,
        peso_gramos: p.pesoGramos,
        costo_mano_obra: config.costoManoObraDefault,
        margen: config.margenDefault,
        image_url: p.image_url,
        costo_horneado1: p.costoHorneado1,
        margen_bizcochado: config.margenDefault,
        costo_esmaltado: p.costoEsmaltado,
        costo_horneado2: p.costoHorneado2,
        margen_final: config.margenDefault,
        sort_order: index,
      }));

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from('pricing_products')
          .upsert(rows, { onConflict: 'id' });
        if (upsertError) throw upsertError;
      }

      const { data: existingRows, error: existingRowsError } = await supabase
        .from('pricing_products')
        .select('id')
        .eq('user_id', user.id);
      if (existingRowsError) throw existingRowsError;

      const desiredIds = new Set(rows.map(row => row.id));
      const idsToDelete = (existingRows ?? [])
        .filter(row => !desiredIds.has(row.id))
        .map(row => row.id);

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('pricing_products')
          .delete()
          .in('id', idsToDelete);
        if (deleteError) throw deleteError;
      }
    } catch (error) {
      const supabaseError = error as { message?: string; code?: string; details?: string; hint?: string } | null;
      console.error('[pricing_products] save error', {
        message: supabaseError?.message,
        code: supabaseError?.code,
        details: supabaseError?.details,
        hint: supabaseError?.hint,
        raw: error,
      });
      const message = supabaseError?.message ?? 'No se pudieron guardar los productos en la base de datos';
      toast({
        title: 'Error',
        description: supabaseError?.details ? `${message} (${supabaseError.details})` : message,
        variant: 'destructive',
      });
      return;
    }

    // Sincronizar con inventario (ya existente)
    await syncToInventory(sortedProducts);
  };

  // Abrir modal para agregar producto
  const openAddModal = () => {
    setNewProductForm({ nombre: '', categoria: '', pesoGramos: '', imageFile: null, imagePreview: null });
    setIsAddModalOpen(true);
  };

  const handleNewProductImageChange = (file: File | null) => {
    if (!file) {
      setNewProductForm(prev => ({ ...prev, imageFile: null, imagePreview: null }));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'La imagen no puede superar 2MB', variant: 'destructive' });
      return;
    }
    setNewProductForm(prev => ({ ...prev, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  };

  // Confirmar alta: crea el producto, lo ubica según su categoría y sube la imagen si se eligió una
  const handleAddProduct = async () => {
    const nombre = newProductForm.nombre.trim();
    const pesoGramos = parseFloat(newProductForm.pesoGramos);

    if (!nombre || !newProductForm.categoria || !Number.isFinite(pesoGramos) || pesoGramos <= 0) {
      toast({ title: 'Completá nombre, categoría y peso para agregar el producto', variant: 'destructive' });
      return;
    }

    const newProduct: ProductCost = {
      id: crypto.randomUUID(),
      nombre,
      categoria: newProductForm.categoria,
      pesoGramos,
      costoManoObra: config.costoManoObraDefault,
      margen: config.margenDefault,
      image_url: null,
      costoHorneado1: config.costoHorneadoDefault,
      margenBizcochado: config.margenDefault,
      costoEsmaltado: config.costoEsmaltadoDefault,
      costoHorneado2: config.costoHorneadoDefault,
      margenFinal: config.margenDefault,
    };

    const sorted = sortByCategory([...products, newProduct]);
    setProducts(sorted);
    setPage(Math.floor(sorted.findIndex(p => p.id === newProduct.id) / PAGE_SIZE));

    setIsAddModalOpen(false);
    const imageFile = newProductForm.imageFile;
    setNewProductForm({ nombre: '', categoria: '', pesoGramos: '', imageFile: null, imagePreview: null });

    if (imageFile) {
      await handleImageUpload(newProduct.id, imageFile);
    }
  };

  // Actualizar producto
  const updateProduct = (id: string, field: keyof ProductCost, value: string | number | null) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Eliminar producto (también del inventario)
  const removeProduct = async (id: string) => {
    const next = products.filter(p => p.id !== id);
    setProducts(next);
    setPage(p => Math.min(p, Math.max(0, Math.ceil(next.length / PAGE_SIZE) - 1)));

    // Eliminar las 3 etapas del inventario
    await supabase
      .from('inventory')
      .delete()
      .in('description', [`molde-${id}`, `bizcochado-${id}`, `final-${id}`]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Cargando configuración...</span>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pageProducts = products.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Tabla de Productos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Calculadora de Precios - Productos</CardTitle>
          <div className="flex gap-2">
            <Button onClick={saveProducts} variant="outline" size="sm" disabled={syncing}>
              {syncing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4 mr-2" /> Guardar Todo</>}
            </Button>
            <Button onClick={openAddModal} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Agregar Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Hidden file input for images */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && activeImageProductId) {
                handleImageUpload(activeImageProductId, file);
              }
              e.target.value = '';
            }}
          />

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[60px]">Imagen</TableHead>
                  <TableHead className="min-w-[150px]">Producto</TableHead>
                  <TableHead className="min-w-[120px]">Categoría</TableHead>
                  <TableHead className="min-w-[80px] text-center">Peso (g)</TableHead>
                  <TableHead className="min-w-[100px] text-right bg-blue-50 dark:bg-blue-950/30">Costo Molde</TableHead>
                  <TableHead className="min-w-[110px] text-right bg-blue-50 dark:bg-blue-950/30">Venta Molde</TableHead>
                  <TableHead className="min-w-[100px] text-center bg-amber-50 dark:bg-amber-950/30">Horneado ($)</TableHead>
                  <TableHead className="min-w-[110px] text-right bg-amber-50 dark:bg-amber-950/30">Venta Bizc.</TableHead>
                  <TableHead className="min-w-[100px] text-center bg-green-50 dark:bg-green-950/30">Esmaltado ($)</TableHead>
                  <TableHead className="min-w-[100px] text-center bg-green-50 dark:bg-green-950/30">Horneado ($)</TableHead>
                  <TableHead className="min-w-[110px] text-right bg-green-50 dark:bg-green-950/30">Venta Final</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageProducts.map(product => {
                  const costs = calculateCosts(product);
                  return (
                    <TableRow key={product.id}>
                      {/* Imagen */}
                      <TableCell>
                        {uploadingImage === product.id ? (
                          <div className="w-10 h-10 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        ) : product.image_url ? (
                          <div className="relative w-10 h-10 group">
                            <img src={product.image_url} alt="" className="w-10 h-10 object-contain rounded border bg-muted" />
                            <button
                              type="button"
                              className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => updateProduct(product.id, 'image_url', null)}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-10 w-10 p-0"
                            onClick={() => {
                              setActiveImageProductId(product.id);
                              imageInputRef.current?.click();
                            }}
                          >
                            <ImagePlus className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                      {/* Nombre */}
                      <TableCell>
                        <Input
                          value={product.nombre}
                          onChange={(e) => updateProduct(product.id, 'nombre', e.target.value)}
                          placeholder="Nombre"
                          className="h-8"
                        />
                      </TableCell>
                      {/* Categoría */}
                      <TableCell>
                        <Select
                          value={product.categoria}
                          onValueChange={(value) => updateProduct(product.id, 'categoria', value)}
                        >
                          <SelectTrigger className="h-8 w-[160px]">
                            <SelectValue placeholder="Categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {/* Peso */}
                      <TableCell>
                        <Input
                          type="number"
                          value={product.pesoGramos || ''}
                          onFocus={selectOnFocus}
                          onChange={(e) => updateProduct(product.id, 'pesoGramos', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-center w-[80px]"
                        />
                      </TableCell>

                      {/* === ETAPA 1: MOLDE === */}
                      <TableCell className="text-right font-medium bg-blue-50/50 dark:bg-blue-950/20">
                        {formatCurrency(costs.costoTotalMolde)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20">
                        {formatCurrency(costs.precioVentaMolde)}
                      </TableCell>

                      {/* === ETAPA 2: BIZCOCHADO === */}
                      <TableCell className="bg-amber-50/50 dark:bg-amber-950/20">
                        {product.categoria === 'A medida' || !product.categoria ? (
                          <Input
                            type="number"
                            value={product.costoHorneado1 || ''}
                            onFocus={selectOnFocus}
                            onChange={(e) => updateProduct(product.id, 'costoHorneado1', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="h-8 text-center w-[80px]"
                          />
                        ) : (
                          <span className="text-sm font-medium text-center block w-[80px]">
                            {formatCurrency(costs.horneadoCost)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
                        {formatCurrency(costs.precioVentaBizcochado)}
                      </TableCell>

                      {/* === ETAPA 3: FINAL === */}
                      <TableCell className="bg-green-50/50 dark:bg-green-950/20">
                        <span className="text-sm font-medium text-center block w-[80px]">
                          {formatCurrency(costs.costoEsmalte)}
                        </span>
                      </TableCell>
                      <TableCell className="bg-green-50/50 dark:bg-green-950/20">
                        {product.categoria === 'A medida' || !product.categoria ? (
                          <Input
                            type="number"
                            value={product.costoHorneado2 || ''}
                            onFocus={selectOnFocus}
                            onChange={(e) => updateProduct(product.id, 'costoHorneado2', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="h-8 text-center w-[80px]"
                          />
                        ) : (
                          <span className="text-sm font-medium text-center block w-[80px]">
                            {formatCurrency(costs.horneadoCost)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20">
                        {formatCurrency(costs.precioVentaFinal)}
                      </TableCell>

                      {/* Eliminar */}
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeProduct(product.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                      No hay productos. Haz clic en "Agregar Producto" para comenzar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {products.length === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, products.length)} de {products.length} productos
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>
                <span className="px-2">Página {page + 1} de {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Leyenda de etapas */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
              <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-1">Etapa 1: Molde</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Costo = Barbotina + Mano de Obra</li>
                <li>Precio = Costo �- (1 + Margen%)</li>
              </ul>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
              <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-1">Etapa 2: Bizcochado</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Costo = Costo Molde + Horneado</li>
                <li>Precio = PV Etapa 1 + Horneado �- (1 + Margen%)</li>
              </ul>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
              <h4 className="font-medium text-green-700 dark:text-green-400 mb-1">Etapa 3: Final</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Esmalte = Peso �- {config.porcentajeEsmalte}% �- ${config.precioEsmalteKg}/kg</li>
                <li>Costo = Costo Bizc. + Esmalte + Horneado</li>
                <li>Precio = PV Etapa 2 + (Esmalte + Horneado) �- (1 + Margen%)</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Precio barbotina por gramo: {formatCurrency(config.precioBarbotina / config.pesoBidon)} / gramo
          </p>
        </CardContent>
      </Card>

      {/* Configuración */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configuración de Costos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Precio Barbotina (bidón)</Label>
              <Input
                type="number"
                value={config.precioBarbotina}
                onFocus={selectOnFocus}
                onChange={(e) => setConfig(p => ({ ...p, precioBarbotina: parseFloat(e.target.value) || 0 }))}
                placeholder="11500"
              />
              <p className="text-xs text-muted-foreground">Precio del bidón completo</p>
            </div>
            <div className="space-y-2">
              <Label>Peso del Bidón (gramos)</Label>
              <Input
                type="number"
                value={config.pesoBidon}
                onFocus={selectOnFocus}
                onChange={(e) => setConfig(p => ({ ...p, pesoBidon: parseFloat(e.target.value) || 9000 }))}
                placeholder="9000"
              />
              <p className="text-xs text-muted-foreground">Peso total del bidón</p>
            </div>
            <div className="space-y-2">
              <Label>Margen Default (%)</Label>
              <Input
                type="number"
                value={config.margenDefault}
                onFocus={selectOnFocus}
                onChange={(e) => setConfig(p => ({ ...p, margenDefault: parseNumberSafe(e.target.value, { min: 0, max: 9999 }) }))}
                placeholder="50"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Costo Mano de Obra Default ($)</Label>
              <Input
                type="number"
                value={config.costoManoObraDefault}
                onFocus={selectOnFocus}
                onChange={(e) => setConfig(p => ({ ...p, costoManoObraDefault: parseFloat(e.target.value) || 0 }))}
                placeholder="1500"
              />
            </div>
            <div className="space-y-2">
              <Label>Costo Horneado Default ($)</Label>
              <Input
                type="number"
                value={config.costoHorneadoDefault}
                onFocus={selectOnFocus}
                onChange={(e) => setConfig(p => ({ ...p, costoHorneadoDefault: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Costo por bloque: {formatCurrency(config.costoHorneadoDefault / CAPACIDAD_HORNO)} (horno {CAPACIDAD_HORNO} bloques)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Precio Esmalte ($/kg)</Label>
              <Input
                type="number"
                value={config.precioEsmalteKg}
                onFocus={selectOnFocus}
                onChange={(e) => setConfig(p => ({ ...p, precioEsmalteKg: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>% del peso en esmalte</Label>
              <Input
                type="number"
                value={config.porcentajeEsmalte}
                onFocus={selectOnFocus}
                onChange={(e) => setConfig(p => ({ ...p, porcentajeEsmalte: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Ej: si una pieza pesa 500g y el % es 10, usa 50g de esmalte
              </p>
            </div>
          </div>
          <Button onClick={saveConfig} className="mt-4" variant="outline">
            <Save className="w-4 h-4 mr-2" /> Guardar Configuración
          </Button>
        </CardContent>
      </Card>

      {/* Modal: Agregar Producto */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Producto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={newProductForm.nombre}
                onChange={(e) => setNewProductForm(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={newProductForm.categoria}
                onValueChange={(value) => setNewProductForm(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Peso (gramos)</Label>
              <Input
                type="number"
                value={newProductForm.pesoGramos}
                onFocus={selectOnFocus}
                onChange={(e) => setNewProductForm(prev => ({ ...prev, pesoGramos: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Imagen (opcional)</Label>
              <div className="flex items-center gap-3">
                {newProductForm.imagePreview ? (
                  <div className="relative w-12 h-12">
                    <img src={newProductForm.imagePreview} alt="" className="w-12 h-12 object-contain rounded border bg-muted" />
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      onClick={() => handleNewProductImageChange(null)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-12 h-12 rounded border cursor-pointer text-muted-foreground hover:bg-muted">
                    <ImagePlus className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleNewProductImageChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddProduct}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


