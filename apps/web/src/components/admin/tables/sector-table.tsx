import Link from 'next/link';
import { LayersIcon } from 'lucide-react';
import type { Sector } from '@loklflow/types';
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
  sectors: Sector[];
}

export function SectorTable({ sectors }: Props) {
  if (sectors.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayersIcon />
          </EmptyMedia>
          <EmptyTitle>Sin sectores</EmptyTitle>
          <EmptyDescription>Crea sectores como Interior, Terraza o Barra.</EmptyDescription>
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
            <TableHead>Descripción</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sectors.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-muted-foreground">{s.description ?? '—'}</TableCell>
              <TableCell>
                {s.isActive ? (
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/admin/tables/sectors/${s.id}`} />}>
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
