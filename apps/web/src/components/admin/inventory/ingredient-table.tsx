import Link from 'next/link';
import { PackageIcon, TriangleAlertIcon } from 'lucide-react';
import type { Ingredient } from '@loklflow/types';
import { INGREDIENT_UNIT_LABELS } from '@loklflow/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ingredients: Ingredient[];
}

/** Un mínimo en cero significa «no me avises de este», así que no cuenta como bajo. */
function isLow(ingredient: Ingredient): boolean {
  return ingredient.minimumStock > 0 && ingredient.currentStock <= ingredient.minimumStock;
}

export function IngredientTable({ ingredients }: Props) {
  if (ingredients.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PackageIcon />
          </EmptyMedia>
          <EmptyTitle>Sin ingredientes</EmptyTitle>
          <EmptyDescription>
            Da de alta los ingredientes que compras. Después los enlazas a los productos desde
            la ficha de cada uno, y el stock se descuenta solo al cobrar.
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
            <TableHead>Ingrediente</TableHead>
            <TableHead className="text-right">Existencias</TableHead>
            <TableHead className="text-right">Mínimo</TableHead>
            <TableHead className="text-right">Costo unitario</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.map((i) => {
            const low = isLow(i);
            return (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    // El negativo se muestra, no se esconde: significa que hay que recontar.
                    i.currentStock < 0 && 'font-semibold text-destructive',
                    low && i.currentStock >= 0 && 'font-semibold text-warning',
                  )}
                >
                  {i.currentStock} {INGREDIENT_UNIT_LABELS[i.unit]}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {i.minimumStock > 0 ? i.minimumStock : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {i.costPerUnit > 0 ? i.costPerUnit : '—'}
                </TableCell>
                <TableCell>
                  {!i.isActive ? (
                    <Badge variant="secondary">Inactivo</Badge>
                  ) : low ? (
                    <Badge
                      variant="outline"
                      className="border-warning/30 bg-warning/10 text-warning"
                    >
                      <TriangleAlertIcon className="size-3" />
                      Stock bajo
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success"
                    >
                      En stock
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/admin/inventario/ingredientes/${i.id}`} />}
                  >
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
