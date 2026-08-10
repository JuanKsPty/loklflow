import { ScrollTextIcon } from 'lucide-react';
import type { StockMovement } from '@loklflow/types';
import { INGREDIENT_UNIT_LABELS, STOCK_MOVEMENT_LABELS } from '@loklflow/types';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

interface Props {
  movements: StockMovement[];
}

const TYPE_STYLE: Record<string, string> = {
  entry: 'border-success/30 bg-success/10 text-success',
  consumption: 'border-border bg-muted text-muted-foreground',
  waste: 'border-destructive/30 bg-destructive/10 text-destructive',
  adjustment: 'border-info/30 bg-info/10 text-info',
};

/**
 * El libro mayor del inventario, tal cual: append-only y con los snapshots de antes y después.
 * Es lo que permite explicar, dentro de seis meses, cómo se llegó al número que hay hoy.
 */
export function MovementTable({ movements }: Props) {
  if (movements.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ScrollTextIcon />
          </EmptyMedia>
          <EmptyTitle>Sin movimientos</EmptyTitle>
          <EmptyDescription>
            Aquí aparece cada entrada, merma, ajuste y consumo por venta, con las existencias
            antes y después.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Ingrediente</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Cantidad</TableHead>
            <TableHead className="text-right">Resultado</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {new Date(m.createdAt).toLocaleString('es', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </TableCell>
              <TableCell className="font-medium">{m.ingredient?.name ?? '—'}</TableCell>
              <TableCell>
                <Badge variant="outline" className={TYPE_STYLE[m.type]}>
                  {STOCK_MOVEMENT_LABELS[m.type]}
                </Badge>
              </TableCell>
              <TableCell
                className={cn(
                  'text-right tabular-nums font-medium',
                  m.quantity < 0 ? 'text-destructive' : 'text-success',
                )}
              >
                {m.quantity > 0 ? '+' : ''}
                {m.quantity}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {m.previousStock} → {m.newStock}
                {m.ingredient ? ` ${INGREDIENT_UNIT_LABELS[m.ingredient.unit]}` : ''}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {m.supplier?.name ?? m.reason ?? (m.orderId ? 'Venta' : '—')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
