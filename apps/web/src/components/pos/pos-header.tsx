'use client';

import { WalletIcon } from 'lucide-react';
import type { ShiftSummary } from '@loklflow/types';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ConnectivityIndicator } from '@/components/offline/connectivity-indicator';
import { LogoutButton } from '@/components/offline/logout-button';
import { ShiftControl } from '@/components/pos/shift-control';

export function PosHeader({
  name,
  roleName,
  shift,
}: {
  name: string;
  roleName: string;
  shift: ShiftSummary | null | undefined;
}) {
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
        <ConnectivityIndicator />
        <NotificationBell area="pos" />
        <ThemeToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
