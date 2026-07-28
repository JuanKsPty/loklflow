import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Opciones compartidas por la app y por el datasource de la CLI de TypeORM
 * (`src/database/data-source.ts`), para que ambos vean el mismo esquema.
 */
export const databaseOptions = (): TypeOrmModuleOptions & {
  type: 'postgres';
} => ({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER ?? 'loklflow',
  password: process.env.DATABASE_PASSWORD ?? 'loklflow',
  database: process.env.DATABASE_NAME ?? 'loklflow_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  // Nunca fuera de desarrollo: en producción el esquema se aplica con migraciones.
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
});

export default registerAs('database', databaseOptions);
