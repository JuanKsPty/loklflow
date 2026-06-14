import type { Order } from '@loklflow/types';
import { KdsCard } from './kds-card';

export function KdsColumn({ title, orders }: { title: string; orders: Order[] }) {
  return (
    <section className="flex min-h-0 flex-col rounded-xl border bg-muted/30">
      <header className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {orders.length}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3">
        {orders.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Sin órdenes</p>
        ) : (
          orders.map((order) => <KdsCard key={order.id} order={order} />)
        )}
      </div>
    </section>
  );
}
