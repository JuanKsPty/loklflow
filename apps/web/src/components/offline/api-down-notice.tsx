import { CloudOffIcon, ServerCrashIcon } from 'lucide-react';
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
  /**
   * `offline` si no se pudo hablar con la API, `error` si contestó mal.
   *
   * Cambia lo que puede hacer el operario: lo primero se arregla mirando la red, lo segundo
   * no se arregla desde el salón y hay que avisar. Sin la distinción, el aviso mandaba a
   * revisar el WiFi también cuando el WiFi estaba perfecto.
   */
  reason?: 'offline' | 'error';
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
export function ApiDownNotice({ what, reason = 'offline', className }: Props) {
  const failed = what ? `No se pudo cargar ${what}.` : 'No se pudieron cargar los datos.';

  return (
    <Empty className={className ?? 'border'}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          {reason === 'offline' ? <CloudOffIcon /> : <ServerCrashIcon />}
        </EmptyMedia>
        <EmptyTitle>
          {reason === 'offline' ? 'Sin conexión con el servidor' : 'El servidor falló'}
        </EmptyTitle>
        <EmptyDescription>
          {failed} Esto no significa que no haya nada: significa que no hemos podido
          preguntar.{' '}
          {reason === 'offline'
            ? 'Revisa la conexión y vuelve a intentarlo.'
            : 'La conexión funciona; el fallo está en el servidor. Vuelve a intentarlo y, si sigue igual, avisa.'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
