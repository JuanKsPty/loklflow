import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { databaseOptions } from '../config/database.config';

// La CLI de TypeORM no pasa por el ConfigModule de Nest, así que carga el .env de la raíz.
loadEnv({ path: path.resolve(__dirname, '../../../../.env') });

/** Datasource para la CLI: generar y correr migraciones. */
export default new DataSource(databaseOptions() as DataSourceOptions);
