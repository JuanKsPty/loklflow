'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import type { Ingredient } from '@loklflow/types';
import { INGREDIENT_UNITS, INGREDIENT_UNIT_LABELS } from '@loklflow/types';
import { inventoryApi } from '@/lib/api/inventory.api';
import { ingredientSchema, type IngredientFormValues } from '@/lib/validations/inventory.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';

interface Props {
  ingredient?: Ingredient;
}

export function IngredientForm({ ingredient }: Props) {
  const router = useRouter();
  const editing = Boolean(ingredient);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: {
      name: ingredient?.name ?? '',
      unit: ingredient?.unit ?? 'kg',
      initialStock: 0,
      minimumStock: ingredient?.minimumStock ?? 0,
      costPerUnit: ingredient?.costPerUnit ?? 0,
      isActive: ingredient?.isActive ?? true,
    },
  });

  const onSubmit = async (values: IngredientFormValues) => {
    try {
      if (ingredient) {
        // `initialStock` no se manda al editar: el stock se mueve, nunca se edita. Para
        // corregirlo está el ajuste, que deja movimiento y explica el cambio.
        await inventoryApi.ingredients.update(ingredient.id, {
          name: values.name,
          unit: values.unit,
          minimumStock: values.minimumStock ?? 0,
          costPerUnit: values.costPerUnit ?? 0,
          isActive: values.isActive,
        });
      } else {
        await inventoryApi.ingredients.create({
          name: values.name,
          unit: values.unit,
          initialStock: values.initialStock ?? 0,
          minimumStock: values.minimumStock ?? 0,
          costPerUnit: values.costPerUnit ?? 0,
          isActive: values.isActive,
        });
      }
      toast.success(editing ? 'Ingrediente actualizado' : 'Ingrediente creado');
      router.push('/admin/inventario');
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
          <Input
            id="name"
            {...register('name')}
            placeholder="Tomate"
            aria-invalid={errors.name ? true : undefined}
          />
          <FieldError errors={errors.name ? [errors.name] : undefined} />
        </Field>

        <Field>
          <FieldLabel htmlFor="unit">Unidad</FieldLabel>
          <select
            id="unit"
            {...register('unit')}
            className="h-9 w-40 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {INGREDIENT_UNITS.map((u) => (
              <option key={u} value={u}>
                {INGREDIENT_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
          <FieldDescription>
            No hay conversión entre unidades: la receta se escribe en esta misma.
          </FieldDescription>
        </Field>

        {!editing && (
          <Field data-invalid={errors.initialStock ? true : undefined}>
            <FieldLabel htmlFor="initialStock">Existencias iniciales</FieldLabel>
            <Input
              id="initialStock"
              type="number"
              step="0.001"
              min={0}
              className="w-40"
              {...register('initialStock', { valueAsNumber: true })}
            />
            <FieldDescription>
              Se registra como un ajuste en el historial, no como un número que aparece de la
              nada.
            </FieldDescription>
            <FieldError errors={errors.initialStock ? [errors.initialStock] : undefined} />
          </Field>
        )}

        <Field data-invalid={errors.minimumStock ? true : undefined}>
          <FieldLabel htmlFor="minimumStock">Mínimo antes de avisar</FieldLabel>
          <Input
            id="minimumStock"
            type="number"
            step="0.001"
            min={0}
            className="w-40"
            {...register('minimumStock', { valueAsNumber: true })}
          />
          <FieldDescription>
            Al cruzarlo se avisa a gerencia, una sola vez. En cero no se avisa nunca.
          </FieldDescription>
          <FieldError errors={errors.minimumStock ? [errors.minimumStock] : undefined} />
        </Field>

        <Field data-invalid={errors.costPerUnit ? true : undefined}>
          <FieldLabel htmlFor="costPerUnit">Costo por unidad</FieldLabel>
          <Input
            id="costPerUnit"
            type="number"
            step="0.0001"
            min={0}
            className="w-40"
            {...register('costPerUnit', { valueAsNumber: true })}
          />
          <FieldDescription>
            Se actualiza solo con cada entrada, promediado con lo que ya había.
          </FieldDescription>
          <FieldError errors={errors.costPerUnit ? [errors.costPerUnit] : undefined} />
        </Field>

        <Field orientation="horizontal">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
          />
          <FieldLabel className="mb-0">Activo</FieldLabel>
        </Field>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear ingrediente'}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            nativeButton={false}
            render={<Link href="/admin/inventario" />}
          >
            Cancelar
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
