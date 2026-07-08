import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMetricsCompositeIndex1783500995930 implements MigrationInterface {
    name = 'AddMetricsCompositeIndex1783500995930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_a96c2d986b1e4fd83a7d5da85e" ON "metrics" ("deviceId", "name", "time") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a96c2d986b1e4fd83a7d5da85e"`);
    }

}
