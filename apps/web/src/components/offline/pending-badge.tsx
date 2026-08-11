'use client';

import { CloudOffIcon } from 'lucide-react';
import { usePendingFor } from '@/lib/offline/use-outbox';
import { Badge } from '@/components/ui/badge';

/**
 * «Esta cuenta tiene cambios sin enviar».
 *
 * El indicador de la cabecera dice cuántas operaciones esperan en total; esto dice **cuáles**,
 * pegado a la cuenta o la mesa que las tiene. Sin él, un mesero con la comanda pintada como
 * hecha no tiene forma de distinguir la que ya está en el servidor de la que sigue en el
 * dispositivo, y esa diferencia importa justo cuando la cocina dice que no le ha llegado nada.
 *
 * No se pinta nada cuando no hay pendientes: es una excepción, no un adorno permanente.
 */
export function PendingBadge({ partition }: { partition: string }) {
  const pending = usePendingFor(partition);
  if (pending.length === 0) return null;

  return (
    <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
      <CloudOffIcon className="size-3" />
      {pending.length === 1 ? 'Sin enviar' : `${pending.length} sin enviar`}
    </Badge>
  );
}
