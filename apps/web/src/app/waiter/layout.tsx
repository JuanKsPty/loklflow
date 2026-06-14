import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/server-user';
import { SocketProvider } from '@/components/realtime/socket-provider';
import { WaiterHeader } from '@/components/waiter/waiter-header';
import { WaiterNav } from '@/components/waiter/waiter-nav';

export const metadata = { title: 'Mesero — LoklFlow' };

export default async function WaiterLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (!user.permissions?.includes('orders:create')) redirect('/login');

  return (
    <SocketProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
        <WaiterHeader name={user.email ?? user.roleName} roleName={user.roleName} />
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-4">{children}</main>
        <WaiterNav />
      </div>
    </SocketProvider>
  );
}
