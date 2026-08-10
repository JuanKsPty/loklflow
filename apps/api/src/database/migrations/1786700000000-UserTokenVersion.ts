import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revocación efectiva de sesiones.
 *
 * `JwtStrategy.validate` solo comprobaba que el token tuviera `sub` y `PermissionsGuard` lee los
 * permisos **del token**, así que desactivar a un empleado, cambiarle el rol o quitarle un permiso
 * **no tenía ningún efecto** hasta que el token caducara: cuatro horas para una sesión por PIN, y su
 * token de refresco vive doce sin revalidar nada. Un empleado despedido conservaba acceso operativo
 * durante media jornada.
 *
 * Un contador por usuario resuelve eso sin consultar la base en cada petición. Se firma dentro del
 * token, y una sesión cuyo contador no coincide con el actual deja de valer en la siguiente
 * petición.
 *
 * `DEFAULT 0` y `NOT NULL`: todos los usuarios existentes arrancan en la misma versión, y los
 * tokens ya emitidos —que no llevan el campo— se tratan como versión 0. Así **este despliegue no
 * echa a nadie**, que es lo que permite aplicarlo con el local abierto.
 */
export class UserTokenVersion1786700000000 implements MigrationInterface {
  name = 'UserTokenVersion1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
  }
}
