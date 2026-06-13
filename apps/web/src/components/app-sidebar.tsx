'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UsersIcon, ShieldIcon, SettingsIcon, ChevronsUpDownIcon, LogOutIcon, UtensilsCrossedIcon, LayoutGridIcon } from 'lucide-react';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

interface NavItem {
  title: string;
  href: string;
  icon: typeof UsersIcon;
  permission: string;
}

const NAV_ITEMS: NavItem[] = [
  { title: 'Menú', href: '/admin/menu', icon: UtensilsCrossedIcon, permission: 'menu:read' },
  { title: 'Mesas', href: '/admin/tables', icon: LayoutGridIcon, permission: 'tables:read' },
  { title: 'Empleados', href: '/admin/users', icon: UsersIcon, permission: 'users:read' },
  { title: 'Roles', href: '/admin/roles', icon: ShieldIcon, permission: 'roles:read' },
  { title: 'Configuración', href: '/admin/settings', icon: SettingsIcon, permission: 'business_config:read' },
];

interface AppSidebarProps {
  user: { name: string; roleName: string; permissions: string[] };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const clearUser = useAuthStore((s) => s.clearUser);

  const items = NAV_ITEMS.filter((item) => user.permissions.includes(item.permission));
  const initials = user.name
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignora: limpiamos sesión local de todas formas
    }
    clearUser();
    router.push('/login');
    router.refresh();
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/admin" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <UtensilsCrossedIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">LoklFlow</span>
                <span className="truncate text-xs text-muted-foreground">Panel de gestión</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarMenu>
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton isActive={active} tooltip={item.title} render={<Link href={item.href} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton size="lg" className="data-[popup-open]:bg-sidebar-accent">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.roleName}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent align="end" side="top" className="w-(--anchor-width) min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="grid leading-tight">
                      <span className="truncate font-medium">{user.name}</span>
                      <span className="truncate text-xs font-normal text-muted-foreground">{user.roleName}</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <LogOutIcon />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
