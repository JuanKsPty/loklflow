'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGridIcon, ReceiptTextIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/waiter', label: 'Mesas', icon: LayoutGridIcon, match: (p: string) => p === '/waiter' || p.startsWith('/waiter/mesa') },
  { href: '/waiter/ordenes', label: 'Órdenes', icon: ReceiptTextIcon, match: (p: string) => p.startsWith('/waiter/orden') || p === '/waiter/nueva' },
];

export function WaiterNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-5xl border-t bg-background/95 backdrop-blur">
      {TABS.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
