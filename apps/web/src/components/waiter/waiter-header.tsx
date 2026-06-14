'use client';

import { useRouter } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme-toggle';

export function WaiterHeader({ name, roleName }: { name: string; roleName: string }) {
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
      <ThemeToggle />
      <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
        <LogOutIcon />
      </Button>
    </header>
  );
}
