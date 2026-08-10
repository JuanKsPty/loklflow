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
