'use client';

import { ChefHatIcon } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ConnectivityIndicator } from '@/components/offline/connectivity-indicator';
import { LogoutButton } from '@/components/offline/logout-button';

export function KitchenHeader({ name, roleName }: { name: string; roleName: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
      <ChefHatIcon className="size-5 text-primary" />
      <div className="leading-tight">
        <p className="text-sm font-semibold">Cocina · KDS</p>
        <p className="text-xs text-muted-foreground">
          {name} · {roleName}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ConnectivityIndicator />
        <NotificationBell area="kitchen" />
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
