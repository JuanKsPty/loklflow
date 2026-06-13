import { notFound } from 'next/navigation';
import { serverFetch } from '@/lib/api/server-client';
import { ReservationForm } from '@/components/admin/tables/reservation-form';
import { PageHeader } from '@/components/page-header';
import type { Reservation, RestaurantTable } from '@loklflow/types';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditReservationPage({ params }: Props) {
  const { id } = await params;
  try {
    const [reservation, tables] = await Promise.all([
      serverFetch<Reservation>(`/tables/reservations/${id}`),
      serverFetch<RestaurantTable[]>('/tables'),
    ]);
    return (
      <div>
        <PageHeader title="Editar reserva" description={reservation.customerName} />
        <ReservationForm reservation={reservation} tables={tables} />
      </div>
    );
  } catch {
    notFound();
  }
}
