'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Supplier } from '@loklflow/types';
import { inventoryApi } from '@/lib/api/inventory.api';
import { supplierSchema, type SupplierFormValues } from '@/lib/validations/inventory.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

interface Props {
  supplier?: Supplier;
}

const BACK = '/admin/inventario?tab=suppliers';

export function SupplierForm({ supplier }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? '',
      contactName: supplier?.contactName ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      notes: supplier?.notes ?? '',
    },
  });

  const onSubmit = async (values: SupplierFormValues) => {
    try {
      const payload = {
        name: values.name,
        ...(values.contactName ? { contactName: values.contactName } : {}),
        ...(values.phone ? { phone: values.phone } : {}),
        ...(values.email ? { email: values.email } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      };
      if (supplier) await inventoryApi.suppliers.update(supplier.id, payload);
      else await inventoryApi.suppliers.create(payload);

      toast.success(supplier ? 'Proveedor actualizado' : 'Proveedor creado');
      router.push(BACK);
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
          <Input
            id="name"
            {...register('name')}
            placeholder="Distribuidora Central"
            aria-invalid={errors.name ? true : undefined}
          />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="contactName">Persona de contacto</FieldLabel>
          <Input id="contactName" {...register('contactName')} placeholder="Opcional" />
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
          <Input id="phone" {...register('phone')} placeholder="Opcional" />
        </Field>

        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="email">Correo</FieldLabel>
          <Input
            id="email"
            {...register('email')}
            placeholder="Opcional"
            aria-invalid={errors.email ? true : undefined}
          />
          <FieldError errors={errors.email ? [errors.email] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="notes">Notas</FieldLabel>
          <Input id="notes" {...register('notes')} placeholder="Días de reparto, mínimos…" />
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : supplier ? 'Guardar cambios' : 'Crear proveedor'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href={BACK} />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
