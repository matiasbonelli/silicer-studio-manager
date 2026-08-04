import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, History, MessageSquareText } from 'lucide-react';
import WhatsAppGroupVerifier from './WhatsAppGroupVerifier';
import DeletionHistory from './DeletionHistory';
import AutoMessagesManager from './AutoMessagesManager';

export default function UtilitiesManager() {
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Utilidades</h2>
        <p className="text-muted-foreground mt-1">Herramientas operativas para el día a día del estudio.</p>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp" className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 shrink-0" />
            Comparador de WhatsApp
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="w-4 h-4 shrink-0" />
            Historial de cambios
          </TabsTrigger>
          <TabsTrigger value="auto-messages" className="flex items-center gap-1.5">
            <MessageSquareText className="w-4 h-4 shrink-0" />
            Respuestas automáticas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <WhatsAppGroupVerifier />
        </TabsContent>

        <TabsContent value="history">
          <DeletionHistory />
        </TabsContent>

        <TabsContent value="auto-messages">
          <AutoMessagesManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
