'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginSchema, type LoginFormValues } from '@/lib/validations/login.schema';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthUser } from '@loklflow/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    try {
      const user = await authApi.login(values);
      setUser(user as AuthUser);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">LoklFlow</CardTitle>
        <CardDescription>Inicia sesión con tu cuenta</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="admin@loklflow.com"
              aria-invalid={errors.email ? true : undefined}
            />
            {errors.email && (
              <p className="text-destructive text-xs">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              {...register('password')}
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
            />
            {errors.password && (
              <p className="text-destructive text-xs">{errors.password.message}</p>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
            {isSubmitting ? 'Ingresando...' : 'Iniciar sesión'}
          </Button>

          <div className="text-center">
            <Link href="/pin" className="text-sm text-primary hover:underline">
              Ingresar con PIN
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
