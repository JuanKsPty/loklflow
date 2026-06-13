'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { Category, Modifier, Product } from '@loklflow/types';
import { productsApi } from '@/lib/api/menu.api';
import { productSchema, type ProductFormValues } from '@/lib/validations/menu.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldDescription, FieldGroup, FieldLegend } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

interface Props {
  product?: Product;
  categories: Category[];
  modifiers: Modifier[];
}

export function ProductForm({ product, categories, modifiers }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price ?? 0,
      imageUrl: product?.imageUrl ?? '',
      categoryId: product?.categoryId ?? '',
      isActive: product?.isActive ?? true,
      modifierIds: product?.modifiers?.map((m) => m.id) ?? [],
      availabilities:
        product?.availabilities?.map((a) => ({
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime.slice(0, 5),
          endTime: a.endTime.slice(0, 5),
          isAvailable: a.isAvailable,
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'availabilities' });

  const onSubmit = async (values: ProductFormValues) => {
    try {
      const payload = {
        name: values.name,
        price: values.price,
        isActive: values.isActive,
        modifierIds: values.modifierIds,
        availabilities: values.availabilities,
        ...(values.description ? { description: values.description } : {}),
        ...(values.imageUrl ? { imageUrl: values.imageUrl } : {}),
        ...(values.categoryId ? { categoryId: values.categoryId } : {}),
      };
      if (product) {
        await productsApi.update(product.id, payload);
      } else {
        await productsApi.create(payload);
      }
      toast.success(product ? 'Producto actualizado' : 'Producto creado');
      router.push('/admin/menu?tab=products');
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
          <Input id="name" {...register('name')} placeholder="Tacos al pastor" aria-invalid={errors.name ? true : undefined} />
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

          <Field className="flex-1">
            <FieldLabel>Categoría</FieldLabel>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value || null} onValueChange={(val) => field.onChange(val ?? '')}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </div>

        <Field data-invalid={errors.imageUrl ? true : undefined}>
          <FieldLabel htmlFor="imageUrl">URL de imagen</FieldLabel>
          <Input id="imageUrl" {...register('imageUrl')} placeholder="https://…" aria-invalid={errors.imageUrl ? true : undefined} />
          <FieldError errors={errors.imageUrl ? [errors.imageUrl] : undefined} />
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
          <FieldLabel className="mb-0">Activo</FieldLabel>
        </Field>

        {modifiers.length > 0 && (
          <div>
            <FieldLegend variant="label">Modificadores</FieldLegend>
            <FieldDescription className="mb-2">Grupos de opciones que aplican a este producto.</FieldDescription>
            <Controller
              control={control}
              name="modifierIds"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2">
                  {modifiers.map((m) => {
                    const checked = field.value.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            if (value) field.onChange([...field.value, m.id]);
                            else field.onChange(field.value.filter((id) => id !== m.id));
                          }}
                        />
                        {m.name}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <FieldLegend variant="label">Disponibilidad por horario</FieldLegend>
              <FieldDescription>Si no agregas ninguna, el producto está disponible siempre.</FieldDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ dayOfWeek: 1, startTime: '08:00', endTime: '22:00', isAvailable: true })}
            >
              <PlusIcon />
              Agregar
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-end gap-2 rounded-md border p-3">
                <Field className="w-40">
                  <FieldLabel className="text-xs">Día</FieldLabel>
                  <Controller
                    control={control}
                    name={`availabilities.${i}.dayOfWeek`}
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(val) => field.onChange(Number(val))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((d, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field className="w-32">
                  <FieldLabel className="text-xs">Desde</FieldLabel>
                  <Input type="time" {...register(`availabilities.${i}.startTime`)} />
                </Field>
                <Field className="w-32">
                  <FieldLabel className="text-xs">Hasta</FieldLabel>
                  <Input type="time" {...register(`availabilities.${i}.endTime`)} />
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
            {isSubmitting ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/menu?tab=products" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
