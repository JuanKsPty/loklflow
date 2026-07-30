import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/server-user';

/**
 * Layout sin barra lateral ni cabecera, para vistas destinadas a la impresora.
 * Sigue el patrón de (auth): solo comprueba la sesión y renderiza el contenido.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');
  // Quien puede cobrar puede imprimir el recibo de lo que cobró.
  if (!user.permissions?.includes('pos:read')) redirect('/login');

  return <main className="bg-background min-h-dvh">{children}</main>;
}
