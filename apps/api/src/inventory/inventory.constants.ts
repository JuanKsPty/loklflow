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

/**
 * Los tres motivos que la pantalla ofrece de un toque al fijar el stock.
 *
 * Vocabulario cerrado y no texto libre: esto se usa en un teclado de móvil a las once de la noche.
 * La regla «una merma o un ajuste necesitan un motivo» **no se relaja** —sigue siendo imposible
 * dejar un descuadre sin explicación—, simplemente deja de exigir que se escriba.
 */
export const STOCK_SET_REASONS = ['count', 'purchase', 'waste'] as const;
export type StockSetReason = (typeof STOCK_SET_REASONS)[number];

const STOCK_SET_REASON_LABELS: Record<StockSetReason, string> = {
  count: 'Recuento',
  purchase: 'Compra',
  waste: 'Merma',
};

/**
 * El texto que acaba en `stock_movements.reason`.
 *
 * Se guarda la etiqueta y no el código porque el libro mayor lo lee una persona seis meses
 * después, no un programa. Si algún día hace falta un reporte de mermas, lo correcto es promover
 * el código a su propia columna, **no** hacer `WHERE reason LIKE 'Merma%'`.
 *
 * Los tres escriben `type: 'adjustment'`. La alternativa —`purchase` como entrada, `waste` como
 * merma— sería más veraz para ese reporte futuro, pero obliga a rechazar «Compra» con delta
 * negativo y «Merma» con delta positivo, que es un 400 incomprensible en un teléfono. Coste
 * asumido: hoy `type` no distingue un recuento de una merma.
 */
export function stockSetReason(code: StockSetReason, note?: string): string {
  const label = STOCK_SET_REASON_LABELS[code];
  const trimmed = note?.trim();
  return (trimmed ? `${label} · ${trimmed}` : label).slice(0, 255);
}
