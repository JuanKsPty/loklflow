'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Category } from '@loklflow/types';
import { categoriesApi } from '@/lib/api/menu.api';
import { categorySchema, type CategoryFormValues } from '@/lib/validations/menu.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldDescription, FieldGroup } from '@/components/ui/field';

interface Props {
  category?: Category;
}

export function CategoryForm({ category }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      imageUrl: category?.imageUrl ?? '',
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive ?? true,
    },
  });

  const onSubmit = async (values: CategoryFormValues) => {
    try {
      const payload = {
        name: values.name,
        sortOrder: values.sortOrder ?? 0,
        isActive: values.isActive,
        ...(values.description ? { description: values.description } : {}),
        ...(values.imageUrl ? { imageUrl: values.imageUrl } : {}),
      };
      if (category) {
        await categoriesApi.update(category.id, payload);
      } else {
        await categoriesApi.create(payload);
      }
      toast.success(category ? 'Categoría actualizada' : 'Categoría creada');
      router.push('/admin/menu?tab=categories');
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
          <Input id="name" {...register('name')} placeholder="Entradas" aria-invalid={errors.name ? true : undefined} />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Descripción</FieldLabel>
          <Input id="description" {...register('description')} placeholder="Opcional" />
        </Field>

        <Field data-invalid={errors.imageUrl ? true : undefined}>
          <FieldLabel htmlFor="imageUrl">URL de imagen</FieldLabel>
          <Input id="imageUrl" {...register('imageUrl')} placeholder="https://…" aria-invalid={errors.imageUrl ? true : undefined} />
          <FieldError errors={errors.imageUrl ? [errors.imageUrl] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="sortOrder">Orden</FieldLabel>
          <Input id="sortOrder" type="number" min={0} {...register('sortOrder', { valueAsNumber: true })} className="w-32" />
          <FieldDescription>Menor número aparece primero.</FieldDescription>
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <FieldLabel className="mb-0">Activa</FieldLabel>
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : category ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/menu?tab=categories" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
