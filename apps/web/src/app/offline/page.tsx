import Link from 'next/link';
import { CloudOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Sin conexión — LoklFlow' };

/**
 * El respaldo del Service Worker para una pantalla que nunca se llegó a visitar con red.
 *
 * **No llama a `cookies()` ni a `serverFetch`**, y eso es lo único que importa de este archivo:
 * es lo que la hace estática y por tanto precacheable durante el `install` del SW. En cuanto
 * dependiera de la sesión, el SW no podría guardarla y este respaldo dejaría de existir sin que
 * nada fallara de forma visible.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <CloudOffIcon className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Sin conexión</h1>
      <p className="text-sm text-muted-foreground">
        Esta pantalla no se había abierto todavía en este dispositivo, así que no hay una copia
        guardada que enseñar. Las pantallas que ya usaste siguen funcionando, y lo que hagas en
        ellas se envía solo al volver la conexión.
      </p>
      <div className="flex gap-2">
        <Button nativeButton={false} render={<Link href="/waiter" />}>
          Ir al salón
        </Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/kitchen" />}>
          Cocina
        </Button>
      </div>
    </div>
  );
}
