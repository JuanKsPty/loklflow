export const INGREDIENT_UNITS = ['kg', 'g', 'l', 'ml', 'units', 'portions'] as const;
export type IngredientUnit = (typeof INGREDIENT_UNITS)[number];

export const INGREDIENT_UNIT_LABELS: Record<IngredientUnit, string> = {
  kg: 'kg',
  g: 'g',
  l: 'L',
  ml: 'mL',
  units: 'unidades',
  portions: 'porciones',
};

export const STOCK_MOVEMENT_TYPES = ['entry', 'consumption', 'waste', 'adjustment'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  entry: 'Entrada',
  consumption: 'Consumo',
  waste: 'Merma',
  adjustment: 'Ajuste',
};

/** Los que una persona puede registrar. `consumption` lo escribe solo el cierre de cuenta. */
export const MANUAL_MOVEMENT_TYPES = ['entry', 'waste', 'adjustment'] as const;
export type ManualMovementType = (typeof MANUAL_MOVEMENT_TYPES)[number];

/**
 * Los tres motivos que la pantalla ofrece de un toque al fijar el stock.
 *
 * Vocabulario cerrado y no texto libre: esto se usa en un teclado de móvil. La regla «una merma o
 * un ajuste necesitan un motivo» no se relaja, simplemente deja de exigir que se escriba.
 */
export const STOCK_SET_REASONS = ['count', 'purchase', 'waste'] as const;
export type StockSetReason = (typeof STOCK_SET_REASONS)[number];

export const STOCK_SET_REASON_LABELS: Record<StockSetReason, string> = {
  count: 'Recuento',
  purchase: 'Compra',
  waste: 'Merma',
};

/** Lo que el botón le pregunta al operario, en su idioma y no en el del modelo de datos. */
export const STOCK_SET_REASON_PROMPTS: Record<StockSetReason, string> = {
  count: 'Conté y hay',
  purchase: 'Llegó mercancía',
  waste: 'Se dañó o se perdió',
};

/**
 * Cuántas unidades trae una caja, por defecto.
 *
 * Es el cartón de cerveza, que es de lo único que se compra por caja en un local así. Vive aquí
 * y **no en la base de datos** a propósito: es el valor con el que arranca la calculadora de la
 * pantalla de existencias, y quien la usa puede cambiarlo en el momento —hay cartones de 20, de
 * 12 y de 6—. Lo que viaja al servidor es siempre el total ya multiplicado, así que ningún dato
 * guardado depende de este número.
 */
export const DEFAULT_UNITS_PER_PACK = 24;
