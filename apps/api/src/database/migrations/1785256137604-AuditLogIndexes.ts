import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLogIndexes1785256137604 implements MigrationInterface {
    name = 'AuditLogIndexes1785256137604'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"  ("entity_type", "entity_id") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_logs_action" ON "audit_logs"  ("action") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"  ("created_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_action"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_entity"`);
    }

}
