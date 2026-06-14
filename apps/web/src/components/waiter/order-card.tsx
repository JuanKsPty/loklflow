import Link from 'next/link';
import type { Order } from '@loklflow/types';
import { formatPrice } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ORDER_STATUS_BADGE, ORDER_STATUS_LABELS } from '@/components/admin/orders/constants';

export function OrderCard({ order }: { order: Order }) {
  return (
    <Link href={`/waiter/orden/${order.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <div className="min-w-0">
            <p className="font-medium">{order.label || `Orden #${order.orderNumber}`}</p>
            <p className="text-sm text-muted-foreground">
              {order.label && `#${order.orderNumber} · `}
              {order.table ? `Mesa ${order.table.number}` : 'Para llevar'} ·{' '}
              {(order.items ?? []).length} ítem(s)
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className={ORDER_STATUS_BADGE[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
            <span className="text-sm font-semibold tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
