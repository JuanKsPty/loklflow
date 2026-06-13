'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { sectorsApi, tablesApi, reservationsApi } from '@/lib/api/tables.api';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Kind = 'sector' | 'table' | 'reservation';

const REMOVERS: Record<Kind, (id: string) => Promise<void>> = {
  sector: (id) => sectorsApi.remove(id),
  table: (id) => tablesApi.remove(id),
  reservation: (id) => reservationsApi.remove(id),
};

interface Props {
  kind: Kind;
  id: string;
  editHref: string;
  confirmTitle: string;
  confirmDescription: string;
}

export function RowActions({ kind, id, editHref, confirmTitle, confirmDescription }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await REMOVERS[kind](id);
      toast.success('Eliminado');
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={editHref} />}>
        Editar
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          render={
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              Eliminar
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
