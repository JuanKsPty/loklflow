'use client';

import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { Modifier, Product, RestaurantTable } from '@loklflow/types';
import { ordersApi } from '@/lib/api/orders.api';
import { orderSchema, type OrderFormValues } from '@/lib/validations/order.schema';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  tables: RestaurantTable[];
  products: Product[];
  modifiers: Modifier[];
  defaultTableId?: string;
}

export function MobileOrderBuilder({ tables, products, modifiers, defaultTableId }: Props) {
  const router = useRouter();
  const productById = new Map(products.map((p) => [p.id, p]));
  const modifierById = new Map(modifiers.map((m) => [m.id, m]));

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      tableId: defaultTableId ?? '',
      notes: '',
      items: [{ productId: '', quantity: 1, notes: '', modifierOptionIds: [] }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  function modifiersForProduct(productId: string): Modifier[] {
    const product = productById.get(productId);
    if (!product?.modifiers) return [];
    return product.modifiers
      .map((m) => modifierById.get(m.id))
      .filter((m): m is Modifier => Boolean(m));
  }

  const onSubmit = async (values: OrderFormValues) => {
    try {
      const order = await ordersApi.create({
        ...(values.tableId ? { tableId: values.tableId } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
        items: values.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          ...(it.notes ? { notes: it.notes } : {}),
          ...(it.modifierOptionIds.length ? { modifierOptionIds: it.modifierOptionIds } : {}),
        })),
      });
      toast.success(`Orden #${order.orderNumber} enviada`);
      router.push(`/waiter/orden/${order.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la orden');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Field>
        <FieldLabel>Mesa</FieldLabel>
        <Controller
          control={control}
          name="tableId"
          render={({ field }) => (
            <Select
              items={tables.map((t) => ({ value: t.id, label: `Mesa ${t.number}` }))}
              value={field.value || null}
              onValueChange={(v) => field.onChange(v ?? '')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Para llevar (sin mesa)" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    Mesa {t.number}
                    {t.sector ? ` — ${t.sector.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Ítems</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ productId: '', quantity: 1, notes: '', modifierOptionIds: [] })}
        >
          <PlusIcon />
          Agregar
        </Button>
      </div>
      {errors.items?.message && <p className="text-sm text-destructive">{errors.items.message}</p>}

      <div className="flex flex-col gap-3">
        {fields.map((f, i) => {
          const productId = watch(`items.${i}.productId`);
          const itemModifiers = productId ? modifiersForProduct(productId) : [];
          return (
            <Card key={f.id}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-end gap-2">
                  <Field className="flex-1">
                    <FieldLabel className="text-xs">Producto</FieldLabel>
                    <Controller
                      control={control}
                      name={`items.${i}.productId`}
                      render={({ field }) => (
                        <Select
                          items={products.map((p) => ({ value: p.id, label: p.name }))}
                          value={field.value || null}
                          onValueChange={(v) => {
                            field.onChange(v ?? '');
                            setValue(`items.${i}.modifierOptionIds`, []);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} · {formatPrice(p.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field className="w-16">
                    <FieldLabel className="text-xs">Cant.</FieldLabel>
                    <Input type="number" min={1} {...register(`items.${i}.quantity`, { valueAsNumber: true })} />
                  </Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                    aria-label="Quitar ítem"
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                {itemModifiers.length > 0 && (
                  <Controller
                    control={control}
                    name={`items.${i}.modifierOptionIds`}
                    render={({ field }) => (
                      <div className="flex flex-col gap-2">
                        {itemModifiers.map((mod) => (
                          <div key={mod.id}>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">{mod.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {(mod.options ?? []).map((opt) => {
                                const checked = field.value.includes(opt.id);
                                return (
                                  <label
                                    key={opt.id}
                                    className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(v) => {
                                        if (v) field.onChange([...field.value, opt.id]);
                                        else field.onChange(field.value.filter((id) => id !== opt.id));
                                      }}
                                    />
                                    {opt.name}
                                    {Number(opt.priceAdjustment) > 0 && (
                                      <span className="text-muted-foreground">
                                        +{formatPrice(opt.priceAdjustment)}
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  />
                )}

                <Field>
                  <FieldLabel className="text-xs">Notas</FieldLabel>
                  <Input {...register(`items.${i}.notes`)} placeholder="Ej. sin cebolla" />
                </Field>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Field>
        <FieldLabel htmlFor="notes">Notas de la orden</FieldLabel>
        <Input id="notes" {...register('notes')} placeholder="Opcional" />
      </Field>

      <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
        {isSubmitting && <Spinner />}
        {isSubmitting ? 'Enviando…' : 'Enviar a cocina'}
      </Button>
    </form>
  );
}
