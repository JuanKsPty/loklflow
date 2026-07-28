import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { SocketProvider } from '@/components/realtime/socket-provider';
import { getServerUser } from '@/lib/auth/server-user';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect('/login');

  return (
    <SocketProvider>
      <SidebarProvider>
        <AppSidebar
          user={{ name: user.email ?? user.roleName, roleName: user.roleName, permissions: user.permissions }}
        />
        <SidebarInset>
          <AppHeader />
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </SocketProvider>
  );
}
