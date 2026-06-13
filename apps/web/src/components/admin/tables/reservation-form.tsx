'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  RESERVATION_STATUSES,
  type Reservation,
  type ReservationStatus,
  type RestaurantTable,
} from '@loklflow/types';
import { reservationsApi } from '@/lib/api/tables.api';
import { reservationSchema, type ReservationFormValues } from '@/lib/validations/tables.schema';
import { RESERVATION_STATUS_LABELS } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldGroup } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  reservation?: Reservation;
  tables: RestaurantTable[];
}

/** Convierte un ISO a valor para <input type="datetime-local"> en hora local. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function ReservationForm({ reservation, tables }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      tableId: reservation?.tableId ?? '',
      customerName: reservation?.customerName ?? '',
      customerPhone: reservation?.customerPhone ?? '',
      partySize: reservation?.partySize ?? 2,
      reservedAt: reservation?.reservedAt ? toLocalInput(reservation.reservedAt) : '',
      notes: reservation?.notes ?? '',
      status: reservation?.status ?? 'pending',
    },
  });

  const onSubmit = async (values: ReservationFormValues) => {
    try {
      const payload = {
        tableId: values.tableId,
        customerName: values.customerName,
        partySize: values.partySize,
        reservedAt: new Date(values.reservedAt).toISOString(),
        status: values.status as ReservationStatus,
        ...(values.customerPhone ? { customerPhone: values.customerPhone } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      };
      if (reservation) {
        await reservationsApi.update(reservation.id, payload);
      } else {
        await reservationsApi.create(payload);
      }
      toast.success(reservation ? 'Reserva actualizada' : 'Reserva creada');
      router.push('/admin/tables?tab=reservations');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg">
      <FieldGroup>
        <Field data-invalid={errors.customerName ? true : undefined}>
          <FieldLabel htmlFor="customerName">Cliente</FieldLabel>
          <Input id="customerName" {...register('customerName')} placeholder="Nombre del cliente" aria-invalid={errors.customerName ? true : undefined} />
          <FieldError errors={errors.customerName ? [errors.customerName] : undefined} />
        </Field>

        <div className="flex gap-4">
          <Field className="flex-1">
            <FieldLabel htmlFor="customerPhone">Teléfono</FieldLabel>
            <Input id="customerPhone" {...register('customerPhone')} placeholder="Opcional" />
          </Field>
          <Field data-invalid={errors.partySize ? true : undefined} className="max-w-32">
            <FieldLabel htmlFor="partySize">Personas</FieldLabel>
            <Input id="partySize" type="number" min={1} {...register('partySize', { valueAsNumber: true })} aria-invalid={errors.partySize ? true : undefined} />
            <FieldError errors={errors.partySize ? [errors.partySize] : undefined} />
          </Field>
        </div>

        <Field data-invalid={errors.tableId ? true : undefined}>
          <FieldLabel>Mesa</FieldLabel>
          <Controller
            control={control}
            name="tableId"
            render={({ field }) => (
              <Select value={field.value || null} onValueChange={(val) => field.onChange(val ?? '')}>
                <SelectTrigger className="w-full" aria-invalid={errors.tableId ? true : undefined}>
                  <SelectValue placeholder="Selecciona una mesa" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      Mesa {t.number}
                      {t.sector ? ` — ${t.sector.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={errors.tableId ? [errors.tableId] : undefined} />
        </Field>

        <Field data-invalid={errors.reservedAt ? true : undefined}>
          <FieldLabel htmlFor="reservedAt">Fecha y hora</FieldLabel>
          <Input id="reservedAt" type="datetime-local" {...register('reservedAt')} aria-invalid={errors.reservedAt ? true : undefined} />
          <FieldError errors={errors.reservedAt ? [errors.reservedAt] : undefined} />
        </Field>

        <Field>
          <FieldLabel>Estado</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(val) => field.onChange(val ?? 'pending')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESERVATION_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {RESERVATION_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="notes">Notas</FieldLabel>
          <Input id="notes" {...register('notes')} placeholder="Opcional" />
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : reservation ? 'Guardar cambios' : 'Crear reserva'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/tables?tab=reservations" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
