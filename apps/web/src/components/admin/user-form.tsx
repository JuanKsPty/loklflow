'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import type { User, Role } from '@loklflow/types';
import { usersApi } from '@/lib/api/users.api';
import { employeeSchema, type EmployeeFormValues } from '@/lib/validations/employee.schema';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  user?: User;
  roles: Role[];
}

export function UserForm({ user, roles }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      password: '',
      pin: '',
      roleId: user?.roleId ?? '',
    },
  });

  const onSubmit = async (values: EmployeeFormValues) => {
    setError(null);
    try {
      const payload = {
        name: values.name,
        roleId: values.roleId,
        ...(values.email ? { email: values.email } : {}),
        ...(values.password ? { password: values.password } : {}),
        ...(values.pin ? { pin: values.pin } : {}),
      };
      if (user) {
        await usersApi.update(user.id, payload);
      } else {
        await usersApi.create(payload);
      }
      router.push('/admin/users');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-lg">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          {...register('name')}
          placeholder="Juan García"
          aria-invalid={errors.name ? true : undefined}
        />
        {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id="email"
          {...register('email')}
          type="email"
          placeholder="juan@restaurante.com"
          aria-invalid={errors.email ? true : undefined}
        />
        {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">
          {user ? 'Nueva contraseña' : 'Contraseña'}{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </Label>
        <Input
          id="password"
          {...register('password')}
          type="password"
          placeholder="Mínimo 8 caracteres"
          aria-invalid={errors.password ? true : undefined}
        />
        {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pin">
          PIN <span className="text-muted-foreground font-normal">(4–6 dígitos, opcional)</span>
        </Label>
        <Input
          id="pin"
          {...register('pin')}
          type="password"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••"
          aria-invalid={errors.pin ? true : undefined}
        />
        {errors.pin && <p className="text-destructive text-xs">{errors.pin.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Rol</Label>
        <Controller
          control={control}
          name="roleId"
          render={({ field }) => (
            <Select
              value={field.value || null}
              onValueChange={(val) => field.onChange(val ?? '')}
            >
              <SelectTrigger
                className="w-full"
                aria-invalid={errors.roleId ? true : undefined}
              >
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.roleId && <p className="text-destructive text-xs">{errors.roleId.message}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? 'Guardando…' : user ? 'Guardar cambios' : 'Crear empleado'}
        </Button>
        <Link
          href="/admin/users"
          className={buttonVariants({ variant: 'ghost', size: 'lg' })}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
