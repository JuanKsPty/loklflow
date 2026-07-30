import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prepara la sincronización sin conexión de la Fase 4, cerrando dos formas de duplicar.
 *
 * 1. `orders.order_number` pasa a salir de una secuencia. Antes se calculaba con un
 *    `MAX(order_number) + 1` leído fuera de transacción, con un único reintento si chocaba.
 *    Eso no es una precaución teórica: ocho creaciones simultáneas devolvían **500**, porque
 *    varias calculaban el mismo número, la primera ganaba y el reintento de las demás
 *    volvía a colisionar entre sí. Con dos meseros tomando nota a la vez la orden se
 *    perdía. Una secuencia lo resuelve en la base de datos, sin código y sin reintentos.
 *
 * 2. `payments.client_request_id` con índice único, para que un pago reenviado no cobre dos
 *    veces. Hoy un pago *completo* repetido se rechaza de rebote —la cuenta ya está
 *    cerrada—, pero **un pago parcial repetido pasa entero y suma**: dos clics dejan 60
 *    cobrados sobre una cuenta de 100. Con una cola de reintentos, sistemático.
 *
 * Las órdenes no necesitan una columna equivalente: su clave primaria pasa a ser el uuid que
 * genera el dispositivo, así que ese id ya identifica la petición.
 */
export class OrderNumberSequenceAndIdempotency1785449564000 implements MigrationInterface {
  name = 'OrderNumberSequenceAndIdempotency1785449564000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "orders_order_number_seq" AS integer`);

    // Arranca donde iba la numeración manual, para no repetir números ya emitidos.
    // `false` en el tercer argumento: el siguiente nextval() devuelve exactamente este
    // valor en lugar de saltárselo.
    await queryRunner.query(
      `SELECT setval('orders_order_number_seq', COALESCE((SELECT MAX(order_number) FROM "orders"), 0) + 1, false)`,
    );

    // A propósito **sin** `ALTER COLUMN SET DEFAULT` y sin `OWNED BY`: la secuencia queda
    // como un objeto suelto que el servicio consulta con nextval(), y TypeORM no la conoce.
    //
    // El primer intento sí ponía el default en la columna, y rompía el arranque en
    // desarrollo: `synchronize` detectaba la diferencia, intentaba aplicarlo por su cuenta y
    // fallaba con «relation "orders_order_number_seq" does not exist», porque dentro de su
    // transacción la secuencia —atada a la columna con OWNED BY— aún no estaba. Dejando la
    // columna limpia no hay diferencia que sincronizar y el problema desaparece; la garantía
    // de no repetir números la sigue dando la secuencia, que es atómica.

    await queryRunner.query(`ALTER TABLE "payments" ADD "client_request_id" character varying(64)`);

    // Único pero admitiendo nulos: los cobros hechos desde el POS conectado no mandan la
    // clave, y en Postgres varios NULL no chocan entre sí en un índice único.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_payments_client_request_id" ON "payments" ("client_request_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_payments_client_request_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "client_request_id"`);
    await queryRunner.query(`DROP SEQUENCE "orders_order_number_seq"`);
  }
}
