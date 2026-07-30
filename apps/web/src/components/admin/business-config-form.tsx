'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import type { BusinessConfig } from '@loklflow/types';
import { taxBreakdown } from '@loklflow/types';
import { businessConfigApi } from '@/lib/api/business-config.api';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldGroup,
} from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const optionalText = z.string().optional().or(z.literal(''));

const schema = z.object({
  businessName: z.string().min(2, 'El nombre del negocio es obligatorio'),
  taxId: optionalText,
  phone: optionalText,
  email: z.string().email('Correo no válido').optional().or(z.literal('')),
  address: optionalText,
  logoUrl: optionalText,
  currency: z.string().length(3, 'Usa el código de 3 letras (MXN, COP…)'),
  timezone: z.string().min(1, 'La zona horaria es obligatoria'),
  taxRate: z.number().min(0).max(100),
  receiptFooter: optionalText,
});

type FormValues = z.infer<typeof schema>;

export function BusinessConfigForm({ config }: { config: BusinessConfig }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      businessName: config.businessName ?? '',
      taxId: config.taxId ?? '',
      phone: config.phone ?? '',
      email: config.email ?? '',
      address: config.address ?? '',
      logoUrl: config.logoUrl ?? '',
      currency: config.currency ?? 'MXN',
      timezone: config.timezone ?? 'America/Mexico_City',
      taxRate: Number(config.taxRate) || 0,
      receiptFooter: config.receiptFooter ?? '',
    },
  });

  const rate = Number(watch('taxRate')) || 0;
  // Ejemplo en vivo sobre 100 para que se vea qué hará el recibo.
  const sample = taxBreakdown(100, rate);

  async function onSubmit(values: FormValues) {
    try {
      // Los campos vacíos se envían como null para limpiarlos de verdad.
      const blank = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
      await businessConfigApi.update({
        businessName: values.businessName.trim(),
        taxId: blank(values.taxId),
        phone: blank(values.phone),
        email: blank(values.email),
        address: blank(values.address),
        logoUrl: blank(values.logoUrl),
        currency: values.currency.toUpperCase(),
        timezone: values.timezone.trim(),
        taxRate: values.taxRate,
        receiptFooter: blank(values.receiptFooter),
      });
      toast.success('Configuración guardada');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Información del negocio</CardTitle>
          <CardDescription>Aparece en el encabezado del recibo.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={errors.businessName ? true : undefined}>
              <FieldLabel htmlFor="businessName">Nombre del negocio</FieldLabel>
              <Input
                id="businessName"
                {...register('businessName')}
                aria-invalid={errors.businessName ? true : undefined}
              />
              <FieldError errors={errors.businessName ? [errors.businessName] : undefined} />
            </Field>

            <Field data-invalid={errors.taxId ? true : undefined}>
              <FieldLabel htmlFor="taxId">Identificación fiscal</FieldLabel>
              <Input id="taxId" {...register('taxId')} placeholder="RFC, NIT o RUC" />
              <FieldDescription>Se imprime en el recibo si está presente.</FieldDescription>
            </Field>

            <Field data-invalid={errors.phone ? true : undefined}>
              <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
              <Input id="phone" {...register('phone')} />
            </Field>

            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Correo</FieldLabel>
              <Input
                id="email"
                type="email"
                {...register('email')}
                aria-invalid={errors.email ? true : undefined}
              />
              <FieldError errors={errors.email ? [errors.email] : undefined} />
            </Field>

            <Field data-invalid={errors.address ? true : undefined}>
              <FieldLabel htmlFor="address">Dirección</FieldLabel>
              <Input id="address" {...register('address')} />
            </Field>

            <Field data-invalid={errors.logoUrl ? true : undefined}>
              <FieldLabel htmlFor="logoUrl">URL del logo</FieldLabel>
              <Input id="logoUrl" {...register('logoUrl')} placeholder="https://…" />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moneda, zona horaria e impuesto</CardTitle>
          <CardDescription>
            El impuesto va incluido en los precios del menú; en el recibo se desglosa de
            forma informativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={errors.currency ? true : undefined}>
              <FieldLabel htmlFor="currency">Moneda</FieldLabel>
              <Input
                id="currency"
                {...register('currency')}
                maxLength={3}
                className="uppercase"
                aria-invalid={errors.currency ? true : undefined}
              />
              <FieldError errors={errors.currency ? [errors.currency] : undefined} />
            </Field>

            <Field data-invalid={errors.timezone ? true : undefined}>
              <FieldLabel htmlFor="timezone">Zona horaria</FieldLabel>
              <Input id="timezone" {...register('timezone')} placeholder="America/Mexico_City" />
              <FieldError errors={errors.timezone ? [errors.timezone] : undefined} />
            </Field>

            <Field data-invalid={errors.taxRate ? true : undefined}>
              <FieldLabel htmlFor="taxRate">Tasa de impuesto (%)</FieldLabel>
              <Input
                id="taxRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                {...register('taxRate', { valueAsNumber: true })}
                aria-invalid={errors.taxRate ? true : undefined}
              />
              <FieldDescription>
                {rate > 0
                  ? `Sobre ${formatPrice(100)}: base ${formatPrice(sample.base)} + impuesto ${formatPrice(sample.tax)}.`
                  : 'En 0 el recibo no muestra línea de impuesto.'}
              </FieldDescription>
              <FieldError errors={errors.taxRate ? [errors.taxRate] : undefined} />
            </Field>

            <Field data-invalid={errors.receiptFooter ? true : undefined}>
              <FieldLabel htmlFor="receiptFooter">Pie del recibo</FieldLabel>
              <Input
                id="receiptFooter"
                {...register('receiptFooter')}
                maxLength={255}
                placeholder="¡Gracias por su visita!"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Spinner />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
