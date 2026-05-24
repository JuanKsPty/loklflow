'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import type { RoleWithPermissions, Permission } from '@loklflow/types';
import { rolesApi } from '@/lib/api/roles.api';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
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
      router.push('/admin/roles');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const byModule = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            {...register('name')}
            disabled={role?.isSystem}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          {role?.isSystem && (
            <p className="text-muted-foreground text-xs">Los roles de sistema no pueden renombrarse</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maxDiscountPercentage">Descuento máx. (%)</Label>
          <Input
            id="maxDiscountPercentage"
            {...register('maxDiscountPercentage', { valueAsNumber: true })}
            type="number"
            min={0}
            max={100}
            aria-invalid={errors.maxDiscountPercentage ? true : undefined}
          />
          {errors.maxDiscountPercentage && (
            <p className="text-destructive text-xs">{errors.maxDiscountPercentage.message}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">
            Descripción{' '}
            <span className="text-muted-foreground font-normal">(opcional)</span>
          </Label>
          <Input
            id="description"
            {...register('description')}
            placeholder="Describe las responsabilidades de este rol"
          />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-3">Permisos</p>
        <div className="border border-border rounded-xl overflow-hidden">
          {Object.keys(byModule).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No hay permisos disponibles
            </p>
          ) : (
            Object.entries(byModule).map(([module, perms]) => (
              <div key={module} className="border-b border-border last:border-0">
                <div className="bg-muted/50 px-4 py-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {module}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3">
                  {perms.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedPerms.has(p.id)}
                        onCheckedChange={() => togglePerm(p.id)}
                      />
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
          {isSubmitting ? 'Guardando…' : role ? 'Guardar cambios' : 'Crear rol'}
        </Button>
        <Link
          href="/admin/roles"
          className={buttonVariants({ variant: 'ghost', size: 'lg' })}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
