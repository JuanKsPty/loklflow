'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowRightLeftIcon } from 'lucide-react';
import type { Ingredient, Supplier } from '@loklflow/types';
import { INGREDIENT_UNIT_LABELS, STOCK_MOVEMENT_LABELS } from '@loklflow/types';
import { inventoryApi } from '@/lib/api/inventory.api';
import { movementSchema, type MovementFormValues } from '@/lib/validations/inventory.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  ingredients: Ingredient[];
  suppliers: Supplier[];
}


/**
 * Registrar entrada de mercancía, merma o ajuste.
 *
 * La cantidad se pide **siempre positiva** y el signo lo decide el tipo. Pedir un número con
 * signo es cómo se acaba sumando una merma por escribir 5 en vez de −5, y el error solo se ve
 * semanas después, cuando el inventario ya no cuadra con nada.
 */
export function MovementDialog({ ingredients, suppliers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { type: 'entry', quantity: 0, direction: 'increase' },
  });

  // `useWatch` y no `watch()`: el React Compiler no puede memoizar el segundo —devuelve una
  // función nueva en cada render— y se salta la optimización del componente entero.
  const type = useWatch({ control, name: 'type' });
  const ingredientId = useWatch({ control, name: 'ingredientId' });
  const selected = ingredients.find((i) => i.id === ingredientId);

  const onSubmit = async (values: MovementFormValues) => {
    try {
      await inventoryApi.movements.create({
        ingredientId: values.ingredientId,
        type: values.type,
        quantity: values.quantity,
        ...(values.type === 'adjustment' ? { direction: values.direction ?? 'increase' } : {}),
        ...(values.reason?.trim() ? { reason: values.reason.trim() } : {}),
        ...(values.type === 'entry' && values.supplierId ? { supplierId: values.supplierId } : {}),
        ...(values.type === 'entry' && values.costPerUnit
          ? { costPerUnit: values.costPerUnit }
          : {}),
      });
      toast.success('Movimiento registrado');
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <ArrowRightLeftIcon />
            Registrar movimiento
          </Button>
        }
      />
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>
              El consumo por venta no se registra aquí: lo escribe el cierre de cuenta.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-2">
            <Field data-invalid={errors.ingredientId ? true : undefined}>
              <FieldLabel htmlFor="ingredientId">Ingrediente</FieldLabel>
              <Controller
                control={control}
                name="ingredientId"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(val) => field.onChange(val ?? '')}
                  >
                    <SelectTrigger className="w-full" aria-invalid={errors.ingredientId ? true : undefined}>
                      <SelectValue placeholder="Elige uno…" />
                    </SelectTrigger>
                    <SelectContent>
                      {ingredients
                        .filter((i) => i.isActive)
                        .map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.currentStock} {INGREDIENT_UNIT_LABELS[i.unit]})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={errors.ingredientId ? [errors.ingredientId] : undefined} />
            </Field>

            <Field>
              <FieldLabel htmlFor="type">Tipo</FieldLabel>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value || null}
                    onValueChange={(val) => field.onChange(val ?? '')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tipo de movimiento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">
                        {STOCK_MOVEMENT_LABELS.entry} de mercancía
                      </SelectItem>
                      <SelectItem value="waste">{STOCK_MOVEMENT_LABELS.waste}</SelectItem>
                      <SelectItem value="adjustment">
                        {STOCK_MOVEMENT_LABELS.adjustment} de inventario
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field data-invalid={errors.quantity ? true : undefined}>
              <FieldLabel htmlFor="quantity">
                Cantidad {selected ? `(${INGREDIENT_UNIT_LABELS[selected.unit]})` : ''}
              </FieldLabel>
              <Input
                id="quantity"
                type="number"
                step="0.001"
                min={0}
                {...register('quantity', { valueAsNumber: true })}
              />
              <FieldError errors={errors.quantity ? [errors.quantity] : undefined} />
            </Field>

            {type === 'adjustment' && (
              <Field>
                <FieldLabel htmlFor="direction">Dirección</FieldLabel>
                <Controller
                  control={control}
                  name="direction"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? 'increase'}
                      onValueChange={(val) => field.onChange(val ?? 'increase')}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Dirección" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase">Sumar al stock</SelectItem>
                        <SelectItem value="decrease">Restar del stock</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}

            {type === 'entry' && (
              <>
                <Field>
                  <FieldLabel htmlFor="supplierId">Proveedor</FieldLabel>
                  <Controller
                    control={control}
                    name="supplierId"
                    render={({ field }) => (
                      <Select
                        value={field.value || null}
                        onValueChange={(val) => field.onChange(val ?? '')}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin especificar" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers
                            .filter((s) => s.isActive)
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="costPerUnit">Costo por unidad de esta compra</FieldLabel>
                  <Input
                    id="costPerUnit"
                    type="number"
                    step="0.0001"
                    min={0}
                    {...register('costPerUnit', { valueAsNumber: true })}
                  />
                </Field>
              </>
            )}

            <Field data-invalid={errors.reason ? true : undefined}>
              <FieldLabel htmlFor="reason">
                Motivo {type === 'entry' ? '(opcional)' : ''}
              </FieldLabel>
              <Input
                id="reason"
                {...register('reason')}
                placeholder={type === 'waste' ? 'Se echó a perder' : 'Recuento físico'}
              />
              <FieldError errors={errors.reason ? [errors.reason] : undefined} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" disabled={isSubmitting} />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
