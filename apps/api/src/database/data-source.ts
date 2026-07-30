import { DataSource, type DataSourceOptions } from 'typeorm';
import { databaseOptions } from '../config/database.config';
import { loadRootEnv } from '../config/load-root-env';

// La CLI de TypeORM no pasa por el ConfigModule de Nest, así que carga el .env de la raíz.
loadRootEnv();

/** Datasource para la CLI: generar y correr migraciones. */
export default new DataSource(databaseOptions() as DataSourceOptions);
