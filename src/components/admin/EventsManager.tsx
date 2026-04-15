import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sendWhatsApp } from '@/lib/whatsapp';
import { MessageSquare, Plus, Pencil, Trash2, Send, Users, User, Loader2, Cake, CreditCard, CalendarCheck, Megaphone } from 'lucide-react';

type EventType = 'birthday' | 'payment_reminder' | 'welcome' | 'custom';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  birthday: 'Cumpleaños',
  payment_reminder: 'Recordatorio de Pago',
  welcome: 'Bienvenida',
  custom: 'Personalizado',
};

const EVENT_TYPE_ICONS: Record<EventType, typeof Cake> = {
  birthday: Cake,
  payment_reminder: CreditCard,
  welcome: CalendarCheck,
  custom: Megaphone,
};

interface MessageTemplate {
  id: string;
  type: EventType;
  name: string;
  message: string;
}

const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-birthday',
    type: 'birthday',
    name: 'Feliz Cumpleaños',
    message: '¡Feliz cumpleaños {nombre}! 🎂🎉 Te saluda todo el equipo de Silicer Studio. ¡Que tengas un hermoso día!',
  },
  {
    id: 'tpl-payment',
    type: 'payment_reminder',
    name: 'Recordatorio de Cuota',
    message: 'Hola {nombre}, te recordamos que tenés la cuota del mes pendiente en Silicer. Si ya transferiste o pagaste en efectivo, recordanos o envíanos el comprobante. ¡Cualquier consulta escribinos!\n\n_Esto es un mensaje automático._',
  },
  {
    id: 'tpl-welcome',
    type: 'welcome',
    name: 'Bienvenida',
    message: '¡Hola {nombre}! 👋 Bienvenido/a a Silicer Studio. Estamos felices de que te sumes al taller. ¡Te esperamos!',
  },
];

export default function EventsManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: '', type: 'custom' as EventType, message: '' });
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [targetType, setTargetType] = useState<'all' | 'pending' | 'individual'>('all');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase.from('students').select('*').order('last_name');
      if (data) setStudents(data as Student[]);
      setLoading(false);
    };
    fetchStudents();
    setTemplates(DEFAULT_TEMPLATES);
  }, []);

  const saveTemplates = (updated: MessageTemplate[]) => {
    setTemplates(updated);
  };

  const openTemplateModal = (template?: MessageTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({ name: template.name, type: template.type, message: template.message });
    } else {
      setEditingTemplate(null);
      setTemplateForm({ name: '', type: 'custom', message: '' });
    }
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.message) {
      toast({ title: 'Completá nombre y mensaje', variant: 'destructive' });
      return;
    }

    if (editingTemplate) {
      const updated = templates.map(t =>
        t.id === editingTemplate.id ? { ...t, ...templateForm } : t
      );
      saveTemplates(updated);
      toast({ title: 'Plantilla actualizada' });
    } else {
      const newTemplate: MessageTemplate = {
        id: `tpl-${Date.now()}`,
        ...templateForm,
      };
      saveTemplates([...templates, newTemplate]);
      toast({ title: 'Plantilla creada' });
    }
    setIsTemplateModalOpen(false);
  };

  const handleDeleteTemplate = (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    saveTemplates(templates.filter(t => t.id !== id));
    toast({ title: 'Plantilla eliminada' });
  };

  const openSendModal = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setTargetType('all');
    setSelectedStudentId('');
    setSendModalOpen(true);
  };

  const getTargetStudents = (): Student[] => {
    if (targetType === 'individual') {
      return students.filter(s => s.id === selectedStudentId);
    }
    if (targetType === 'pending') {
      return students.filter(s => s.payment_status === 'pending' || s.payment_status === 'partial');
    }
    return students;
  };

  const handleSendWhatsApp = (phone: string, message: string) => {
    sendWhatsApp(phone, message, toast);
  };

  const personalizeMessage = (template: string, student: Student) => {
    return template
      .replace(/\{nombre\}/g, student.first_name)
      .replace(/\{apellido\}/g, student.last_name)
      .replace(/\{nombre_completo\}/g, `${student.first_name} ${student.last_name}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const targetStudents = sendModalOpen ? getTargetStudents() : [];

  return (
    <div className="space-y-6">
      {/* Templates Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Plantillas de Mensajes
          </CardTitle>
          <Button size="sm" onClick={() => openTemplateModal()}>
            <Plus className="w-4 h-4 mr-2" /> Nueva Plantilla
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Mensaje</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map(template => {
                  const Icon = EVENT_TYPE_ICONS[template.type];
                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          <Icon className="w-3 h-3" />
                          {EVENT_TYPE_LABELS[template.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm text-muted-foreground line-clamp-1 max-w-md">{template.message}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="default" onClick={() => openSendModal(template)}>
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openTemplateModal(template)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeleteTemplate(template.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No hay plantillas. Creá una para empezar a enviar mensajes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Variables info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Variables disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{'{nombre}'} - Nombre del alumno</Badge>
            <Badge variant="secondary">{'{apellido}'} - Apellido</Badge>
            <Badge variant="secondary">{'{nombre_completo}'} - Nombre y apellido</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Template Editor Modal */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Evento</Label>
              <Select
                value={templateForm.type}
                onValueChange={(v) => setTemplateForm(prev => ({ ...prev, type: v as EventType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(type => (
                    <SelectItem key={type} value={type}>{EVENT_TYPE_LABELS[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Feliz Cumpleaños"
              />
            </div>
            <div className="space-y-2">
              <Label>Mensaje</Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={templateForm.message}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Hola {nombre}, ..."
              />
              <p className="text-xs text-muted-foreground">
                Usá {'{nombre}'}, {'{apellido}'} o {'{nombre_completo}'} para personalizar
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Modal */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" /> Enviar: {selectedTemplate?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Target selector */}
            <div className="space-y-2">
              <Label>Destinatarios</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={targetType === 'all' ? 'default' : 'outline'}
                  onClick={() => setTargetType('all')}
                  className="flex-1"
                >
                  <Users className="w-4 h-4 mr-1" /> Todos
                </Button>
                <Button
                  size="sm"
                  variant={targetType === 'pending' ? 'default' : 'outline'}
                  onClick={() => setTargetType('pending')}
                  className="flex-1"
                >
                  <CreditCard className="w-4 h-4 mr-1" /> Pago Pendiente
                </Button>
                <Button
                  size="sm"
                  variant={targetType === 'individual' ? 'default' : 'outline'}
                  onClick={() => setTargetType('individual')}
                  className="flex-1"
                >
                  <User className="w-4 h-4 mr-1" /> Individual
                </Button>
              </div>
            </div>

            {targetType === 'individual' && (
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar alumno" />
                </SelectTrigger>
                <SelectContent>
                  {students.filter(s => s.phone).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Preview */}
            {selectedTemplate && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Vista previa del mensaje:</p>
                <p className="text-sm italic">
                  "{selectedTemplate.message.replace(/\{nombre\}/g, 'Juan').replace(/\{apellido\}/g, 'Pérez').replace(/\{nombre_completo\}/g, 'Juan Pérez')}"
                </p>
              </div>
            )}

            {/* Student list with send buttons */}
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {targetStudents.filter(s => s.phone).length} alumno(s) con teléfono
              </p>
              <div className="rounded-lg border max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alumno</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead className="text-center">Enviar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {targetStudents.map(student => {
                      if (!student.phone) return null;
                      const message = selectedTemplate ? personalizeMessage(selectedTemplate.message, student) : '';
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium text-sm">
                            {student.first_name} {student.last_name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {student.phone}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleSendWhatsApp(student.phone, message)}
                            >
                              <Send className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {targetStudents.filter(s => s.phone).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                          No hay alumnos con teléfono para este filtro
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
