'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BellIcon } from 'lucide-react';
import type { Notification } from '@loklflow/types';
import { notificationsApi } from '@/lib/api/notifications.api';
import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSocket } from '@/components/realtime/socket-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Area = 'admin' | 'waiter' | 'kitchen';

function orderHref(area: Area, id: string): string | null {
  if (area === 'admin') return `/admin/orders/${id}`;
  if (area === 'waiter') return `/waiter/orden/${id}`;
  return null; // cocina no tiene vista de detalle de orden
}

export function NotificationBell({ area }: { area: Area }) {
  const router = useRouter();
  const socket = useSocket();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const { count: c } = await notificationsApi.unreadCount();
      setCount(c);
    } catch {
      // silencioso
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await notificationsApi.getAll());
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload?: { title?: string }) => {
      if (payload?.title) toast.info(payload.title);
      void refreshCount();
      if (open) void loadList();
    };
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket, open, refreshCount, loadList]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) void loadList();
  }

  async function handleClick(n: Notification) {
    try {
      if (!n.isRead) await notificationsApi.markRead(n.id);
    } catch {
      // silencioso
    }
    const href = n.resourceType === 'order' && n.resourceId ? orderHref(area, n.resourceId) : null;
    setOpen(false);
    void refreshCount();
    if (href) {
      router.push(href);
      router.refresh();
    }
  }

  async function handleMarkAll() {
    try {
      await notificationsApi.markAllRead();
    } catch {
      // silencioso
    }
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCount(0);
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Notificaciones" />}
      >
        <span className="relative">
          <BellIcon />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notificaciones</span>
          {items.some((n) => !n.isRead) && (
            <button
              type="button"
              onClick={handleMarkAll}
              className="text-xs text-primary hover:underline"
            >
              Marcar todas
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Sin notificaciones</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleClick(n)}
                className={cn(
                  'flex w-full gap-2 border-b px-3 py-2.5 text-left last:border-0 hover:bg-accent',
                  !n.isRead && 'bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'mt-1.5 size-2 shrink-0 rounded-full',
                    n.isRead ? 'bg-transparent' : 'bg-primary',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{n.title}</span>
                  {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="block text-[11px] text-muted-foreground">
                    {formatRelativeTime(n.createdAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
