import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/server-user';
import { currentShift } from '@/lib/api/current-shift';
import { SocketProvider } from '@/components/realtime/socket-provider';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { PosHeader } from '@/components/pos/pos-header';

export const metadata = { title: 'Caja · POS — LoklFlow' };

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (!user.permissions?.includes('pos:read')) redirect('/login');

  // `undefined` = no se pudo consultar, distinto de `null` = no hay turno abierto.
  // Antes las dos cosas eran `null`, así que un fallo de red hacía que la cabecera
  // ofreciera «Abrir turno» sobre un turno que ya estaba abierto.
  const shift = await currentShift();

  return (
    <SocketProvider>
      <OfflineProvider>
        {/*
         * `max-w-3xl` era el ancho para todo, y en la tableta apaisada del mostrador —1024 px o
         * más— dejaba un cuarto de pantalla vacío a cada lado con la caja apretada en el centro.
         * A partir de `lg` el contenedor se ensancha y la pantalla de cobro pasa a dos columnas.
         */}
        <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-background lg:max-w-6xl">
          <PosHeader name={user.email ?? user.roleName} roleName={user.roleName} shift={shift} />
          <main className="flex-1 overflow-y-auto p-4">{children}</main>
        </div>
      </OfflineProvider>
    </SocketProvider>
  );
}
