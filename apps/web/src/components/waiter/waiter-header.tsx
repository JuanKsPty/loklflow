'use client';

import { useRouter } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';
import type { ShiftSummary } from '@loklflow/types';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ShiftControl } from '@/components/pos/shift-control';

export function WaiterHeader({
  name,
  roleName,
  shift,
}: {
  name: string;
  roleName: string;
  shift: ShiftSummary | null;
}) {
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignora errores de red al cerrar sesión
    }
    clearUser();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <Avatar size="sm">
        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{roleName}</p>
      </div>
      <ShiftControl current={shift} />
      <NotificationBell area="waiter" />
      <ThemeToggle />
      <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
        <LogOutIcon />
      </Button>
    </header>
  );
}
