import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * La hora a la que las cosas pasaron en el salón, separada de aquella en que el servidor se
 * enteró.
 *
 * Sin estas dos columnas, una comanda tomada a las 21:40 y sincronizada a las 22:05 —cuando
 * vuelve el WiFi— queda fechada a las 22:05. `order_status_history` y el reporte de tiempos
 * de preparación medirían **cuándo volvió la red**, no cuánto tardó la cocina, y un corte de
 * veinte minutos inflaría en veinte minutos el tiempo de todas las órdenes del corte.
 *
 * Son columnas **nuevas**, no un reemplazo de `created_at`/`changed_at`:
 * - un `@CreateDateColumn` peleando con un valor asignado a mano es comportamiento
 *   indocumentado de TypeORM, y aquí el valor lo pone el cliente;
 * - un rastro debe conservar los dos hechos. Cuándo pasó y cuándo nos enteramos es justo la
 *   diferencia que se quiere mirar al investigar un corte.
 *
 * Nullable y sin default a propósito: `null` significa «no lo reportó nadie, usa la del
 * servidor». Todo lo escrito en línea —la inmensa mayoría— la deja en null, y quien la lea
 * debe hacerlo como `occurred_at ?? created_at`. Eso también hace que la migración sea
 * compatible hacia atrás: una API anterior a este despliegue sigue funcionando contra el
 * esquema nuevo, que es lo que permite migrar antes de desplegar.
 */
export class OccurredAt1786500000000 implements MigrationInterface {
  name = 'OccurredAt1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "occurred_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `ALTER TABLE "order_status_history" ADD "occurred_at" TIMESTAMP WITH TIME ZONE`,
    );

    // El estado de una mesa es el único dato encolable que dos dispositivos pueden pisarse,
    // así que hace falta saber **cuándo cambió el estado** para poder descartar una operación
    // que ya nació obsoleta.
    //
    // Columna propia y no `updated_at`, por dos motivos independientes:
    //
    // 1. `updated_at` es `TIMESTAMP` **sin** zona horaria, como todo el esquema inicial. El
    //    driver la devuelve interpretándola en la zona del proceso, y el arnés fuerza
    //    `TZ=America/Mexico_City`, así que se lee seis horas en el futuro y **cualquier**
    //    comparación contra un instante real sale al revés. Es la misma trampa que ya obligó
    //    a fijar `TZ` en los tests. `TIMESTAMPTZ` viaja como instante y se compara sin trucos.
    // 2. `updated_at` cambia por cualquier columna. Arrastrar una mesa en el plano lo bumpea,
    //    y eso rechazaría un cambio de estado encolado que era perfectamente válido.
    await queryRunner.query(
      `ALTER TABLE "tables" ADD "status_changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tables" DROP COLUMN "status_changed_at"`);
    await queryRunner.query(`ALTER TABLE "order_status_history" DROP COLUMN "occurred_at"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "occurred_at"`);
  }
}
