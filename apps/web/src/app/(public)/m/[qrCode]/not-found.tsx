import { QrCodeIcon } from 'lucide-react';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

export const metadata = { title: 'Código no válido' };

/**
 * El 404 del menú público, en el idioma y el tono del cliente.
 *
 * Existe aparte del `not-found.tsx` raíz porque aquí el mensaje puede ser concreto: no es «esta
 * página no existe», es «este código no vale», que lleva a una acción —avisar a un mesero— en vez
 * de a la sensación de que la aplicación está rota.
 */
export default function QrNotFound() {
  return (
    <Empty className="mt-16 px-6">
      <EmptyMedia variant="icon">
        <QrCodeIcon />
      </EmptyMedia>
      <EmptyTitle>Este código no vale</EmptyTitle>
      <EmptyDescription>
        Puede que la hoja sea de antes o que el código se haya renovado. Avisa a un mesero y te
        atiende igual.
      </EmptyDescription>
    </Empty>
  );
}
