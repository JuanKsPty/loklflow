'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { loginSchema, type LoginFormValues } from '@/lib/validations/login.schema';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthUser } from '@loklflow/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';

export function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    try {
      const user = await authApi.login(values);
      setUser(user as AuthUser);
      router.push('/admin');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credenciales incorrectas');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">LoklFlow</CardTitle>
        <CardDescription>Inicia sesión con tu cuenta</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="admin@loklflow.com"
              aria-invalid={errors.email ? true : undefined}
            />
            <FieldError errors={errors.email ? [errors.email] : undefined} />
          </Field>

          <Field data-invalid={errors.password ? true : undefined}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Input
              id="password"
              {...register('password')}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
            />
            <FieldError errors={errors.password ? [errors.password] : undefined} />
          </Field>

          <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Ingresando…' : 'Iniciar sesión'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center">
        <Link href="/pin" className="text-sm text-primary hover:underline">
          Ingresar con PIN
        </Link>
      </CardFooter>
    </Card>
  );
}
