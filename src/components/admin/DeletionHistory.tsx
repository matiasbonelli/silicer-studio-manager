import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Undo2, RefreshCw, CreditCard, CalendarCheck, Package, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string;
  record_data: { first_name?: string; last_name?: string } & Record<string, unknown>;
  batch_id: string;
  deleted_at: string;
  restored_at: string | null;
}

interface BatchGroup {
  batch_id: string;
  student: AuditEntry;
  related: AuditEntry[];
}

export default function DeletionHistory() {
  const { toast } = useToast();
  const [batches, setBatches] = useState<BatchGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringBatch, setRestoringBatch] = useState<string | null>(null);
  const [discardingBatch, setDiscardingBatch] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    setLoading(true);

    const { data: studentRows, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('table_name', 'students')
      .is('restored_at', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      toast({ title: 'Error cargando historial', description: error.message, variant: 'destructive' });
      setBatches([]);
      setLoading(false);
      return;
    }

    const batchIds = (studentRows ?? []).map(r => r.batch_id);
    let relatedRows: AuditEntry[] = [];

    if (batchIds.length > 0) {
      const { data: rel } = await supabase
        .from('audit_log')
        .select('*')
        .in('batch_id', batchIds)
        .neq('table_name', 'students')
        .is('restored_at', null);
      relatedRows = (rel ?? []) as AuditEntry[];
    }

    const groups: BatchGroup[] = (studentRows ?? []).map(s => ({
      batch_id: s.batch_id,
      student: s as AuditEntry,
      related: relatedRows.filter(r => r.batch_id === s.batch_id),
    }));

    setBatches(groups);
    setLoading(false);
  }

  async function handleRestore(batchId: string) {
    setRestoringBatch(batchId);
    const { error } = await supabase.rpc('restore_audit_batch', { p_batch_id: batchId });
    setRestoringBatch(null);

    if (error) {
      toast({ title: 'Error al restaurar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Alumno restaurado correctamente' });
      fetchHistory();
    }
  }

  async function handleDiscard(batchId: string) {
    if (!confirm('¿Estás seguro? El alumno y sus registros relacionados se perderán para siempre y ya no se podrán restaurar.')) {
      return;
    }

    setDiscardingBatch(batchId);
    const { error } = await supabase.rpc('discard_audit_batch', { p_batch_id: batchId });
    setDiscardingBatch(null);

    if (error) {
      toast({ title: 'Error al descartar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Registro descartado definitivamente' });
      fetchHistory();
    }
  }

  function relatedCounts(related: AuditEntry[]) {
    const counts: Record<string, number> = {};
    for (const r of related) counts[r.table_name] = (counts[r.table_name] ?? 0) + 1;
    return counts;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-500" />
          <CardTitle>Historial de cambios</CardTitle>
        </div>
        <CardDescription>
          Alumnos eliminados recientemente. Podés restaurarlos junto con sus pagos, asistencias y pedidos de moldes asociados.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
          </div>
        ) : batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay eliminaciones recientes para restaurar.</p>
        ) : (
          <ul className="space-y-2">
            {batches.map(b => {
              const counts = relatedCounts(b.related);
              return (
                <li key={b.batch_id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="space-y-1">
                    <p className="font-medium">
                      {b.student.record_data.first_name} {b.student.record_data.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Eliminado el {new Date(b.student.deleted_at).toLocaleString('es-AR')}
                    </p>
                    {b.related.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {counts.payments && (
                          <Badge variant="secondary">
                            <CreditCard className="w-3 h-3 mr-1" />{counts.payments} pagos
                          </Badge>
                        )}
                        {counts.attendance && (
                          <Badge variant="secondary">
                            <CalendarCheck className="w-3 h-3 mr-1" />{counts.attendance} asistencias
                          </Badge>
                        )}
                        {counts.mold_orders && (
                          <Badge variant="secondary">
                            <Package className="w-3 h-3 mr-1" />{counts.mold_orders} pedidos
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRestore(b.batch_id)}
                      disabled={restoringBatch === b.batch_id || discardingBatch === b.batch_id}
                    >
                      {restoringBatch === b.batch_id
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <Undo2 className="w-4 h-4 mr-2" />}
                      Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDiscard(b.batch_id)}
                      disabled={restoringBatch === b.batch_id || discardingBatch === b.batch_id}
                    >
                      {discardingBatch === b.batch_id
                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        : <Trash2 className="w-4 h-4 mr-2" />}
                      Descartar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
