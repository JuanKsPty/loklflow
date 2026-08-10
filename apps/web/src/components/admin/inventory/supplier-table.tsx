import Link from 'next/link';
import { TruckIcon } from 'lucide-react';
import type { Supplier } from '@loklflow/types';
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
  suppliers: Supplier[];
}

export function SupplierTable({ suppliers }: Props) {
  if (suppliers.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TruckIcon />
          </EmptyMedia>
          <EmptyTitle>Sin proveedores</EmptyTitle>
          <EmptyDescription>
            Da de alta a quién le compras. Cada entrada de mercancía queda ligada a uno.
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
            <TableHead>Proveedor</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-medium">{s.name}</TableCell>
              <TableCell className="text-muted-foreground">{s.contactName ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{s.phone ?? '—'}</TableCell>
              <TableCell>
                {s.isActive ? (
                  <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                    Activo
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactivo</Badge>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/admin/inventario/proveedores/${s.id}`} />}
                >
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
