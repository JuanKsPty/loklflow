'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Sector } from '@loklflow/types';
import { sectorsApi } from '@/lib/api/tables.api';
import { sectorSchema, type SectorFormValues } from '@/lib/validations/tables.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldGroup } from '@/components/ui/field';

interface Props {
  sector?: Sector;
}

export function SectorForm({ sector }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SectorFormValues>({
    resolver: zodResolver(sectorSchema),
    defaultValues: {
      name: sector?.name ?? '',
      description: sector?.description ?? '',
      isActive: sector?.isActive ?? true,
    },
  });

  const onSubmit = async (values: SectorFormValues) => {
    try {
      const payload = {
        name: values.name,
        isActive: values.isActive,
        ...(values.description ? { description: values.description } : {}),
      };
      if (sector) {
        await sectorsApi.update(sector.id, payload);
      } else {
        await sectorsApi.create(payload);
      }
      toast.success(sector ? 'Sector actualizado' : 'Sector creado');
      router.push('/admin/tables?tab=sectors');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-lg">
      <FieldGroup>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <Input id="name" {...register('name')} placeholder="Terraza" aria-invalid={errors.name ? true : undefined} />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Descripción</FieldLabel>
          <Input id="description" {...register('description')} placeholder="Opcional" />
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
          <FieldLabel className="mb-0">Activo</FieldLabel>
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : sector ? 'Guardar cambios' : 'Crear sector'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/tables?tab=sectors" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
