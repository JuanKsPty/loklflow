import { serverFetch } from '@/lib/api/server-client';
import { ReservationForm } from '@/components/admin/tables/reservation-form';
import { PageHeader } from '@/components/page-header';
import type { RestaurantTable } from '@loklflow/types';

export const metadata = { title: 'Nueva reserva — LoklFlow' };

export default async function NewReservationPage() {
  let tables: RestaurantTable[] = [];
  try {
    tables = await serverFetch<RestaurantTable[]>('/tables');
  } catch {
    // formulario sin mesas si la API no responde
  }

  return (
    <div>
      <PageHeader title="Nueva reserva" description="Registra una reserva de mesa." />
      <ReservationForm tables={tables} />
    </div>
  );
}
