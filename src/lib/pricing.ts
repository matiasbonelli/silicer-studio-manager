// Fórmulas de costos compartidas entre la Calculadora de Costos y Ventas.
// Se centralizan acá para que la venta de servicios sobre "pieza del cliente"
// use exactamente las mismas reglas que la calculadora.

export const CAPACIDAD_HORNO = 8;

// Fracción del horno que ocupa cada pieza según categoría.
// "A medida" => null (usa el costo manual cargado en el producto).
export const CATEGORIAS_BLOQUES: Record<string, number | null> = {
  Tazas: 0.25,
  'Platos S': 0.09,
  'Platos M': 0.25,
  'Platos L': 0.33,
  'Platos XL': 0.5,
  'Bandejas y fuentes': 0.5,
  Jarras: 0.33,
  'Bowl XS': 0.09,
  'Bowl S': 0.12,
  'Bowl M': 0.166,
  'Bowl L': 0.25,
  'Bowl XL': 0.66,
  Compotera: 0.09,
  Locreras: 0.166,
  Pequeñeses: 0.05,
  'Mates y vasos': 0.0625,
  'A medida': null,
};

export const CATEGORIAS = Object.keys(CATEGORIAS_BLOQUES);

export interface PricingConfig {
  precioBarbotina: number;
  pesoBidon: number;
  margenDefault: number;
  costoManoObraDefault: number;
  costoHorneadoDefault: number;
  costoEsmaltadoDefault: number;
  precioEsmalteKg: number;
  porcentajeEsmalte: number;
}

export interface PricingProduct {
  id: string;
  nombre: string;
  categoria: string;
  pesoGramos: number;
  costoManoObra: number;
  margen: number;
  image_url: string | null;
  costoHorneado1: number;
  margenBizcochado: number;
  costoEsmaltado: number;
  costoHorneado2: number;
  margenFinal: number;
}

// Costo de horneado efectivo: si la categoría define bloques, se prorratea
// el costo total del horno; si es "A medida", se usa el valor manual.
export function getHorneadoCost(product: PricingProduct, config: PricingConfig): number {
  const bloqueValue = CATEGORIAS_BLOQUES[product.categoria];
  if (bloqueValue === null || bloqueValue === undefined) {
    return product.costoHorneado1;
  }
  return (config.costoHorneadoDefault / CAPACIDAD_HORNO) * bloqueValue;
}

export interface CalculatedCosts {
  costoBarbotina: number;
  costoTotalMolde: number;
  precioVentaMolde: number;
  horneadoCost: number;
  costoTotalBizcochado: number;
  precioVentaBizcochado: number;
  costoEsmalte: number;
  costoTotalFinal: number;
  precioVentaFinal: number;
}

// Calcula costos y precios de venta en las 3 etapas acumulativas.
// Cada etapa acumula el precio de la anterior + el nuevo servicio con su margen.
export function calculateCosts(product: PricingProduct, config: PricingConfig): CalculatedCosts {
  const costoBarbotina = (config.precioBarbotina / config.pesoBidon) * product.pesoGramos;
  const costoTotalMolde = costoBarbotina + product.costoManoObra;
  const precioVentaMolde = costoTotalMolde * (1 + product.margen / 100);

  const horneadoCost = getHorneadoCost(product, config);

  const costoTotalBizcochado = costoTotalMolde + horneadoCost;
  const precioVentaBizcochado = precioVentaMolde + horneadoCost * (1 + product.margenBizcochado / 100);

  const costoEsmalte = product.pesoGramos * (config.porcentajeEsmalte / 100) * (config.precioEsmalteKg / 1000);

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
}

export type CustomerPieceStage = 'bizcochado' | 'final';

// Precio cuando el cliente trae su propia pieza y solo paga los servicios.
// No incluye ni barbotina ni mano de obra ni margen del molde.
export function calculateCustomerPiecePrice(params: {
  product: PricingProduct;
  config: PricingConfig;
  targetStage: CustomerPieceStage;
}): number {
  const { product, config, targetStage } = params;
  const horneadoCost = getHorneadoCost(product, config);

  const precioBizcocho = horneadoCost * (1 + product.margenBizcochado / 100);

  if (targetStage === 'bizcochado') {
    return precioBizcocho;
  }

  const costoEsmalte = product.pesoGramos * (config.porcentajeEsmalte / 100) * (config.precioEsmalteKg / 1000);
  const costoEtapa3 = costoEsmalte + horneadoCost;
  return precioBizcocho + costoEtapa3 * (1 + product.margenFinal / 100);
}

// Deriva el pricing_product_id desde el inventory.description.
// Formato esperado: "molde-<uuid>" | "bizcochado-<uuid>" | "final-<uuid>"
export function extractPricingProductId(description: string | null | undefined): string | null {
  if (!description) return null;
  const match = description.match(/^(molde|bizcochado|final)-(.+)$/);
  return match ? match[2] : null;
}

// Sanea un input numérico con fallback/min/max. Evita NaN/Infinity cuando el
// usuario borra el campo o ingresa valores fuera de rango.
export function parseNumberSafe(
  value: string,
  opts: { min?: number; max?: number; fallback?: number } = {}
): number {
  const { min = -Infinity, max = Infinity, fallback = 0 } = opts;
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}
