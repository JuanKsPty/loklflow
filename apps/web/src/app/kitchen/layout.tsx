import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/server-user';
import { SocketProvider } from '@/components/realtime/socket-provider';
import { KitchenHeader } from '@/components/kitchen/kitchen-header';

export const metadata = { title: 'Cocina · KDS — LoklFlow' };

export default async function KitchenLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (!user.permissions?.includes('orders:update')) redirect('/login');

  return (
    <SocketProvider>
      <div className="flex min-h-dvh flex-col bg-background">
        <KitchenHeader name={user.email ?? user.roleName} roleName={user.roleName} />
        <main className="flex-1 overflow-hidden p-4">{children}</main>
      </div>
    </SocketProvider>
  );
}
