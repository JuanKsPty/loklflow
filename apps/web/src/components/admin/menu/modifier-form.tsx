'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { Modifier } from '@loklflow/types';
import { modifiersApi } from '@/lib/api/menu.api';
import { modifierSchema, type ModifierFormValues } from '@/lib/validations/menu.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldLabel, FieldError, FieldDescription, FieldGroup, FieldLegend } from '@/components/ui/field';

interface Props {
  modifier?: Modifier;
}

export function ModifierForm({ modifier }: Props) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ModifierFormValues>({
    resolver: zodResolver(modifierSchema),
    defaultValues: {
      name: modifier?.name ?? '',
      isRequired: modifier?.isRequired ?? false,
      allowMultiple: modifier?.allowMultiple ?? false,
      minSelections: modifier?.minSelections ?? 0,
      maxSelections: modifier?.maxSelections ?? null,
      options:
        modifier?.options?.map((o) => ({
          name: o.name,
          priceAdjustment: o.priceAdjustment,
          isDefault: o.isDefault,
          sortOrder: o.sortOrder,
          isActive: o.isActive,
        })) ?? [{ name: '', priceAdjustment: 0, isDefault: false, sortOrder: 0, isActive: true }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'options' });

  const onSubmit = async (values: ModifierFormValues) => {
    try {
      const payload = {
        name: values.name,
        isRequired: values.isRequired,
        allowMultiple: values.allowMultiple,
        minSelections: values.minSelections,
        maxSelections: values.maxSelections,
        options: values.options.map((o, idx) => ({ ...o, sortOrder: idx })),
      };
      if (modifier) {
        await modifiersApi.update(modifier.id, payload);
      } else {
        await modifiersApi.create(payload);
      }
      toast.success(modifier ? 'Modificador actualizado' : 'Modificador creado');
      router.push('/admin/menu?tab=modifiers');
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
          <Input id="name" {...register('name')} placeholder="Término de la carne" aria-invalid={errors.name ? true : undefined} />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <div className="flex gap-6">
          <Field orientation="horizontal">
            <Controller
              control={control}
              name="isRequired"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
            <FieldLabel className="mb-0">Obligatorio</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Controller
              control={control}
              name="allowMultiple"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
            <FieldLabel className="mb-0">Permite varias</FieldLabel>
          </Field>
        </div>

        <div className="flex gap-4">
          <Field className="max-w-40">
            <FieldLabel htmlFor="minSelections">Mín. selecciones</FieldLabel>
            <Input id="minSelections" type="number" min={0} {...register('minSelections', { valueAsNumber: true })} />
          </Field>
          <Field className="max-w-40">
            <FieldLabel htmlFor="maxSelections">Máx. selecciones</FieldLabel>
            <Input
              id="maxSelections"
              type="number"
              min={1}
              placeholder="Sin límite"
              {...register('maxSelections', {
                setValueAs: (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
              })}
            />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <FieldLegend variant="label">Opciones</FieldLegend>
              <FieldDescription>Cada opción puede sumar al precio base del producto.</FieldDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: '', priceAdjustment: 0, isDefault: false, sortOrder: fields.length, isActive: true })}
            >
              <PlusIcon />
              Agregar opción
            </Button>
          </div>

          {errors.options?.message && (
            <p className="mb-2 text-sm text-destructive">{errors.options.message}</p>
          )}

          <div className="flex flex-col gap-2">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-end gap-2 rounded-md border p-3">
                <Field className="flex-1">
                  <FieldLabel className="text-xs">Nombre</FieldLabel>
                  <Input {...register(`options.${i}.name`)} placeholder="Término medio" />
                </Field>
                <Field className="w-32">
                  <FieldLabel className="text-xs">Ajuste $</FieldLabel>
                  <Input type="number" step="0.01" {...register(`options.${i}.priceAdjustment`, { valueAsNumber: true })} />
                </Field>
                <Field orientation="horizontal" className="pb-2">
                  <Controller
                    control={control}
                    name={`options.${i}.isDefault`}
                    render={({ field }) => (
                      <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} />
                    )}
                  />
                  <FieldLabel className="mb-0 text-xs">Predet.</FieldLabel>
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
            {isSubmitting ? 'Guardando…' : modifier ? 'Guardar cambios' : 'Crear modificador'}
          </Button>
          <Button variant="ghost" size="lg" nativeButton={false} render={<Link href="/admin/menu?tab=modifiers" />}>
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
