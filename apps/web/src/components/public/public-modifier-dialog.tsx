'use client';

import { useMemo, useState } from 'react';
import type { PublicModifier, PublicProduct } from '@loklflow/types';
import { formatPrice } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Elegir modificadores antes de añadir un producto al carrito.
 *
 * Las reglas de cada grupo las decide el negocio (`isRequired`, `allowMultiple`, `minSelections`,
 * `maxSelections`) y aquí se **aplican en la interfaz**: el botón de añadir no se habilita hasta que
 * la selección es válida. El servidor las volverá a comprobar —nunca se confía en el cliente—, pero
 * enterarse al enviar, con el carrito lleno, es una forma pésima de descubrir que faltaba elegir el
 * término de la carne.
 */
export function PublicModifierDialog({
  product,
  open,
  onOpenChange,
  onConfirm,
}: {
  product: PublicProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (optionIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  // Las opciones marcadas por defecto son la sugerencia del negocio, así que se preseleccionan.
  const initial = useMemo(() => {
    const base: Record<string, string[]> = {};
    for (const modifier of product?.modifiers ?? []) {
      base[modifier.id] = modifier.options.filter((o) => o.isDefault).map((o) => o.id);
    }
    return base;
  }, [product]);

  // `key` sobre el producto hace que el estado se reinicie al abrir otro: sin eso, las opciones
  // del producto anterior se arrastrarían al siguiente.
  const current = Object.keys(selected).length > 0 ? selected : initial;

  if (!product) return null;
  const producto = product;

  function toggle(modifier: PublicModifier, optionId: string) {
    const chosen = current[modifier.id] ?? [];
    const isOn = chosen.includes(optionId);

    let next: string[];
    if (modifier.allowMultiple) {
      next = isOn ? chosen.filter((id) => id !== optionId) : [...chosen, optionId];
      // El tope del grupo: si ya está lleno, la marca nueva no entra.
      if (modifier.maxSelections !== null && next.length > modifier.maxSelections) return;
    } else {
      // Grupo de una sola opción: elegir sustituye, no acumula.
      next = isOn && !modifier.isRequired ? [] : [optionId];
    }

    setSelected({ ...current, [modifier.id]: next });
  }

  const invalid = producto.modifiers.filter((m) => {
    const chosen = (current[m.id] ?? []).length;
    if (m.isRequired && chosen === 0) return true;
    if (chosen < m.minSelections) return true;
    return false;
  });

  const extra = producto.modifiers.reduce((sum, m) => {
    const chosen = current[m.id] ?? [];
    return (
      sum +
      m.options
        .filter((o) => chosen.includes(o.id))
        .reduce((s, o) => s + Number(o.priceAdjustment), 0)
    );
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={producto.id} className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producto.name}</DialogTitle>
          {producto.description && <DialogDescription>{producto.description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {producto.modifiers.map((modifier) => (
            <fieldset key={modifier.id} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                {modifier.name}
                {modifier.isRequired && <span className="ml-1 text-destructive">*</span>}
                {modifier.allowMultiple && modifier.maxSelections !== null && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (elige hasta {modifier.maxSelections})
                  </span>
                )}
              </legend>
              {modifier.options.map((option) => {
                const chosen = (current[modifier.id] ?? []).includes(option.id);
                return (
                  <label
                    key={option.id}
                    // 44 px de alto: se toca con el pulgar, de pie y con una mano.
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2"
                  >
                    <Checkbox
                      checked={chosen}
                      onCheckedChange={() => toggle(modifier, option.id)}
                    />
                    <span className="flex-1 text-sm">{option.name}</span>
                    {Number(option.priceAdjustment) !== 0 && (
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {Number(option.priceAdjustment) > 0 ? '+' : ''}
                        {formatPrice(Number(option.priceAdjustment))}
                      </span>
                    )}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        <DialogFooter>
          <Button
            className="h-12 max-sm:h-12 w-full"
            disabled={invalid.length > 0}
            onClick={() => {
              onConfirm(Object.values(current).flat());
              setSelected({});
            }}
          >
            {invalid.length > 0
              ? `Elige ${invalid[0].name.toLowerCase()}`
              : `Añadir · ${formatPrice(Number(producto.price) + extra)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
