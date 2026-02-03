import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, Settings, Save } from 'lucide-react';

const STORAGE_KEY = 'silicer-pricing-config';

interface PricingConfig {
  precioBarbotina: number;
  pesoBidon: number;
  margenDefault: number;
}

const defaultConfig: PricingConfig = {
  precioBarbotina: 11500,
  pesoBidon: 9000,
  margenDefault: 50,
};

export default function PricingCalculator() {
  const [config, setConfig] = useState<PricingConfig>(defaultConfig);

  // Inputs para calcular
  const [pesoPieza, setPesoPieza] = useState<string>('');
  const [costoManoObra, setCostoManoObra] = useState<string>('');
  const [margen, setMargen] = useState<string>('50');

  // Resultados
  const [costoMateriaPrima, setCostoMateriaPrima] = useState<number>(0);
  const [costoTotal, setCostoTotal] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);

  // Cargar configuración guardada
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        setMargen(parsed.margenDefault.toString());
      } catch {
        // Usar default
      }
    }
  }, []);

  // Guardar configuración
  const saveConfig = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  };

  // Calcular precios cuando cambian los inputs
  useEffect(() => {
    const peso = parseFloat(pesoPieza) || 0;
    const manoObra = parseFloat(costoManoObra) || 0;
    const margenPct = parseFloat(margen) || 0;

    // Fórmula: (PRECIO_BARBOTINA / PESO_BIDON) × PESO_PIEZA
    const materiaPrima = (config.precioBarbotina / config.pesoBidon) * peso;
    setCostoMateriaPrima(materiaPrima);

    const total = materiaPrima + manoObra;
    setCostoTotal(total);

    const venta = total * (1 + margenPct / 100);
    setPrecioVenta(venta);
  }, [pesoPieza, costoManoObra, margen, config]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
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
                onChange={(e) => setConfig(p => ({ ...p, precioBarbotina: parseFloat(e.target.value) || 0 }))}
                placeholder="11500"
              />
              <p className="text-xs text-muted-foreground">Precio del bidón completo en pesos</p>
            </div>
            <div className="space-y-2">
              <Label>Peso del Bidón (gramos)</Label>
              <Input
                type="number"
                value={config.pesoBidon}
                onChange={(e) => setConfig(p => ({ ...p, pesoBidon: parseFloat(e.target.value) || 9000 }))}
                placeholder="9000"
              />
              <p className="text-xs text-muted-foreground">Peso total del bidón de barbotina</p>
            </div>
            <div className="space-y-2">
              <Label>Margen Default (%)</Label>
              <Input
                type="number"
                value={config.margenDefault}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setConfig(p => ({ ...p, margenDefault: val }));
                  setMargen(val.toString());
                }}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">Margen de ganancia por defecto</p>
            </div>
          </div>
          <Button onClick={saveConfig} className="mt-4" variant="outline">
            <Save className="w-4 h-4 mr-2" /> Guardar Configuración
          </Button>
        </CardContent>
      </Card>

      {/* Calculadora */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Calculadora de Precio - Etapa Crudo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="space-y-2">
              <Label>Peso de la Pieza (gramos)</Label>
              <Input
                type="number"
                value={pesoPieza}
                onChange={(e) => setPesoPieza(e.target.value)}
                placeholder="Ej: 500"
              />
            </div>
            <div className="space-y-2">
              <Label>Costo Mano de Obra ($)</Label>
              <Input
                type="number"
                value={costoManoObra}
                onChange={(e) => setCostoManoObra(e.target.value)}
                placeholder="Ej: 1500"
              />
            </div>
            <div className="space-y-2">
              <Label>Margen de Ganancia (%)</Label>
              <Input
                type="number"
                value={margen}
                onChange={(e) => setMargen(e.target.value)}
                placeholder="50"
              />
            </div>
          </div>

          {/* Resultados */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Resultados</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Costo Materia Prima</p>
                <p className="text-2xl font-bold">{formatCurrency(costoMateriaPrima)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({formatCurrency(config.precioBarbotina)} / {config.pesoBidon}g) × {pesoPieza || 0}g
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Costo Total Crudo</p>
                <p className="text-2xl font-bold">{formatCurrency(costoTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Materia prima + Mano de obra
                </p>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg border-2 border-primary">
                <p className="text-sm text-muted-foreground">Precio de Venta</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(precioVenta)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Con {margen || 0}% de margen
                </p>
              </div>
            </div>
          </div>

          {/* Fórmula explicada */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Fórmula utilizada:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li><strong>Costo Materia Prima</strong> = (Precio Barbotina ÷ Peso Bidón) × Peso Pieza</li>
              <li><strong>Costo Total</strong> = Costo Materia Prima + Costo Mano de Obra</li>
              <li><strong>Precio Venta</strong> = Costo Total × (1 + Margen%)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
