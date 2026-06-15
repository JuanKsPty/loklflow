'use client';

import { useRouter } from 'next/navigation';
import { LogOutIcon, WalletIcon } from 'lucide-react';
import type { ShiftSummary } from '@loklflow/types';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ShiftControl } from '@/components/pos/shift-control';

export function PosHeader({
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <WalletIcon className="size-5 text-primary" />
      <div className="leading-tight">
        <p className="text-sm font-semibold">Caja · POS</p>
        <p className="text-xs text-muted-foreground">
          {name} · {roleName}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ShiftControl current={shift} />
        <NotificationBell area="admin" />
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
          <LogOutIcon />
        </Button>
      </div>
    </header>
  );
}
