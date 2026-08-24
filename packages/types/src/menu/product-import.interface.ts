import type { PreparationStation } from './preparation-station';

/** Una fila del CSV, ya interpretada. El cuerpo se construye campo a campo; ver `toPayload`. */
export interface ImportProductRow {
  /** La línea **del archivo**, para poder decir «línea 34» y no «fila 12 del lote 3». */
  line: number;
  name: string;
  description?: string;
  price: number;
  categoryName?: string;
  station?: PreparationStation;
  isActive?: boolean;
  stock?: number;
  minimumStock?: number;
}

export interface ImportProductsPayload {
  rows: ImportProductRow[];
  createMissingCategories?: boolean;
}

export interface ImportRowResult {
  line: number;
  name: string;
  status: 'created' | 'updated' | 'failed';
  productId?: string;
  reason?: string;
}

export interface ImportProductsResult {
  created: number;
  updated: number;
  failed: number;
  categoriesCreated: string[];
  rows: ImportRowResult[];
}
