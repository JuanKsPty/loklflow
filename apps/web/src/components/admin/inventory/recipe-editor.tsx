'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import type { Ingredient, RecipeIngredient } from '@loklflow/types';
import { INGREDIENT_UNIT_LABELS } from '@loklflow/types';
import { inventoryApi } from '@/lib/api/inventory.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  productId: string;
  ingredients: Ingredient[];
  recipe: RecipeIngredient[];
}

interface Line {
  ingredientId: string;
  quantity: number;
}

/**
 * La receta de un producto: cuánto de cada ingrediente lleva **una unidad**.
 *
 * Se guarda entera de una vez, no línea a línea, porque el servidor la reemplaza completa.
 * Un producto sin líneas es un estado válido: no descuenta nada al venderse, que es lo que
 * quiere un negocio que aún no ha cargado su inventario.
 */
export function RecipeEditor({ productId, ingredients, recipe }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>(
    recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
  );
  const [saving, setSaving] = useState(false);

  // Un ingrediente no puede repetirse en la misma receta: el servidor lo rechaza y la base
  // tiene un índice único. Se filtra aquí para que no llegue a ofrecerse.
  const used = new Set(lines.map((l) => l.ingredientId));
  const available = ingredients.filter((i) => i.isActive && !used.has(i.id));

  const unitOf = (ingredientId: string) => {
    const found = ingredients.find((i) => i.id === ingredientId);
    return found ? INGREDIENT_UNIT_LABELS[found.unit] : '';
  };

  async function save() {
    setSaving(true);
    try {
      await inventoryApi.recipes.set(productId, {
        lines: lines.filter((l) => l.ingredientId && l.quantity > 0),
      });
      toast.success('Receta guardada');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-8 max-w-lg">
      <CardHeader>
        <CardTitle>Receta</CardTitle>
        <CardDescription>
          Cuánto se va de cada ingrediente por unidad vendida. Se descuenta solo al cobrar la
          cuenta. Sin líneas, este producto no toca el inventario.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay ingredientes dados de alta.
          </p>
        ) : (
          <>
            {lines.map((line, index) => (
              <div key={line.ingredientId || index} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {ingredients.find((i) => i.id === line.ingredientId)?.name ?? '—'}
                </span>
                <Input
                  type="number"
                  step="0.001"
                  min={0}
                  value={line.quantity}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === index ? { ...l, quantity: Number(e.target.value) } : l,
                      ),
                    )
                  }
                  className="w-28"
                />
                <span className="w-16 text-xs text-muted-foreground">
                  {unitOf(line.ingredientId)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  aria-label="Quitar ingrediente"
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}

            {available.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setLines((prev) => [...prev, { ingredientId: e.target.value, quantity: 1 }]);
                  }}
                >
                  <option value="">Añadir ingrediente…</option>
                  {available.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <PlusIcon className="size-4 shrink-0 text-muted-foreground" />
              </div>
            )}

            <div className="pt-1">
              <Button onClick={save} disabled={saving}>
                {saving && <Spinner />}
                Guardar receta
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
