'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import type { User, Role } from '@loklflow/types';
import { usersApi } from '@/lib/api/users.api';
import { employeeSchema, type EmployeeFormValues } from '@/lib/validations/employee.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  user?: User;
  roles: Role[];
}

export function UserForm({ user, roles }: Props) {
  const router = useRouter();

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
      toast.success(user ? 'Empleado actualizado' : 'Empleado creado');
      router.push('/admin/users');
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
          <Input id="name" {...register('name')} placeholder="Juan García" aria-invalid={errors.name ? true : undefined} />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            {...register('email')}
            type="email"
            placeholder="juan@restaurante.com"
            aria-invalid={errors.email ? true : undefined}
          />
          <FieldDescription>Opcional. Necesario para iniciar sesión con email.</FieldDescription>
          <FieldError errors={errors.email ? [errors.email] : undefined} />
        </Field>

        <Field data-invalid={errors.password ? true : undefined}>
          <FieldLabel htmlFor="password">{user ? 'Nueva contraseña' : 'Contraseña'}</FieldLabel>
          <Input
            id="password"
            {...register('password')}
            type="password"
            placeholder="Mínimo 8 caracteres"
            aria-invalid={errors.password ? true : undefined}
          />
          <FieldDescription>Opcional.</FieldDescription>
          <FieldError errors={errors.password ? [errors.password] : undefined} />
        </Field>

        <Field data-invalid={errors.pin ? true : undefined}>
          <FieldLabel htmlFor="pin">PIN</FieldLabel>
          <Input
            id="pin"
            {...register('pin')}
            type="password"
            inputMode="numeric"
            maxLength={6}
            placeholder="••••"
            aria-invalid={errors.pin ? true : undefined}
          />
          <FieldDescription>4–6 dígitos. Opcional, para acceso rápido en operación.</FieldDescription>
          <FieldError errors={errors.pin ? [errors.pin] : undefined} />
        </Field>

        <Field data-invalid={errors.roleId ? true : undefined}>
          <FieldLabel>Rol</FieldLabel>
          <Controller
            control={control}
            name="roleId"
            render={({ field }) => (
              <Select value={field.value || null} onValueChange={(val) => field.onChange(val ?? '')}>
                <SelectTrigger className="w-full" aria-invalid={errors.roleId ? true : undefined}>
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
          <FieldError errors={errors.roleId ? [errors.roleId] : undefined} />
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : user ? 'Guardar cambios' : 'Crear empleado'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/users" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
