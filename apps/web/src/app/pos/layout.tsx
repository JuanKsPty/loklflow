import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/auth/server-user';
import { SocketProvider } from '@/components/realtime/socket-provider';
import { PosHeader } from '@/components/pos/pos-header';

export const metadata = { title: 'Caja · POS — LoklFlow' };

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');
  if (!user.permissions?.includes('pos:read')) redirect('/login');

  return (
    <SocketProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col bg-background">
        <PosHeader name={user.email ?? user.roleName} roleName={user.roleName} />
        <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </SocketProvider>
  );
}
