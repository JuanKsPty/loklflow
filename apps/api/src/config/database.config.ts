import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * SSL solo si se pide explícitamente con `DATABASE_SSL=true`.
 *
 * No se deduce de que exista `DATABASE_URL`: el Postgres de docker-compose y el servicio
 * del runner de CI también se conectan por URL y no hablan TLS, así que deducirlo
 * rompería el desarrollo y el pipeline.
 *
 * `rejectUnauthorized: false` porque los Postgres gestionados firman con su propia CA,
 * que no está en el trust store de la imagen; sin esto la conexión muere con
 * SELF_SIGNED_CERT_IN_CHAIN.
 */
function sslOptions(): { rejectUnauthorized: boolean } | undefined {
  return process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined;
}

/**
 * Opciones compartidas por la app y por el datasource de la CLI de TypeORM
 * (`src/database/data-source.ts`), para que ambos vean el mismo esquema.
 *
 * Los globs llevan `{.ts,.js}` a propósito: así estas mismas opciones sirven desde `src/`
 * con ts-node en desarrollo y desde `dist/` con node dentro de un contenedor.
 *
 * **`DATABASE_URL` tiene precedencia sobre las variables sueltas**, porque es lo que
 * entrega cualquier Postgres gestionado y lo que se pasa a un contenedor. Ojo con la
 * consecuencia: mientras la URL esté definida, cambiar solo `DATABASE_NAME` no tiene
 * ningún efecto — hay que cambiar también la base dentro de la URL. Es justo lo que hace
 * el arranque de los tests de integración para no escribir en la base de desarrollo.
 */
export const databaseOptions = (): TypeOrmModuleOptions & {
  type: 'postgres';
} => {
  const common = {
    type: 'postgres' as const,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    // Nunca fuera de desarrollo: en producción el esquema se aplica con migraciones.
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.NODE_ENV === 'development',
    ssl: sslOptions(),
  };

  if (process.env.DATABASE_URL) {
    return { ...common, url: process.env.DATABASE_URL };
  }

  return {
    ...common,
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'loklflow',
    password: process.env.DATABASE_PASSWORD ?? 'loklflow',
    database: process.env.DATABASE_NAME ?? 'loklflow_db',
  };
};

export default registerAs('database', databaseOptions);
