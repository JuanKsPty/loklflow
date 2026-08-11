import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeftIcon } from 'lucide-react';
import { isNotFound, serverFetch } from '@/lib/api/server-client';
import { reportApiFailure } from '@/lib/observability/api-failure';
import { getServerUser } from '@/lib/auth/server-user';
import { Button } from '@/components/ui/button';
import { CheckoutView } from '@/components/pos/checkout-view';
import type { Order } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PosCheckoutPage({ params }: Props) {
  const { id } = await params;

  let order: Order | null = null;
  try {
    order = await serverFetch<Order>(`/orders/${id}`);
  } catch (err) {
    // Solo un 404 significa que la cuenta no existe; lo demás es que no pudimos preguntar, y
    // decirle al cajero que una cuenta real «no existe» le hace buscar donde no hay nada.
    if (isNotFound(err)) notFound();
    reportApiFailure('pos/cuenta', err);
  }

  // El umbral llega por el token: leerlo aquí, en el servidor, es la única forma fiable
  // (el store de auth del cliente no se hidrata tras un refresh de página).
  const user = await getServerUser();

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 self-start"
        nativeButton={false}
        render={<Link href="/pos" />}
      >
        <ChevronLeftIcon />
        Cuentas
      </Button>
      <CheckoutView
        orderId={id}
        initialOrder={order}
        maxDiscountPercentage={user?.maxDiscountPercentage ?? 0}
      />
    </div>
  );
}
