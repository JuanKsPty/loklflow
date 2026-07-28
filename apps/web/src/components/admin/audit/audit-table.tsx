import { ScrollTextIcon } from 'lucide-react';
import type { AuditLog } from '@loklflow/types';
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from '@loklflow/types';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { AUDIT_ACTION_BADGE } from './constants';

interface Props {
  logs: AuditLog[];
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(value));
}

/** Claves cuyo valor cambió entre el antes y el después. */
function changedKeys(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
): string[] {
  if (!oldValue || !newValue) return [];
  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
  return [...keys].filter(
    (k) => JSON.stringify(oldValue[k]) !== JSON.stringify(newValue[k]),
  );
}

/**
 * Los valores son jsonb arbitrario, así que un resumen en la celda y el detalle en un
 * <details> nativo: sin JavaScript y sin romper el ancho de la tabla.
 */
function ValueCell({ log }: { log: AuditLog }) {
  const changed = changedKeys(log.oldValue, log.newValue);
  const hasData = log.oldValue !== null || log.newValue !== null;

  if (!hasData) return <span className="text-muted-foreground">—</span>;

  const summary =
    changed.length > 0
      ? changed.join(', ')
      : log.oldValue && !log.newValue
        ? 'valor anterior'
        : 'detalle';

  return (
    <details className="group">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-xs underline decoration-dotted underline-offset-2">
        {summary}
      </summary>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {log.oldValue && (
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1 text-[0.7rem] uppercase tracking-wide">
              Antes
            </p>
            <pre className="bg-muted/50 max-h-48 overflow-auto rounded-md p-2 text-[0.7rem] leading-relaxed">
              {JSON.stringify(log.oldValue, null, 2)}
            </pre>
          </div>
        )}
        {log.newValue && (
          <div className="min-w-0">
            <p className="text-muted-foreground mb-1 text-[0.7rem] uppercase tracking-wide">
              Después
            </p>
            <pre className="bg-muted/50 max-h-48 overflow-auto rounded-md p-2 text-[0.7rem] leading-relaxed">
              {JSON.stringify(log.newValue, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

export function AuditTable({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ScrollTextIcon />
          </EmptyMedia>
          <EmptyTitle>Sin registros</EmptyTitle>
          <EmptyDescription>
            No hay acciones que coincidan con estos filtros.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-44">Fecha</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Autor</TableHead>
            <TableHead>Entidad</TableHead>
            <TableHead>Cambios</TableHead>
            <TableHead className="w-32">IP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="align-top">
              <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                {formatDateTime(log.createdAt)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={AUDIT_ACTION_BADGE[log.action]}>
                  {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">
                {/* Sin autor: acciones del sistema o intentos de login sin sesión. */}
                {log.userName ?? (log.userId ? log.userId.slice(0, 8) : 'Sistema')}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {log.entityType ? AUDIT_ENTITY_LABELS[log.entityType] : '—'}
              </TableCell>
              <TableCell className="max-w-xs">
                <ValueCell log={log} />
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">
                {log.ipAddress ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
