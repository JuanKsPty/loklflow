import { ValueTransformer } from 'typeorm';

/**
 * Convierte columnas `decimal`/`numeric` de Postgres (que TypeORM devuelve como string)
 * a `number` en JS, para poder operar aritméticamente con precios y ajustes.
 */
export const DecimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : parseFloat(value)),
};
