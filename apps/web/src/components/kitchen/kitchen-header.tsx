'use client';

import { useRouter } from 'next/navigation';
import { LogOutIcon, ChefHatIcon } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export function KitchenHeader({ name, roleName }: { name: string; roleName: string }) {
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
      <ChefHatIcon className="size-5 text-primary" />
      <div className="leading-tight">
        <p className="text-sm font-semibold">Cocina · KDS</p>
        <p className="text-xs text-muted-foreground">
          {name} · {roleName}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Cerrar sesión">
          <LogOutIcon />
        </Button>
      </div>
    </header>
  );
}
