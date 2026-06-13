'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { Combo, Product } from '@loklflow/types';
import { combosApi } from '@/lib/api/menu.api';
import { comboSchema, type ComboFormValues } from '@/lib/validations/menu.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldDescription, FieldGroup, FieldLegend } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  combo?: Combo;
  products: Product[];
}

export function ComboForm({ combo, products }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ComboFormValues>({
    resolver: zodResolver(comboSchema),
    defaultValues: {
      name: combo?.name ?? '',
      description: combo?.description ?? '',
      price: combo?.price ?? 0,
      imageUrl: combo?.imageUrl ?? '',
      isActive: combo?.isActive ?? true,
      items:
        combo?.items?.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          allowSubstitution: it.allowSubstitution,
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const onSubmit = async (values: ComboFormValues) => {
    try {
      const payload = {
        name: values.name,
        price: values.price,
        isActive: values.isActive,
        items: values.items,
        ...(values.description ? { description: values.description } : {}),
        ...(values.imageUrl ? { imageUrl: values.imageUrl } : {}),
      };
      if (combo) {
        await combosApi.update(combo.id, payload);
      } else {
        await combosApi.create(payload);
      }
      toast.success(combo ? 'Combo actualizado' : 'Combo creado');
      router.push('/admin/menu?tab=combos');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl">
      <FieldGroup>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="name">Nombre</FieldLabel>
          <Input id="name" {...register('name')} placeholder="Combo familiar" aria-invalid={errors.name ? true : undefined} />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Descripción</FieldLabel>
          <Input id="description" {...register('description')} placeholder="Opcional" />
        </Field>

        <div className="flex gap-4">
          <Field data-invalid={errors.price ? true : undefined} className="max-w-40">
            <FieldLabel htmlFor="price">Precio</FieldLabel>
            <Input id="price" type="number" step="0.01" min={0} {...register('price', { valueAsNumber: true })} aria-invalid={errors.price ? true : undefined} />
            <FieldError errors={errors.price ? [errors.price] : undefined} />
          </Field>

          <Field orientation="horizontal" className="items-end pb-2">
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
            <FieldLabel className="mb-0">Activo</FieldLabel>
          </Field>
        </div>

        <Field data-invalid={errors.imageUrl ? true : undefined}>
          <FieldLabel htmlFor="imageUrl">URL de imagen</FieldLabel>
          <Input id="imageUrl" {...register('imageUrl')} placeholder="https://…" aria-invalid={errors.imageUrl ? true : undefined} />
          <FieldError errors={errors.imageUrl ? [errors.imageUrl] : undefined} />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <FieldLegend variant="label">Productos del combo</FieldLegend>
              <FieldDescription>Agrega los productos incluidos y su cantidad.</FieldDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={products.length === 0}
              onClick={() => append({ productId: '', quantity: 1, allowSubstitution: false })}
            >
              <PlusIcon />
              Agregar producto
            </Button>
          </div>

          {errors.items?.message && <p className="mb-2 text-sm text-destructive">{errors.items.message}</p>}

          <div className="flex flex-col gap-2">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-end gap-2 rounded-md border p-3">
                <Field className="flex-1">
                  <FieldLabel className="text-xs">Producto</FieldLabel>
                  <Controller
                    control={control}
                    name={`items.${i}.productId`}
                    render={({ field }) => (
                      <Select
                        items={products.map((p) => ({ value: p.id, label: p.name }))}
                        value={field.value || null}
                        onValueChange={(v) => field.onChange(v ?? '')}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field className="w-24">
                  <FieldLabel className="text-xs">Cantidad</FieldLabel>
                  <Input type="number" min={1} {...register(`items.${i}.quantity`, { valueAsNumber: true })} />
                </Field>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Eliminar">
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : combo ? 'Guardar cambios' : 'Crear combo'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/menu?tab=combos" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
