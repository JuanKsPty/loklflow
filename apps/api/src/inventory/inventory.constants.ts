/**
 * Unidades en las que se mide un ingrediente.
 *
 * No hay conversión entre ellas a propósito: la receta se expresa en la misma unidad que el
 * ingrediente. Convertir gramos a kilos automáticamente parece un favor y es una fuente de
 * errores de tres órdenes de magnitud en el costo de un plato.
 */
export const INGREDIENT_UNITS = ['kg', 'g', 'l', 'ml', 'units', 'portions'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

/**
 * Tipos de movimiento de stock.
 *
 * - `entry` — entrada de mercancía. Suma, y es el único que lleva proveedor.
 * - `consumption` — consumo por venta. Resta, y es el único que lleva orden.
 * - `waste` — merma. Resta.
 * - `adjustment` — corrección de inventario. Suma o resta.
 *
 * `stock_movements` es **append-only**: el stock nunca se corrige editando una fila ni
 * escribiendo directamente en `ingredients.current_stock`, sino añadiendo un `adjustment`.
 * Es lo que permite que el historial explique cómo se llegó al número que hay hoy.
 */
export const STOCK_MOVEMENT_TYPES = ['entry', 'consumption', 'waste', 'adjustment'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
