import { CloudOffIcon } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

interface Props {
  /** Qué se estaba intentando cargar, para que el aviso diga algo concreto. */
  what?: string;
  className?: string;
}

/**
 * La API no respondió.
 *
 * Existe porque las pantallas operativas mentían al operario de tres maneras distintas cuando
 * el servidor no contestaba: tres decían que una mesa o una cuenta **no existen** —llamaban a
 * `notFound()` dentro del catch— y el resto pintaban su estado vacío normal, así que el
 * cocinero leía «Sin órdenes» mientras las comandas se acumulaban y el cajero leía «No hay
 * cuentas por cobrar» con la caja llena.
 *
 * Un fallo visible es mejor que un vacío creíble: con este aviso el operario sabe que tiene
 * que mirar la red, y no que el restaurante está tranquilo.
 */
export function ApiDownNotice({ what, className }: Props) {
  return (
    <Empty className={className ?? 'border'}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudOffIcon />
        </EmptyMedia>
        <EmptyTitle>Sin conexión con el servidor</EmptyTitle>
        <EmptyDescription>
          {what ? `No se pudo cargar ${what}.` : 'No se pudieron cargar los datos.'} Esto no
          significa que no haya nada: significa que no hemos podido preguntar. Revisa la
          conexión y vuelve a intentarlo.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
