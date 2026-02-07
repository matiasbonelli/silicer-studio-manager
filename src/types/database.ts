export type PaymentStatus = 'paid' | 'pending' | 'partial';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mercadopago';
export type AppRole = 'admin' | 'user';

export interface Schedule {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  created_at: string;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  schedule_id: string | null;
  payment_status: PaymentStatus;
  paid_amount: number | null;
  payment_date: string | null;
  payment_month: string | null;
  payment_receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  schedule?: Schedule;
}

export type ProductCategory = 'insumos' | 'servicios' | 'moldes';

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  min_stock: number;
  price: number;
  cost: number;
  for_sale: boolean;
  category: ProductCategory | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  student_id: string | null;
  total_amount: number;
  paid_amount: number | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  student?: Student;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  inventory_id: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  inventory?: InventoryItem;
}

export interface Enrollment {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  schedule_id: string;
  message: string | null;
  status: string;
  created_at: string;
  schedule?: Schedule;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export const DAY_NAMES: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  partial: 'Parcial',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  mercadopago: 'MercadoPago',
};

export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  insumos: 'Insumos',
  servicios: 'Servicios',
  moldes: 'Moldes',
};

export const MONTH_NAMES: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};
