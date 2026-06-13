'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  TABLE_STATUSES,
  TABLE_SHAPES,
  type RestaurantTable,
  type Sector,
  type TableStatus,
  type TableShape,
} from '@loklflow/types';
import { tablesApi } from '@/lib/api/tables.api';
import { tableSchema, type TableFormValues } from '@/lib/validations/tables.schema';
import { TABLE_STATUS_LABELS, TABLE_SHAPE_LABELS } from './constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldDescription, FieldGroup } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  table?: RestaurantTable;
  sectors: Sector[];
  defaultNumber?: number;
}

export function TableForm({ table, sectors, defaultNumber }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<TableFormValues>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      number: table?.number ?? defaultNumber ?? 1,
      sectorId: table?.sectorId ?? '',
      capacity: table?.capacity ?? 4,
      status: table?.status ?? 'available',
      shape: table?.shape ?? 'square',
      isActive: table?.isActive ?? true,
    },
  });

  const onSubmit = async (values: TableFormValues) => {
    try {
      const payload = {
        number: values.number,
        sectorId: values.sectorId,
        capacity: values.capacity,
        status: values.status as TableStatus,
        shape: values.shape as TableShape,
        isActive: values.isActive,
      };
      if (table) {
        await tablesApi.update(table.id, payload);
      } else {
        await tablesApi.create(payload);
      }
      toast.success(table ? 'Mesa actualizada' : 'Mesa creada');
      router.push('/admin/tables?tab=tables');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg">
      <FieldGroup>
        <div className="flex gap-4">
          <Field data-invalid={errors.number ? true : undefined} className="max-w-32">
            <FieldLabel htmlFor="number">Número</FieldLabel>
            <Input id="number" type="number" min={1} {...register('number', { valueAsNumber: true })} aria-invalid={errors.number ? true : undefined} />
            {!table && <FieldDescription>Sugerido automáticamente.</FieldDescription>}
            <FieldError errors={errors.number ? [errors.number] : undefined} />
          </Field>

          <Field data-invalid={errors.capacity ? true : undefined} className="max-w-32">
            <FieldLabel htmlFor="capacity">Capacidad</FieldLabel>
            <Input id="capacity" type="number" min={1} {...register('capacity', { valueAsNumber: true })} aria-invalid={errors.capacity ? true : undefined} />
            <FieldError errors={errors.capacity ? [errors.capacity] : undefined} />
          </Field>
        </div>

        <Field data-invalid={errors.sectorId ? true : undefined}>
          <FieldLabel>Sector</FieldLabel>
          <Controller
            control={control}
            name="sectorId"
            render={({ field }) => (
              <Select
                items={sectors.map((s) => ({ value: s.id, label: s.name }))}
                value={field.value || null}
                onValueChange={(val) => field.onChange(val ?? '')}
              >
                <SelectTrigger className="w-full" aria-invalid={errors.sectorId ? true : undefined}>
                  <SelectValue placeholder="Selecciona un sector" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={errors.sectorId ? [errors.sectorId] : undefined} />
        </Field>

        <Field>
          <FieldLabel>Estado</FieldLabel>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select
                items={TABLE_STATUSES.map((s) => ({ value: s, label: TABLE_STATUS_LABELS[s] }))}
                value={field.value}
                onValueChange={(val) => field.onChange(val ?? 'available')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TABLE_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field>
          <FieldLabel>Forma</FieldLabel>
          <Controller
            control={control}
            name="shape"
            render={({ field }) => (
              <Select
                items={TABLE_SHAPES.map((s) => ({ value: s, label: TABLE_SHAPE_LABELS[s] }))}
                value={field.value}
                onValueChange={(val) => field.onChange(val ?? 'square')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_SHAPES.map((shape) => (
                    <SelectItem key={shape} value={shape}>
                      {TABLE_SHAPE_LABELS[shape]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
          <FieldLabel className="mb-0">Activa</FieldLabel>
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : table ? 'Guardar cambios' : 'Crear mesa'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/tables?tab=tables" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
