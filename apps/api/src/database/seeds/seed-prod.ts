import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { databaseOptions } from '../../config/database.config';
import { loadRootEnv } from '../../config/load-root-env';
import { seedPermissions } from './permissions.seed';
import { seedRoles } from './roles.seed';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { BusinessConfig } from '../../business-config/entities/business-config.entity';

/**
 * Siembra mínima para un despliegue real.
 *
 * `seed.ts` es la siembra de desarrollo: además de permisos y roles crea cuatro usuarios con
 * credenciales escritas en el código (`admin@loklflow.com` / `Admin1234!`, y tres PIN de
 * cuatro dígitos), un menú de ejemplo y unas mesas. Eso es justo lo que no puede acabar en un
 * servidor accesible desde internet: son credenciales públicas —están en un repo público— y
 * dan de alta a cuatro perfiles operativos que nadie pidió.
 *
 * Aquí se siembra lo que el sistema necesita para arrancar y nada más:
 *   1. permisos y roles, que son catálogo del sistema y sin ellos `PermissionsGuard` deniega
 *      todo (el guard lee los permisos del token, pero el token los copia del rol en la BD);
 *   2. un único administrador, con credenciales que vienen del entorno;
 *   3. la fila de `business_config`, que el recibo necesita.
 *
 * El menú y las mesas se quedan fuera a propósito: son datos del negocio, no del sistema, y
 * se dan de alta desde la propia aplicación.
 */
loadRootEnv();

const dataSource = new DataSource(databaseOptions() as DataSourceOptions);

/**
 * Sin valor por defecto, igual que `JWT_SECRET` en el arranque de la API.
 *
 * Un `?? 'admin@…'` aquí sería peor que no tener seed: el despliegue parecería correcto y
 * dejaría un administrador con contraseña conocida. Si falta la variable, el script se cae
 * antes de tocar la base.
 */
function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Falta ${name}. La siembra de producción no inventa credenciales: ` +
        `defínela en el entorno del contenedor y vuelve a ejecutar.`,
    );
  }
  return value;
}

/**
 * Se valida antes de abrir la conexión, no dentro de `seedAdmin`.
 *
 * Comprobándolo ahí, un despliegue al que se le olvidó `ADMIN_PASSWORD` ya había sembrado
 * permisos y roles cuando se caía: salida con dos ✓ verdes y un error al final, que es
 * exactamente la forma de fallar que se lee como «casi funcionó».
 */
function readAdminCredentials(): { email: string; password: string; name: string } {
  const email = requireEnv('ADMIN_EMAIL');
  const password = requireEnv('ADMIN_PASSWORD');

  // El caso de la contraseña de ejemplo va ANTES del largo: `Admin1234!` son diez
  // caracteres, así que la comprobación de longitud lo atrapaba primero y este mensaje
  // —el único que explica el problema real— no se llegaba a ver nunca.
  if (password === 'Admin1234!') {
    throw new Error(
      'ADMIN_PASSWORD es la contraseña de ejemplo del seed de desarrollo, que está ' +
        'publicada en el repositorio. Usa otra.',
    );
  }
  // La longitud se comprueba aquí y no solo en el DTO porque este camino no pasa por
  // `ValidationPipe`: el seed escribe directo en la tabla.
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
  }

  return { email, password, name: process.env.ADMIN_NAME?.trim() || 'Administrador' };
}

async function seedAdmin(ds: DataSource, admin: ReturnType<typeof readAdminCredentials>) {
  const { email, password, name } = admin;
  const usersRepo = ds.getRepository(User);
  const rolesRepo = ds.getRepository(Role);

  const adminRole = await rolesRepo.findOne({ where: { name: 'Administrador' } });
  if (!adminRole) {
    throw new Error('No existe el rol Administrador — seedRoles debería haberlo creado.');
  }

  const existing = await usersRepo.findOne({ where: { email } });
  if (existing) {
    // No se reescribe la contraseña: este script se ejecuta en cada despliegue y pisar la
    // contraseña dejaría al administrador fuera cada vez que alguien la cambie desde la app.
    console.log(`✓ El administrador ${email} ya existe — no se toca su contraseña`);
    return;
  }

  await usersRepo.save(
    usersRepo.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: adminRole,
      isActive: true,
    }),
  );
  console.log(`✓ Administrador creado: ${email}`);
}

async function seedBusinessConfig(ds: DataSource) {
  const repo = ds.getRepository(BusinessConfig);
  if (await repo.findOne({ where: {} })) {
    console.log('✓ business_config ya existe');
    return;
  }

  await repo.save(
    repo.create({
      businessName: process.env.BUSINESS_NAME?.trim() || 'Mi Negocio',
      timezone: process.env.BUSINESS_TIMEZONE?.trim() || 'America/Mexico_City',
      currency: process.env.BUSINESS_CURRENCY?.trim() || 'MXN',
    }),
  );
  console.log('✓ business_config creada');
}

async function main() {
  const admin = readAdminCredentials();

  await dataSource.initialize();
  console.log('Base conectada. Sembrando lo mínimo para producción...\n');

  await seedPermissions(dataSource);
  await seedRoles(dataSource);
  await seedAdmin(dataSource, admin);
  await seedBusinessConfig(dataSource);

  await dataSource.destroy();
  console.log('\nSiembra de producción completada.');
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('Seed de producción falló:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
