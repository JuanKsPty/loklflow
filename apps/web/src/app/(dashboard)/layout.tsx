import { redirect } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { AppHeader } from '@/components/app-header';
import { AdminBottomNav } from '@/components/admin-bottom-nav';
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
          {/*
            `SidebarInset` **ya es un `<main>`**, así que aquí va un `<div>`: dos landmarks `main`
            es HTML inválido, y además la aserción táctil del e2e busca por `main`.

            Y sin `overflow-auto`: esta columna no tiene altura acotada, así que no desplazaba
            nada por dentro —desplaza la página—, que es la razón de que la cabecera desapareciera
            al bajar. Ahora la cabecera es `sticky` y esto solo reserva el hueco de la barra
            inferior del teléfono.
          */}
          <div className="flex-1 p-4 md:p-6 max-sm:pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
            {children}
          </div>
          <AdminBottomNav permissions={user.permissions} />
        </SidebarInset>
      </SidebarProvider>
    </SocketProvider>
  );
}
