/** Una línea vendida: cuántas unidades de un producto salieron por esta cuenta. */
export interface SoldItem {
  productId: string;
  quantity: number;
}

/** Un producto que lleva sus propias existencias, y el ingrediente espejo que las cuenta. */
export interface MirrorLink {
  ingredientId: string;
  productId: string;
}

/** Una línea de receta: cuánto de un insumo lleva **una unidad** del producto. */
export interface RecipeLine {
  productId: string;
  ingredientId: string;
  quantity: number;
}

/** Cuánto se va de un ingrediente por esta cuenta. */
export interface Consumption {
  ingredientId: string;
  quantity: number;
}

export interface ConsumptionPlan {
  consumptions: Consumption[];
  /** Productos que tenían espejo **y** receta. Quien llama los deja por escrito; ver abajo. */
  conflicts: string[];
}

/**
 * Traduce lo que se vendió en lo que sale del inventario, por **dos caminos que nunca se suman**.
 *
 * 1. **Existencias propias.** Un ingrediente con `product_id` *es* ese producto: vender tres
 *    unidades resta tres.
 * 2. **Receta.** Un producto que se prepara descuenta sus insumos, `quantity` por unidad vendida.
 *
 * **Si un producto tuviera las dos cosas, gana el espejo y la receta se ignora.** Las dos reglas
 * que impiden esa combinación —`ProductStockService.ensureMirror` y `RecipesService.setForProduct`—
 * son read-then-write sobre tablas distintas, y no hay ninguna restricción de base capaz de
 * expresar «espejo o receta, nunca las dos». Así que la invariante se puede romper, y lo que
 * importa es qué pasa cuando se rompa: descontar por los dos caminos restaría cada venta **dos
 * veces, en silencio y para siempre**; preferir uno resta de menos como mucho, y deja el conflicto
 * por escrito para que alguien lo arregle.
 *
 * Va aparte del servicio y sin TypeORM porque es la parte que decide, y la que decide se prueba
 * sin base de datos. Misma convención que `order-totals.ts` y `arqueo.ts`.
 */
export function aggregateConsumptions(
  items: SoldItem[],
  mirrors: MirrorLink[],
  recipes: RecipeLine[],
): ConsumptionPlan {
  // Las unidades se suman por producto **antes** de nada: una cuenta puede llevar el mismo
  // producto en dos líneas —notas distintas, modificadores distintos— y los dos caminos de abajo
  // tienen que ver el total vendido, no la primera línea que aparezca.
  const soldByProduct = new Map<string, number>();
  for (const item of items) {
    soldByProduct.set(item.productId, (soldByProduct.get(item.productId) ?? 0) + item.quantity);
  }

  const mirrorByProduct = new Map(mirrors.map((m) => [m.productId, m.ingredientId]));
  const byIngredient = new Map<string, number>();
  const conflicts: string[] = [];

  const add = (ingredientId: string, quantity: number) =>
    byIngredient.set(ingredientId, (byIngredient.get(ingredientId) ?? 0) + quantity);

  for (const [productId, sold] of soldByProduct) {
    const mirrorId = mirrorByProduct.get(productId);
    if (mirrorId) {
      add(mirrorId, sold);
      if (recipes.some((r) => r.productId === productId)) conflicts.push(productId);
      continue; // ← la línea que impide el doble descuento. Ver la nota de arriba.
    }
    for (const line of recipes) {
      if (line.productId === productId) add(line.ingredientId, line.quantity * sold);
    }
  }

  return {
    consumptions: [...byIngredient].map(([ingredientId, quantity]) => ({
      ingredientId,
      // Tres decimales, los mismos que la columna: sin esto, sumar 0.1 tres veces deja un
      // 0.30000000000000004 en la base y el historial se llena de ruido.
      quantity: Number(quantity.toFixed(3)),
    })),
    conflicts,
  };
}
