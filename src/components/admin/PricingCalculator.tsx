import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, Plus, Trash2, Loader2, ImagePlus, X } from 'lucide-react';
import { ProductCategory } from '@/types/database';

// Capacidad del horno: cuadrícula 2x2x2 = 8 bloques
const CAPACIDAD_HORNO = 8;

// Categorías con su valor en bloques (fracción del horno que ocupa cada pieza)
const CATEGORIAS_BLOQUES: Record<string, number | null> = {
  'Tazas': 0.25,
  'Platos S': 0.09,
  'Platos M': 0.25,
  'Platos L': 0.33,
  'Platos XL': 0.5,
  'Bandejas y fuentes': 0.5,
  'Jarras': 0.33,
  'Bowl XS': 0.09,
  'Bowl S': 0.12,
  'Bowl M': 0.166,
  'Bowl L': 0.25,
  'Bowl XL': 0.66,
  'Compotera': 0.09,
  'Locreras': 0.166,
  'Pequeñeses': 0.05,
  'Mates y vasos': 0.0625,
  'A medida': null, // ingreso manual
};

const CATEGORIAS = Object.keys(CATEGORIAS_BLOQUES);

const CONFIG_STORAGE_KEY = 'silicer-pricing-config';
const PRODUCTS_STORAGE_KEY = 'silicer-pricing-products';

interface PricingConfig {
  precioBarbotina: number;
  pesoBidon: number;
  margenDefault: number;
  costoManoObraDefault: number;
  costoHorneadoDefault: number;
  costoEsmaltadoDefault: number;
  // Esmalte: precio por kg y % del peso del producto
  precioEsmalteKg: number;
  porcentajeEsmalte: number;
}

interface ProductCost {
  id: string;
  nombre: string;
  categoria: string;
  pesoGramos: number;
  costoManoObra: number;
  margen: number;
  image_url: string | null;
  // Etapa 2: Bizcochado
  costoHorneado1: number;
  margenBizcochado: number;
  // Etapa 3: Final
  costoEsmaltado: number;
  costoHorneado2: number;
  margenFinal: number;
}

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

const formatCurrency = (value: number) => {
  return `$${Math.round(value).toLocaleString('es-AR')}`;
};

// Select all text on focus
const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

export default function PricingCalculator() {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [products, setProducts] = useState<ProductCost[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeImageProductId, setActiveImageProductId] = useState<string | null>(null);
  const { toast } = useToast();

  // Cargar configuración y productos guardados
  useEffect(() => {
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({ ...defaultConfig, ...parsed });
      } catch {
        // Usar default
      }
    }

    const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (savedProducts) {
      try {
        const raw: ProductCost[] = JSON.parse(savedProducts);
        // Migrar productos que no tienen los campos nuevos
        const migrated = raw.map(p => ({
          ...p,
          image_url: p.image_url ?? null,
          costoHorneado1: p.costoHorneado1 ?? 0,
          margenBizcochado: p.margenBizcochado ?? p.margen ?? config.margenDefault,
          costoEsmaltado: p.costoEsmaltado ?? 0,
          costoHorneado2: p.costoHorneado2 ?? 0,
          margenFinal: p.margenFinal ?? p.margen ?? config.margenDefault,
        }));
        setProducts(migrated);
      } catch {
        // Sin productos
      }
    }
  }, []);

  // Guardar configuración
  const saveConfig = () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    toast({ title: 'Configuración guardada' });
  };

  // Calcular el costo de horneado efectivo para un producto según su categoría
  const getHorneadoCost = (product: ProductCost): number => {
    const bloqueValue = CATEGORIAS_BLOQUES[product.categoria];
    if (bloqueValue === null || bloqueValue === undefined) {
      // "A medida" o sin categoría: usar el valor manual del producto
      return product.costoHorneado1;
    }
    // Costo por bloque = costoHorneadoDefault / CAPACIDAD_HORNO
    // Costo pieza = costo por bloque * valor de bloque de la categoría
    return (config.costoHorneadoDefault / CAPACIDAD_HORNO) * bloqueValue;
  };

  // Calcular costos de un producto en las 3 etapas
  // Cada etapa suma su precio de venta sobre la etapa anterior
  const calculateCosts = (product: ProductCost) => {
    // Etapa 1: Molde (crudo)
    const costoBarbotina = (config.precioBarbotina / config.pesoBidon) * product.pesoGramos;
    const costoTotalMolde = costoBarbotina + product.costoManoObra;
    const precioVentaMolde = costoTotalMolde * (1 + product.margen / 100);

    // Costo de horneado según categoría
    const horneadoCost = getHorneadoCost(product);

    // Etapa 2: Bizcochado = Precio Venta Etapa 1 + costo horneado con su margen
    const costoTotalBizcochado = costoTotalMolde + horneadoCost;
    const precioVentaBizcochado = precioVentaMolde + horneadoCost * (1 + product.margenBizcochado / 100);

    // Costo de esmalte = peso del producto * (% esmalte / 100) * (precio esmalte por kg / 1000)
    const costoEsmalte = product.pesoGramos * (config.porcentajeEsmalte / 100) * (config.precioEsmalteKg / 1000);

    // Etapa 3: Final = Precio Venta Etapa 2 + (esmalte + horneado2) con su margen
    const costoEtapa3 = costoEsmalte + horneadoCost;
    const costoTotalFinal = costoTotalBizcochado + costoEsmalte + horneadoCost;
    const precioVentaFinal = precioVentaBizcochado + costoEtapa3 * (1 + product.margenFinal / 100);

    return {
      costoBarbotina,
      costoTotalMolde,
      precioVentaMolde,
      horneadoCost,
      costoTotalBizcochado,
      precioVentaBizcochado,
      costoEsmalte,
      costoTotalFinal,
      precioVentaFinal,
    };
  };

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
      const { data: existingItems } = await supabase
        .from('inventory')
        .select('id, description')
        .in('category', ['moldes', 'bizcochado', 'final']);

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

      // Upsert cada producto en cada etapa
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
            await supabase.from('inventory').update(inventoryData).eq('id', existingId);
            existingMap.delete(descKey);
          } else {
            await supabase.from('inventory').insert(inventoryData);
          }
        }
      }

      // Eliminar items que ya no existen
      const idsToDelete = Array.from(existingMap.values());
      if (idsToDelete.length > 0) {
        await supabase.from('inventory').delete().in('id', idsToDelete);
      }

      toast({ title: 'Productos guardados y sincronizados con inventario y ventas' });
    } catch {
      toast({
        title: 'Error',
        description: 'Se guardaron localmente pero hubo un error al sincronizar con inventario',
        variant: 'destructive',
      });
    }

    setSyncing(false);
  };

  // Guardar productos (localStorage + inventario)
  const saveProducts = async () => {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    await syncToInventory(products);
  };

  // Agregar nuevo producto
  const addProduct = () => {
    const newProduct: ProductCost = {
      id: Date.now().toString(),
      nombre: '',
      categoria: '',
      pesoGramos: 0,
      costoManoObra: config.costoManoObraDefault,
      margen: config.margenDefault,
      image_url: null,
      costoHorneado1: config.costoHorneadoDefault,
      margenBizcochado: config.margenDefault,
      costoEsmaltado: config.costoEsmaltadoDefault,
      costoHorneado2: config.costoHorneadoDefault,
      margenFinal: config.margenDefault,
    };
    setProducts([...products, newProduct]);
  };

  // Actualizar producto
  const updateProduct = (id: string, field: keyof ProductCost, value: string | number | null) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Eliminar producto (también del inventario)
  const removeProduct = async (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));

    // Eliminar las 3 etapas del inventario
    await supabase
      .from('inventory')
      .delete()
      .in('description', [`molde-${id}`, `bizcochado-${id}`, `final-${id}`]);
  };

  return (
    <div className="space-y-6">
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
                onChange={(e) => setConfig(p => ({ ...p, margenDefault: parseFloat(e.target.value) || 0 }))}
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

      {/* Tabla de Productos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Calculadora de Precios - Productos</CardTitle>
          <div className="flex gap-2">
            <Button onClick={saveProducts} variant="outline" size="sm" disabled={syncing}>
              {syncing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : <><Save className="w-4 h-4 mr-2" /> Guardar Todo</>}
            </Button>
            <Button onClick={addProduct} size="sm">
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
                  <TableHead className="min-w-[100px] text-center">M. Obra ($)</TableHead>
                  <TableHead className="min-w-[100px] text-right bg-blue-50 dark:bg-blue-950/30">Costo Molde</TableHead>
                  <TableHead className="min-w-[70px] text-center bg-blue-50 dark:bg-blue-950/30">%</TableHead>
                  <TableHead className="min-w-[110px] text-right bg-blue-50 dark:bg-blue-950/30">Venta Molde</TableHead>
                  <TableHead className="min-w-[100px] text-center bg-amber-50 dark:bg-amber-950/30">Horneado ($)</TableHead>
                  <TableHead className="min-w-[70px] text-center bg-amber-50 dark:bg-amber-950/30">%</TableHead>
                  <TableHead className="min-w-[110px] text-right bg-amber-50 dark:bg-amber-950/30">Venta Bizc.</TableHead>
                  <TableHead className="min-w-[100px] text-center bg-green-50 dark:bg-green-950/30">Esmaltado ($)</TableHead>
                  <TableHead className="min-w-[100px] text-center bg-green-50 dark:bg-green-950/30">Horneado ($)</TableHead>
                  <TableHead className="min-w-[70px] text-center bg-green-50 dark:bg-green-950/30">%</TableHead>
                  <TableHead className="min-w-[110px] text-right bg-green-50 dark:bg-green-950/30">Venta Final</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(product => {
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
                      {/* Mano de Obra */}
                      <TableCell>
                        <Input
                          type="number"
                          value={product.costoManoObra || ''}
                          onFocus={selectOnFocus}
                          onChange={(e) => updateProduct(product.id, 'costoManoObra', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-center w-[80px]"
                        />
                      </TableCell>

                      {/* === ETAPA 1: MOLDE === */}
                      <TableCell className="text-right font-medium bg-blue-50/50 dark:bg-blue-950/20">
                        {formatCurrency(costs.costoTotalMolde)}
                      </TableCell>
                      <TableCell className="bg-blue-50/50 dark:bg-blue-950/20">
                        <Input
                          type="number"
                          value={product.margen || ''}
                          onFocus={selectOnFocus}
                          onChange={(e) => updateProduct(product.id, 'margen', parseFloat(e.target.value) || 0)}
                          placeholder="50"
                          className="h-8 text-center w-[60px]"
                        />
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
                      <TableCell className="bg-amber-50/50 dark:bg-amber-950/20">
                        <Input
                          type="number"
                          value={product.margenBizcochado || ''}
                          onFocus={selectOnFocus}
                          onChange={(e) => updateProduct(product.id, 'margenBizcochado', parseFloat(e.target.value) || 0)}
                          placeholder="50"
                          className="h-8 text-center w-[60px]"
                        />
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
                      <TableCell className="bg-green-50/50 dark:bg-green-950/20">
                        <Input
                          type="number"
                          value={product.margenFinal || ''}
                          onFocus={selectOnFocus}
                          onChange={(e) => updateProduct(product.id, 'margenFinal', parseFloat(e.target.value) || 0)}
                          placeholder="50"
                          className="h-8 text-center w-[60px]"
                        />
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
                    <TableCell colSpan={16} className="text-center text-muted-foreground py-8">
                      No hay productos. Haz clic en "Agregar Producto" para comenzar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Leyenda de etapas */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
              <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-1">Etapa 1: Molde</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Costo = Barbotina + Mano de Obra</li>
                <li>Precio = Costo × (1 + Margen%)</li>
              </ul>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
              <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-1">Etapa 2: Bizcochado</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Costo = Costo Molde + Horneado</li>
                <li>Precio = PV Etapa 1 + Horneado × (1 + Margen%)</li>
              </ul>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
              <h4 className="font-medium text-green-700 dark:text-green-400 mb-1">Etapa 3: Final</h4>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Esmalte = Peso × {config.porcentajeEsmalte}% × ${config.precioEsmalteKg}/kg</li>
                <li>Costo = Costo Bizc. + Esmalte + Horneado</li>
                <li>Precio = PV Etapa 2 + (Esmalte + Horneado) × (1 + Margen%)</li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Precio barbotina por gramo: {formatCurrency(config.precioBarbotina / config.pesoBidon)} / gramo
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
