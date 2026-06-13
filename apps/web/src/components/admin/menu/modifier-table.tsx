import Link from 'next/link';
import { SlidersHorizontalIcon } from 'lucide-react';
import type { Modifier } from '@loklflow/types';
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

interface Props {
  modifiers: Modifier[];
}

export function ModifierTable({ modifiers }: Props) {
  if (modifiers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SlidersHorizontalIcon />
          </EmptyMedia>
          <EmptyTitle>Sin modificadores</EmptyTitle>
          <EmptyDescription>Crea grupos de opciones (ej. término, extras) para tus productos.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Opciones</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {modifiers.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell className="text-muted-foreground">{m.options?.length ?? 0}</TableCell>
              <TableCell className="flex gap-1.5">
                {m.isRequired && <Badge variant="secondary">Obligatorio</Badge>}
                {m.allowMultiple && <Badge variant="outline">Múltiple</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/menu/modifiers/${m.id}`} />}>
                  Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
