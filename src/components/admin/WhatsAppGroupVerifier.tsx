import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, CheckCircle2, AlertCircle, HelpCircle, Copy, RefreshCw, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Componente: número copiable con un click
// ---------------------------------------------------------------------------

function CopyablePhone({ phone, className = '' }: { phone: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(phone).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Click para copiar"
      className={`inline-flex items-center gap-1 font-mono rounded px-1 transition-colors
        hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer select-all
        ${copied ? 'text-emerald-600 dark:text-emerald-400' : ''} ${className}`}
    >
      {phone}
      {copied
        ? <Check className="w-3 h-3 shrink-0" />
        : <Copy className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers de normalización de teléfonos
// ---------------------------------------------------------------------------

/** Devuelve sólo los dígitos, normalizados al formato local sin prefijos */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // Quitar prefijo internacional 54 (ej: 5493584026442 → 93584026442)
  if (digits.startsWith('54')) digits = digits.slice(2);

  // Quitar el 9 de prefijo móvil que usa WhatsApp internacionalmente
  // (ej: 93584026442 → 3584026442). Solo si quedan más de 10 dígitos.
  if (digits.startsWith('9') && digits.length > 10) digits = digits.slice(1);

  // Quitar 0 inicial (discado nacional, ej: 03584... → 3584...)
  if (digits.startsWith('0')) digits = digits.slice(1);

  // Quitar 15 inicial (celular estilo viejo, ej: 1526... → 26...)
  if (digits.startsWith('15') && digits.length > 10) digits = digits.slice(2);

  return digits;
}

/**
 * Convierte un número (en cualquier formato en que esté cargado en el sistema)
 * al formato internacional que WhatsApp necesita para BUSCAR/AGREGAR un contacto
 * al grupo: +54 9 <código de área><número local>.
 *
 * Ej: "3584026442"        → "+54 9 3584026442"
 *     "0358 15 402-6442"  → "+54 9 3584026442"
 *     "+54 9 3586014698"  → "+54 9 3586014698"
 *
 * Pegar el número "pelado" (sin +54 9) en "Agregar participante" de WhatsApp falla:
 * WhatsApp necesita el código de país (54) y el prefijo de celular (9) para
 * encontrar el contacto correctamente.
 */
function toWhatsAppFormat(raw: string): string {
  let digits = normalizePhone(raw);

  // Si quedaron sólo 7 dígitos (cargaron el número local sin código de área),
  // anteponemos el código de área del estudio (358).
  if (digits.length === 7) digits = `358${digits}`;

  return `+54 9 ${digits}`;
}

/** Extrae todos los números de un bloque de texto (un número por línea o separados por comas/espacios) */
function extractNumbers(text: string): string[] {
  // Separar por saltos de línea, comas o punto y coma
  const parts = text.split(/[\n,;]+/);
  return parts
    .map(p => normalizePhone(p.trim()))
    .filter(p => p.length >= 8); // descartar cadenas muy cortas
}

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------

interface MatchResult {
  inBoth: Student[];         // en sistema Y en grupo
  onlyInSystem: Student[];   // en sistema pero NO en grupo
  onlyInGroup: string[];     // en grupo pero NO en sistema (número normalizado)
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function WhatsAppGroupVerifier() {
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [wspText, setWspText] = useState('');
  const [result, setResult] = useState<MatchResult | null>(null);

  // Cargar alumnos activos al montar
  useEffect(() => {
    fetchStudents();
  }, []);

  async function fetchStudents() {
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('first_name');

    if (error) {
      toast({ title: 'Error cargando alumnos', description: error.message, variant: 'destructive' });
    } else {
      setStudents((data as Student[]) ?? []);
    }
    setLoadingStudents(false);
  }

  // ---------------------------------------------------------------------------
  // Comparación
  // ---------------------------------------------------------------------------

  function compare() {
    if (!wspText.trim()) {
      toast({ title: 'Pegá los números del grupo primero', variant: 'destructive' });
      return;
    }

    const wspNumbers = new Set(extractNumbers(wspText));

    // Alumnos con teléfono cargado
    const studentsWithPhone = students.filter(s => s.phone);

    const inBoth: Student[] = [];
    const onlyInSystem: Student[] = [];
    const matchedWsp = new Set<string>();

    for (const s of studentsWithPhone) {
      const norm = normalizePhone(s.phone!);
      if (wspNumbers.has(norm)) {
        inBoth.push(s);
        matchedWsp.add(norm);
      } else {
        onlyInSystem.push(s);
      }
    }

    // Números en el grupo que no matchearon ningún alumno
    const onlyInGroup = [...wspNumbers].filter(n => !matchedWsp.has(n));

    setResult({ inBoth, onlyInSystem, onlyInGroup });
  }

  function reset() {
    setWspText('');
    setResult(null);
  }

  function copyList(items: string[]) {
    navigator.clipboard.writeText(items.join('\n'));
    toast({ title: 'Copiado al portapapeles' });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-500" />
          <CardTitle>Verificador de Grupo WhatsApp</CardTitle>
        </div>
        <CardDescription>
          Compará los alumnos del sistema con los integrantes de tu grupo de WhatsApp para detectar quiénes faltan agregar o fueron removidos.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">

        {/* Estado de carga */}
        {loadingStudents ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Cargando alumnos…</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {students.filter(s => s.phone).length} alumnos con teléfono cargado de {students.length} totales.
          </p>
        )}

        {/* Input de números */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Pegá aquí los números del grupo de WhatsApp
          </label>
          <Textarea
            placeholder={`+54 11 1234-5678\n+54 9 351 123 4567\n1123456789\n…`}
            value={wspText}
            onChange={e => { setWspText(e.target.value); setResult(null); }}
            rows={6}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Podés pegar uno por línea, con o sin el +54, con espacios o guiones. El sistema los normaliza automáticamente.
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-2">
          <Button onClick={compare} disabled={loadingStudents || !wspText.trim()}>
            <MessageCircle className="w-4 h-4 mr-2" />
            Comparar
          </Button>
          {result && (
            <Button variant="outline" onClick={reset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={fetchStudents} disabled={loadingStudents} className="ml-auto">
            <RefreshCw className={`w-4 h-4 mr-1 ${loadingStudents ? 'animate-spin' : ''}`} />
            Actualizar alumnos
          </Button>
        </div>

        {/* Resultados */}
        {result && (
          <div className="grid gap-4 pt-2 md:grid-cols-3">

            {/* En ambos */}
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800 dark:text-green-300">En el grupo ✓</span>
                </div>
                <Badge variant="secondary">{result.inBoth.length}</Badge>
              </div>
              <p className="text-xs text-green-700 dark:text-green-400">Estos alumnos ya están en el grupo.</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {result.inBoth.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm text-green-900 dark:text-green-200">
                    <span>{s.first_name} {s.last_name}</span>
                    <CopyablePhone phone={s.phone!} className="text-xs text-green-600 dark:text-green-400" />
                  </li>
                ))}
                {result.inBoth.length === 0 && <li className="text-xs text-green-600">Ninguno</li>}
              </ul>
            </div>

            {/* En sistema pero no en grupo */}
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <span className="font-medium text-yellow-800 dark:text-yellow-300">Faltan en el grupo</span>
                </div>
                <Badge variant="secondary">{result.onlyInSystem.length}</Badge>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                Están en el sistema pero no en el grupo de WhatsApp. El número ya está normalizado al formato
                internacional — copialo con un click y pegalo directo en "Agregar participante" del grupo.
              </p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {result.onlyInSystem.map(s => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm text-yellow-900 dark:text-yellow-200">
                    <span>{s.first_name} {s.last_name}</span>
                    <CopyablePhone phone={toWhatsAppFormat(s.phone!)} className="text-xs text-yellow-600 dark:text-yellow-400" />
                  </li>
                ))}
                {result.onlyInSystem.length === 0 && <li className="text-xs text-yellow-600">Ninguno — ¡todos están!</li>}
              </ul>
              {result.onlyInSystem.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-yellow-300 text-yellow-800 hover:bg-yellow-100 dark:text-yellow-300"
                  onClick={() => copyList(result.onlyInSystem.map(s => `${s.first_name} ${s.last_name}: ${toWhatsAppFormat(s.phone!)}`))}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copiar lista
                </Button>
              )}
            </div>

            {/* En grupo pero no en sistema */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-700 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">Desconocidos</span>
                </div>
                <Badge variant="secondary">{result.onlyInGroup.length}</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Están en el grupo pero no figuran en el sistema.</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto">
                {result.onlyInGroup.map(n => (
                  <li key={n}>
                    <CopyablePhone phone={n} className="text-sm text-slate-700 dark:text-slate-300" />
                  </li>
                ))}
                {result.onlyInGroup.length === 0 && <li className="text-xs text-slate-500">Ninguno</li>}
              </ul>
              {result.onlyInGroup.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => copyList(result.onlyInGroup)}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copiar números
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Alumnos sin teléfono */}
        {!loadingStudents && students.filter(s => !s.phone).length > 0 && (
          <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3">
            <p className="text-sm text-orange-800 dark:text-orange-300 font-medium">
              ⚠️ {students.filter(s => !s.phone).length} alumno(s) sin teléfono cargado en el sistema:
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
              {students.filter(s => !s.phone).map(s => `${s.first_name} ${s.last_name}`).join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
