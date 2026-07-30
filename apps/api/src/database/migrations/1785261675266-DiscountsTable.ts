import { MigrationInterface, QueryRunner } from "typeorm";

export class DiscountsTable1785261675266 implements MigrationInterface {
    name = 'DiscountsTable1785261675266'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "discounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "type" character varying(20) NOT NULL, "value" numeric(10,2) NOT NULL, "amount" numeric(10,2) NOT NULL, "percentage" numeric(5,2) NOT NULL, "reason" character varying(255) NOT NULL, "requested_by" uuid NOT NULL, "requested_by_name" character varying, "approved_by" uuid, "approved_by_name" character varying, "status" character varying(20) NOT NULL DEFAULT 'pending', "resolved_at" TIMESTAMP WITH TIME ZONE, "rejection_reason" character varying(255), "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_66c522004212dc814d6e2f14ecc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_discounts_status" ON "discounts"  ("status") `);
        await queryRunner.query(`CREATE INDEX "idx_discounts_order_id" ON "discounts"  ("order_id") `);
        await queryRunner.query(`ALTER TABLE "discounts" ADD CONSTRAINT "FK_9c044157b1cfdf762c46a12cfbc" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "discounts" DROP CONSTRAINT "FK_9c044157b1cfdf762c46a12cfbc"`);
        await queryRunner.query(`DROP INDEX "public"."idx_discounts_order_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_discounts_status"`);
        await queryRunner.query(`DROP TABLE "discounts"`);
    }

}
