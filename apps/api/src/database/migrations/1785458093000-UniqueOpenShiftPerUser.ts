import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Un solo turno de caja abierto por usuario, garantizado por la base de datos.
 *
 * Hasta ahora la exclusividad era únicamente un *read-then-write* en
 * `ShiftsService.openShift`: consultar si hay turno abierto y, si no, crearlo. Entre las dos
 * consultas cabe otra petición, así que **un doble clic o dos pestañas abren dos turnos**. Y
 * con dos turnos abiertos el arqueo deja de tener sentido: `currentForUser` devuelve uno
 * arbitrario, los pagos se reparten entre ambos y ninguno cuadra.
 *
 * El índice es **parcial**: solo aplica a las filas con `status = 'open'`, así que un usuario
 * puede acumular todos los turnos cerrados que quiera.
 *
 * La comprobación del servicio se conserva: da un mensaje claro en el caso normal, y el índice
 * es la red que cubre la carrera.
 */
export class UniqueOpenShiftPerUser1785458093000 implements MigrationInterface {
  name = 'UniqueOpenShiftPerUser1785458093000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Si ya hubiera duplicados de antes, el índice no se podría crear. Se cierran los turnos
    // abiertos sobrantes de cada usuario dejando el más reciente, que es el que la interfaz
    // venía mostrando.
    await queryRunner.query(`
      UPDATE "shifts" SET status = 'closed', closed_at = COALESCE(closed_at, now())
      WHERE status = 'open'
        AND id NOT IN (
          SELECT DISTINCT ON (opened_by) id
          FROM "shifts"
          WHERE status = 'open'
          ORDER BY opened_by, opened_at DESC
        )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_shifts_one_open_per_user" ON "shifts" ("opened_by") WHERE status = 'open'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_shifts_one_open_per_user"`);
  }
}
