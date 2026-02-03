import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, Plus, Trash2 } from 'lucide-react';

const CATEGORIAS = [
  'Taza',
  'Plato',
  'Cuenco',
  'Vaso',
  'Jarra',
  'Fuente',
  'Maceta',
  'Bandeja',
  'Otros',
];

const CONFIG_STORAGE_KEY = 'silicer-pricing-config';
const PRODUCTS_STORAGE_KEY = 'silicer-pricing-products';

interface PricingConfig {
  precioBarbotina: number;
  pesoBidon: number;
  margenDefault: number;
  costoManoObraDefault: number;
}

interface ProductCost {
  id: string;
  nombre: string;
  categoria: string;
  pesoGramos: number;
  costoManoObra: number;
  margen: number;
}

const defaultConfig: PricingConfig = {
  precioBarbotina: 11500,
  pesoBidon: 9000,
  margenDefault: 50,
  costoManoObraDefault: 1500,
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export default function PricingCalculator() {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);
  const [products, setProducts] = useState<ProductCost[]>([]);

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
        setProducts(JSON.parse(savedProducts));
      } catch {
        // Sin productos
      }
    }
  }, []);

  // Guardar configuración
  const saveConfig = () => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  };

  // Guardar productos
  const saveProducts = () => {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
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
    };
    setProducts([...products, newProduct]);
  };

  // Actualizar producto
  const updateProduct = (id: string, field: keyof ProductCost, value: string | number) => {
    setProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Eliminar producto
  const removeProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Calcular costos de un producto
  const calculateCosts = (product: ProductCost) => {
    const costoBarbotina = (config.precioBarbotina / config.pesoBidon) * product.pesoGramos;
    const costoTotalCrudo = costoBarbotina + product.costoManoObra;
    const precioVentaCrudo = costoTotalCrudo * (1 + product.margen / 100);

    return {
      costoBarbotina,
      costoTotalCrudo,
      precioVentaCrudo,
    };
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Precio Barbotina (bidón)</Label>
              <Input
                type="number"
                value={config.precioBarbotina}
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
                onChange={(e) => setConfig(p => ({ ...p, pesoBidon: parseFloat(e.target.value) || 9000 }))}
                placeholder="9000"
              />
              <p className="text-xs text-muted-foreground">Peso total del bidón</p>
            </div>
            <div className="space-y-2">
              <Label>Costo Mano de Obra Default ($)</Label>
              <Input
                type="number"
                value={config.costoManoObraDefault}
                onChange={(e) => setConfig(p => ({ ...p, costoManoObraDefault: parseFloat(e.target.value) || 0 }))}
                placeholder="1500"
              />
              <p className="text-xs text-muted-foreground">Valor por defecto</p>
            </div>
            <div className="space-y-2">
              <Label>Margen Default (%)</Label>
              <Input
                type="number"
                value={config.margenDefault}
                onChange={(e) => setConfig(p => ({ ...p, margenDefault: parseFloat(e.target.value) || 0 }))}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">Margen por defecto</p>
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
            <Button onClick={saveProducts} variant="outline" size="sm">
              <Save className="w-4 h-4 mr-2" /> Guardar Todo
            </Button>
            <Button onClick={addProduct} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Agregar Producto
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Producto</TableHead>
                  <TableHead className="min-w-[120px]">Categoría</TableHead>
                  <TableHead className="min-w-[100px] text-center">Peso (g)</TableHead>
                  <TableHead className="min-w-[120px] text-right">Costo Barbotina</TableHead>
                  <TableHead className="min-w-[130px] text-center">Mano de Obra ($)</TableHead>
                  <TableHead className="min-w-[120px] text-right">Costo Total</TableHead>
                  <TableHead className="min-w-[100px] text-center">Margen (%)</TableHead>
                  <TableHead className="min-w-[130px] text-right">Precio Venta</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(product => {
                  const costs = calculateCosts(product);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Input
                          value={product.nombre}
                          onChange={(e) => updateProduct(product.id, 'nombre', e.target.value)}
                          placeholder="Nombre del producto"
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={product.categoria}
                          onValueChange={(value) => updateProduct(product.id, 'categoria', value)}
                        >
                          <SelectTrigger className="h-8 w-[110px]">
                            <SelectValue placeholder="Categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={product.pesoGramos || ''}
                          onChange={(e) => updateProduct(product.id, 'pesoGramos', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(costs.costoBarbotina)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={product.costoManoObra || ''}
                          onChange={(e) => updateProduct(product.id, 'costoManoObra', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-8 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(costs.costoTotalCrudo)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={product.margen || ''}
                          onChange={(e) => updateProduct(product.id, 'margen', parseFloat(e.target.value) || 0)}
                          placeholder="50"
                          className="h-8 text-center"
                        />
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(costs.precioVentaCrudo)}
                      </TableCell>
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
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No hay productos. Haz clic en "Agregar Producto" para comenzar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Fórmula explicada */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Fórmulas utilizadas:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Costo Barbotina</strong> = (Precio Barbotina ÷ Peso Bidón) × Peso Pieza</li>
              <li><strong>Costo Total Crudo</strong> = Costo Barbotina + Costo Mano de Obra</li>
              <li><strong>Precio Venta Crudo</strong> = Costo Total × (1 + Margen%)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Precio barbotina por gramo: {formatCurrency(config.precioBarbotina / config.pesoBidon)} / gramo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
