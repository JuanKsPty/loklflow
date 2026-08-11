import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PublicMenu as Menu } from '@loklflow/types';
import { isNotFound, serverPublicFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { ApiDownNotice } from '@/components/offline/api-down-notice';
import { PublicMenu } from '@/components/public/public-menu';

interface Props {
  params: Promise<{ qrCode: string }>;
}

/**
 * `generateMetadata` y no `metadata` estático porque el nombre del negocio sale de la base de
 * datos: es lo que el cliente ve en la pestaña y en lo que comparta.
 *
 * Un fallo aquí no puede tumbar la página, así que cae a un título genérico.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { qrCode } = await params;
  try {
    const menu = await serverPublicFetch<Menu>(`/menu/${qrCode}`);
    return { title: `${menu.business.name} · Mesa ${menu.table.number}` };
  } catch {
    return { title: 'Carta' };
  }
}

export default async function PublicMenuPage({ params }: Props) {
  const { qrCode } = await params;

  let menu: Menu;
  try {
    menu = await serverPublicFetch<Menu>(`/menu/${qrCode}`);
  } catch (err) {
    // Un 404 es un código que de verdad no vale: una hoja vieja, un QR rotado, o alguien
    // probando. Cualquier otro fallo es que no pudimos preguntar, y decirle a un cliente que su
    // mesa «no existe» le manda a buscar a un mesero por el motivo equivocado.
    if (isNotFound(err)) notFound();
    const failure = reportApiFailure('public/menu', err);
    return (
      <div className="p-4">
        <ApiDownNotice what="la carta" reason={failure} />
      </div>
    );
  }

  return <PublicMenu qrCode={qrCode} menu={menu} />;
}
