import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1791994000000 implements MigrationInterface {
  name = 'Notifications1791994000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "notification_settings" ("id" integer NOT NULL, "config" jsonb NOT NULL, "webhookUrlEncrypted" text, "discordUrlEncrypted" text, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"))`);
    await queryRunner.query(`CREATE TABLE "device_notification_settings" ("deviceId" uuid NOT NULL, "config" jsonb NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_device_notification_settings" PRIMARY KEY ("deviceId"))`);
    await queryRunner.query(`ALTER TABLE "device_notification_settings" ADD CONSTRAINT "FK_device_notification_settings_device" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE TABLE "notification_rule_states" ("deviceId" uuid NOT NULL, "rule" text NOT NULL, "active" boolean NOT NULL DEFAULT false, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notification_rule_states" PRIMARY KEY ("deviceId", "rule"))`);
    await queryRunner.query(`ALTER TABLE "notification_rule_states" ADD CONSTRAINT "FK_notification_rule_states_device" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE TABLE "notification_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "provider" text NOT NULL, "status" text NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lockedUntil" TIMESTAMP WITH TIME ZONE, "lastError" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_notification_deliveries" PRIMARY KEY ("id"))`);
    await queryRunner.query(`ALTER TABLE "notification_deliveries" ADD CONSTRAINT "FK_notification_deliveries_event" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_notification_deliveries_event_provider" ON "notification_deliveries" ("eventId", "provider")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_deliveries_due" ON "notification_deliveries" ("status", "nextAttemptAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notification_deliveries"`);
    await queryRunner.query(`DROP TABLE "notification_rule_states"`);
    await queryRunner.query(`DROP TABLE "device_notification_settings"`);
    await queryRunner.query(`DROP TABLE "notification_settings"`);
  }
}
