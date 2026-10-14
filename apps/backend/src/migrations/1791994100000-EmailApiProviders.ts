import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailApiProviders1791994100000 implements MigrationInterface {
  name = 'EmailApiProviders1791994100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_settings" ADD "resendApiKeyEncrypted" text`);
    await queryRunner.query(`ALTER TABLE "notification_settings" ADD "sesAccessKeyIdEncrypted" text`);
    await queryRunner.query(`ALTER TABLE "notification_settings" ADD "sesSecretAccessKeyEncrypted" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "notification_settings" DROP COLUMN "sesSecretAccessKeyEncrypted"`);
    await queryRunner.query(`ALTER TABLE "notification_settings" DROP COLUMN "sesAccessKeyIdEncrypted"`);
    await queryRunner.query(`ALTER TABLE "notification_settings" DROP COLUMN "resendApiKeyEncrypted"`);
  }
}
