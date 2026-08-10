import { PublicOrderTracker } from '@/components/public/public-order-tracker';

export const metadata = { title: 'Tu pedido' };

interface Props {
  params: Promise<{ qrCode: string }>;
}

/**
 * El seguimiento del pedido.
 *
 * No pide nada en el servidor: el pase vive en el `sessionStorage` del teléfono, y mandarlo por la
 * URL para poder leerlo aquí sería justo lo que se evitó al ponerlo en una cabecera —quedaría en el
 * historial del navegador, en el `Referer` y en las líneas de acceso del servidor.
 */
export default async function PublicOrderPage({ params }: Props) {
  const { qrCode } = await params;
  return <PublicOrderTracker qrCode={qrCode} />;
}
