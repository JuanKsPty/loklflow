import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fusión de cuentas: la clave ajena, el índice y la columna que hace reversible la operación.
 *
 * `orders.merged_into_order_id` existía desde el esquema inicial —suelta, sin clave ajena, sin
 * índice y sin que ninguna consulta la leyera jamás—. Estaba ahí esperando a este momento.
 *
 * **`ON DELETE SET NULL`, nunca CASCADE.** Borrar la cuenta destino no puede llevarse por delante
 * el histórico de las cuentas que se fusionaron en ella; lo correcto es que dejen de apuntar a
 * nada, no que desaparezcan.
 *
 * **`order_items.original_order_id` es lo que hace exacto el deshacer.** Sin ella no hay forma de
 * saber qué líneas se movieron y cuáles ya estaban en la cuenta destino, así que «no se puede
 * deshacer» sería la única respuesta honesta — y en algo que toca el dinero eso es una verruga, no
 * una simplificación. Es una columna nullable: lo que nunca se movió la deja en null.
 *
 * Escrita a mano y no generada: `synchronize` está activo en desarrollo, así que generarla contra
 * una base que ya lo aplicó produce un diff vacío (CLAUDE.md).
 */
export class OrderMerge1786600000000 implements MigrationInterface {
  name = 'OrderMerge1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "FK_orders_merged_into"
      FOREIGN KEY ("merged_into_order_id") REFERENCES "orders"("id") ON DELETE SET NULL
    `);

    // Todas las consultas operativas pasan a filtrar por esta columna, así que sin índice cada
    // listado del salón haría un recorrido completo de la tabla de órdenes.
    await queryRunner.query(
      `CREATE INDEX "idx_orders_merged_into" ON "orders" ("merged_into_order_id")`,
    );

    await queryRunner.query(`ALTER TABLE "order_items" ADD "original_order_id" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN "original_order_id"`);
    await queryRunner.query(`DROP INDEX "idx_orders_merged_into"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_merged_into"`);
  }
}
