import { redirect } from 'next/navigation';
import type { ShiftSummary } from '@loklflow/types';
import { getServerUser } from '@/lib/auth/server-user';
import { serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { SocketProvider } from '@/components/realtime/socket-provider';
import { PosHeader } from '@/components/pos/pos-header';

export const metadata = { title: 'Caja · POS — LoklFlow' };

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (!user.permissions?.includes('pos:read')) redirect('/login');

  // `undefined` = no se pudo consultar, distinto de `null` = no hay turno abierto.
  // Antes las dos cosas eran `null`, así que un fallo de red hacía que la cabecera
  // ofreciera «Abrir turno» sobre un turno que ya estaba abierto.
  let shift: ShiftSummary | null | undefined;
  try {
    shift = await serverFetch<ShiftSummary | null>('/shifts/current');
  } catch (err) {
    reportApiFailure('pos:layout', err);
    shift = undefined;
  }

  return (
    <SocketProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-background">
        <PosHeader name={user.email ?? user.roleName} roleName={user.roleName} shift={shift} />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </SocketProvider>
  );
}
