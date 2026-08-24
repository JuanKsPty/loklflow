import { PackageIcon, TriangleAlertIcon } from 'lucide-react';
import type { ProductStock } from '@loklflow/types';
import { INGREDIENT_UNIT_LABELS } from '@loklflow/types';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CardList, TableFrame } from '@/components/admin/dual-render';
import { SetStockDialog } from './set-stock-dialog';

interface Props {
  products: ProductStock[];
}

/** Lo que se lee de un vistazo: cuánto queda, o que no se está contando. */
function Cantidad({ p, grande }: { p: ProductStock; grande?: boolean }) {
  if (!p.tracked) {
    return <span className="text-sm text-muted-foreground">Sin control</span>;
  }
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        grande ? 'text-xl font-semibold' : 'font-medium',
        p.currentStock !== null && p.currentStock < 0 && 'text-destructive',
        p.lowStock && (p.currentStock ?? 0) >= 0 && 'text-warning',
      )}
    >
      {p.currentStock}
      {p.unit ? ` ${INGREDIENT_UNIT_LABELS[p.unit]}` : ''}
    </span>
  );
}

function Estado({ p }: { p: ProductStock }) {
  if (!p.tracked) return null;
  if (p.currentStock !== null && p.currentStock < 0) {
    return (
      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
        En negativo
      </Badge>
    );
  }
  if (p.lowStock) {
    return (
      <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
        <TriangleAlertIcon className="size-3" />
        Se acaba
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
      Hay
    </Badge>
  );
}

export function ProductStockTable({ products }: Props) {
  if (products.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon />
          </EmptyMedia>
          <EmptyTitle>Sin productos</EmptyTitle>
          <EmptyDescription>
            Carga el catálogo para empezar a llevar sus existencias.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <CardList>
        {products.map((p) => (
          <li key={p.productId} className="rounded-xl border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatPrice(p.price)}
                  {p.categoryName ? ` · ${p.categoryName}` : ''}
                </p>
              </div>
              <Estado p={p} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <Cantidad p={p} grande />
                {p.tracked && (p.minimumStock ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Mínimo {p.minimumStock}
                  </p>
                )}
              </div>
              <SetStockDialog product={p} />
            </div>
          </li>
        ))}
      </CardList>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Existencias</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.productId}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.categoryName ?? '—'}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatPrice(p.price)}
                </TableCell>
                <TableCell className="text-right">
                  <Cantidad p={p} />
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                  {p.tracked && (p.minimumStock ?? 0) > 0 ? p.minimumStock : '—'}
                </TableCell>
                <TableCell>
                  <Estado p={p} />
                </TableCell>
                <TableCell className="text-right">
                  <SetStockDialog product={p} compact />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>
    </>
  );
}
