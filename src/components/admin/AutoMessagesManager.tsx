import { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { MESSAGE_TEMPLATES, fetchMessageTemplates, saveMessageTemplate } from '@/lib/messageTemplates';
import { RotateCcw, Save, Loader2 } from 'lucide-react';

export default function AutoMessagesManager() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMessageTemplates()
      .then(setValues)
      .catch(() => toast({ title: 'Error al cargar los mensajes', variant: 'destructive' }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = (key: string, defaultMessage: string) => {
    handleChange(key, defaultMessage);
  };

  const handleSave = async (key: string) => {
    setSavingKey(key);
    try {
      await saveMessageTemplate(key, values[key] ?? '');
      toast({ title: 'Mensaje guardado' });
    } catch {
      toast({ title: 'Error al guardar el mensaje', variant: 'destructive' });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Editá el texto que se prellena en WhatsApp para cada mensaje automático del sistema. Usá las
        variables entre llaves para que se completen con los datos de cada alumno o pedido.
      </p>

      <Accordion type="multiple" className="rounded-lg border px-4">
        {MESSAGE_TEMPLATES.map((tpl) => (
          <AccordionItem key={tpl.key} value={tpl.key}>
            <AccordionTrigger className="text-left">
              <div>
                <p className="font-medium">{tpl.title}</p>
                <p className="text-xs font-normal text-muted-foreground">{tpl.description}</p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {tpl.placeholders.map((p) => (
                  <code key={p} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {`{${p}}`}
                  </code>
                ))}
              </div>

              <Textarea
                value={values[tpl.key] ?? ''}
                onChange={(e) => handleChange(tpl.key, e.target.value)}
                rows={5}
                className="text-sm"
              />

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset(tpl.key, tpl.defaultMessage)}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Restaurar predeterminado
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSave(tpl.key)}
                  disabled={savingKey === tpl.key}
                >
                  {savingKey === tpl.key ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Guardar
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
