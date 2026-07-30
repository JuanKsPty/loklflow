import { MigrationInterface, QueryRunner } from "typeorm";

export class ReceiptConfigAndReportIndexes1785286912232 implements MigrationInterface {
    name = 'ReceiptConfigAndReportIndexes1785286912232'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_config" ADD "email" character varying`);
        await queryRunner.query(`ALTER TABLE "business_config" ADD "tax_id" character varying`);
        await queryRunner.query(`ALTER TABLE "business_config" ADD "tax_rate" numeric(5,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "business_config" ADD "receipt_footer" character varying(255)`);
        await queryRunner.query(`CREATE INDEX "idx_osh_to_status" ON "order_status_history"  ("to_status") `);
        await queryRunner.query(`CREATE INDEX "idx_osh_changed_at" ON "order_status_history"  ("changed_at") `);
        await queryRunner.query(`CREATE INDEX "idx_osh_order_id" ON "order_status_history"  ("order_id") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_status" ON "orders"  ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_waiter_id" ON "orders"  ("waiter_id") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_shift_id" ON "orders"  ("shift_id") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_created_at" ON "orders"  ("created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_orders_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_shift_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_waiter_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_osh_order_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_osh_changed_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_osh_to_status"`);
        await queryRunner.query(`ALTER TABLE "business_config" DROP COLUMN "receipt_footer"`);
        await queryRunner.query(`ALTER TABLE "business_config" DROP COLUMN "tax_rate"`);
        await queryRunner.query(`ALTER TABLE "business_config" DROP COLUMN "tax_id"`);
        await queryRunner.query(`ALTER TABLE "business_config" DROP COLUMN "email"`);
    }

}
