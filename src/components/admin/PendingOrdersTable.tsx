import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface OrderStage {
  id: string;
  stage_name: string;
  status: string;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  product_name: string;
  quantity: number;
  stages: OrderStage[];
}

export default function PendingOrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_stages (*), customer (*), order_stages:order_stages(*)`)
        .filter('order_stages.status', 'not.eq', 'completado')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching pending orders', error);
        return;
      }
      const mapped = data.map((o: any) => ({
        id: o.id,
        created_at: o.created_at,
        customer_name: o.customer?.full_name || o.customer?.email || 'Sin cliente',
        product_name: o.order_stages?.[0]?.product_name || 'Producto desconocido',
        quantity: o.order_stages?.[0]?.quantity || 0,
        stages: o.order_stages?.map((s: any) => ({
          id: s.id,
          stage_name: s.stage_name,
          status: s.status,
        })) || [],
      }));
      setOrders(mapped);
      setLoading(false);
    }
    fetchOrders();
  }, []);

  if (loading) return <p>Cargando pedidos pendientes...</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Cantidad</TableHead>
          <TableHead>Molde</TableHead>
          <TableHead>Bizcocho</TableHead>
          <TableHead>Final</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map(order => (
          <TableRow key={order.id}>
            <TableCell>{new Date(order.created_at).toLocaleDateString('es-AR')}</TableCell>
            <TableCell>{order.customer_name}</TableCell>
            <TableCell>{order.product_name}</TableCell>
            <TableCell>{order.quantity}</TableCell>
            <TableCell>
              {order.stages.find(s => s.stage_name === 'molde')?.status === 'completado' ? (
                <Badge className="bg-green-500">Completado</Badge>
              ) : (
                <Badge variant="destructive">Pendiente</Badge>
              )}
            </TableCell>
            <TableCell>
              {order.stages.find(s => s.stage_name === 'bizcocho')?.status === 'completado' ? (
                <Badge className="bg-green-500">Completado</Badge>
              ) : (
                <Badge variant="destructive">Pendiente</Badge>
              )}
            </TableCell>
            <TableCell>
              {order.stages.find(s => s.stage_name === 'final')?.status === 'completado' ? (
                <Badge className="bg-green-500">Completado</Badge>
              ) : (
                <Badge variant="destructive">Pendiente</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
