'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { toast } from 'sonner';
import type { RoleWithPermissions, Permission } from '@loklflow/types';
import { rolesApi } from '@/lib/api/roles.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldDescription } from '@/components/ui/field';

const roleSchema = z.object({
  name: z.string().min(2, 'Nombre requerido'),
  description: z.string().optional().or(z.literal('')),
  maxDiscountPercentage: z.number().min(0).max(100),
});

type RoleFormValues = z.infer<typeof roleSchema>;

interface Props {
  role?: RoleWithPermissions;
  allPermissions: Permission[];
}

export function RoleForm({ role, allPermissions }: Props) {
  const router = useRouter();
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(role?.permissions.map((p) => p.id) ?? []),
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: role?.name ?? '',
      description: role?.description ?? '',
      maxDiscountPercentage: role?.maxDiscountPercentage ?? 0,
    },
  });

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSubmit = async (values: RoleFormValues) => {
    try {
      let roleId = role?.id;
      const body = {
        name: values.name,
        description: values.description || undefined,
        maxDiscountPercentage: values.maxDiscountPercentage,
      };
      if (role) {
        await rolesApi.update(role.id, body);
      } else {
        const created = await rolesApi.create(body);
        roleId = created.id;
      }
      await rolesApi.assignPermissions(roleId!, [...selectedPerms]);
      toast.success(role ? 'Rol actualizado' : 'Rol creado');
      router.push('/admin/roles');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const byModule = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <Input id="name" {...register('name')} disabled={role?.isSystem} aria-invalid={errors.name ? true : undefined} />
          {role?.isSystem && <FieldDescription>Los roles de sistema no pueden renombrarse.</FieldDescription>}
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field data-invalid={errors.maxDiscountPercentage ? true : undefined}>
          <FieldLabel htmlFor="maxDiscountPercentage">Descuento máx. (%)</FieldLabel>
          <Input
            id="maxDiscountPercentage"
            {...register('maxDiscountPercentage', { valueAsNumber: true })}
            type="number"
            min={0}
            max={100}
            aria-invalid={errors.maxDiscountPercentage ? true : undefined}
          />
          <FieldError errors={errors.maxDiscountPercentage ? [errors.maxDiscountPercentage] : undefined} />
        </Field>

        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="description">Descripción</FieldLabel>
          <Input
            id="description"
            {...register('description')}
            placeholder="Describe las responsabilidades de este rol"
          />
          <FieldDescription>Opcional.</FieldDescription>
        </Field>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">Permisos</p>
        <div className="overflow-hidden rounded-xl border">
          {Object.keys(byModule).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay permisos disponibles</p>
          ) : (
            Object.entries(byModule).map(([module, perms]) => (
              <div key={module} className="border-b last:border-0">
                <div className="bg-muted/50 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{module}</span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3">
                  {perms.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2">
                      <Checkbox checked={selectedPerms.has(p.id)} onCheckedChange={() => togglePerm(p.id)} />
                      <span className="text-sm">{p.action}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting && <Spinner />}
          {isSubmitting ? 'Guardando…' : role ? 'Guardar cambios' : 'Crear rol'}
        </Button>
        <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/roles" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
