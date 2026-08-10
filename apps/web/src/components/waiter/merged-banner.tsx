'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CombineIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Order } from '@loklflow/types';
import { ordersApi } from '@/lib/api/orders.api';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * «Esta cuenta se fusionó en la #N».
 *
 * Se pinta en el detalle de una cuenta fusionada, que es la única pantalla desde la que se puede
 * llegar a una: los listados ya no la devuelven. Sin este aviso, el mesero abriría una cuenta sin
 * ítems y con total 0 sin ninguna explicación —parecería que se perdió— y el botón de deshacer no
 * existiría en ningún sitio.
 */
export function MergedBanner({ order }: { order: Order }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!order.mergedIntoOrderId) return null;

  async function undo() {
    setBusy(true);
    try {
      await ordersApi.unmerge(order.id);
      toast.success('Fusión deshecha');
      router.refresh();
    } catch (err) {
      // El servidor explica el motivo: la cuenta principal ya se cobró, por ejemplo.
      toast.error(err instanceof Error ? err.message : 'No se pudo deshacer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-info/30 bg-info/10 px-3 py-3 text-sm sm:flex-row sm:items-center">
      <CombineIcon className="size-4 shrink-0 text-info" />
      <p className="min-w-0 flex-1">
        Esta cuenta se fusionó en otra. Todo lo que tenía se cobra desde la cuenta principal.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={undo}
        disabled={busy}
      >
        {busy && <Spinner />}
        Deshacer fusión
      </Button>
    </div>
  );
}
