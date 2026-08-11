'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveIcon, RotateCcwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryApi } from '@/lib/api/inventory.api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Dar de baja o reactivar un ingrediente o un proveedor.
 *
 * Sustituye al interruptor de «Activo» que llevaban los dos formularios, y el cambio no es
 * estético: ese interruptor mandaba `isActive: false` por `PATCH`, que va con `inventory:update`.
 * El endpoint de baja lógica existe aparte precisamente para exigir `inventory:delete` —el
 * controlador lo guarda así y su comentario explica por qué no se borra—, así que el formulario
 * estaba **saltándose el permiso** y `inventory:delete` no lo ejercía nadie en toda la aplicación.
 *
 * La asimetría está a propósito: dar de baja pide confirmación y su permiso; reactivar es un PATCH
 * normal, porque no destruye nada.
 */
export function ActiveControl({
  kind,
  id,
  isActive,
  name,
}: {
  kind: 'ingredient' | 'supplier';
  id: string;
  isActive: boolean;
  name: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const api = kind === 'ingredient' ? inventoryApi.ingredients : inventoryApi.suppliers;
  const noun = kind === 'ingredient' ? 'ingrediente' : 'proveedor';

  async function run(action: 'deactivate' | 'reactivate') {
    setBusy(true);
    try {
      if (action === 'deactivate') await api.deactivate(id);
      else await api.update(id, { isActive: true });
      toast.success(action === 'deactivate' ? `${name} dado de baja` : `${name} reactivado`);
      setAsking(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            Estado
            <Badge variant={isActive ? 'secondary' : 'outline'}>
              {isActive ? 'Activo' : 'De baja'}
            </Badge>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isActive
              ? `Dar de baja lo saca de los desplegables y conserva el historial. Por eso no se puede borrar.`
              : `Está fuera de los desplegables. Su historial se conserva intacto.`}
          </p>
        </div>
        {isActive ? (
          <Button
            variant="outline"
            className="shrink-0 text-destructive"
            onClick={() => setAsking(true)}
            disabled={busy}
          >
            <ArchiveIcon />
            Dar de baja
          </Button>
        ) : (
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => run('reactivate')}
            disabled={busy}
          >
            {busy ? <Spinner /> : <RotateCcwIcon />}
            Reactivar
          </Button>
        )}
      </div>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Dar de baja «{name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de aparecer al registrar movimientos y al editar recetas. El historial de
              movimientos y de compras se conserva entero, y puedes reactivarlo cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run('deactivate')}
              disabled={busy}
            >
              {busy && <Spinner />}
              Dar de baja el {noun}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
