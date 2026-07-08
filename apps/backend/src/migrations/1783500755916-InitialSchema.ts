import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1783500755916 implements MigrationInterface {
    name = 'InitialSchema1783500755916'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "email" text NOT NULL, "passwordHash" text NOT NULL, "role" text NOT NULL DEFAULT 'user', "isActive" boolean NOT NULL DEFAULT true, "totpEnabled" boolean NOT NULL DEFAULT false, "totpSecretEncrypted" text, "totpPendingSecretEncrypted" text, "mfaChallenge" text, "mfaChallengePurpose" text, "mfaChallengeOrigin" text, "mfaChallengeRpId" text, "mfaChallengeExpiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "time" TIMESTAMP WITH TIME ZONE NOT NULL, "deviceId" uuid NOT NULL, "type" text NOT NULL, "message" text, "severity" text NOT NULL DEFAULT 'info', "labels" jsonb NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f5d59a7ad57a4c30d9f4e250e7" ON "events" ("deviceId", "time") `);
        await queryRunner.query(`CREATE TABLE "metrics" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "time" TIMESTAMP WITH TIME ZONE NOT NULL, "deviceId" text NOT NULL, "name" text NOT NULL, "labels" jsonb NOT NULL DEFAULT '{}', "value" double precision NOT NULL, CONSTRAINT "PK_5283cad666a83376e28a715bf0e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_90eb9cf1a981244bb2c4870c9c" ON "metrics" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_2c115ba2e37a750404ac8da168" ON "metrics" ("deviceId", "time") `);
        await queryRunner.query(`CREATE TABLE "devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "externalId" text NOT NULL, "hostname" text, "os" text, "isActive" boolean NOT NULL DEFAULT true, "lastSeenAt" TIMESTAMP WITH TIME ZONE, "status" text NOT NULL DEFAULT 'unknown', "kernel" text, "cpuName" text, "memoryCapacity" double precision, "diskCapacity" double precision, "osName" text, "statusChangedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c374eb51a64cb47de9893d0e140" UNIQUE ("externalId"), CONSTRAINT "PK_b1514758245c12daf43486dd1f0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c374eb51a64cb47de9893d0e14" ON "devices" ("externalId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f898d01eec972a9bc4fbef3e4" ON "devices" ("lastSeenAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_c37da3607f7214c3dda1803d09" ON "devices" ("status") `);
        await queryRunner.query(`CREATE TABLE "user_passkeys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" text NOT NULL, "credentialId" text NOT NULL, "publicKey" text NOT NULL, "counter" integer NOT NULL DEFAULT '0', "transports" text, "deviceType" text, "backedUp" boolean NOT NULL DEFAULT false, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f78c7964dfa3e33810747ce0797" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6629ffb39461ac3fcc05016669" ON "user_passkeys" ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_60e9b91badb1a1cb5927651191" ON "user_passkeys" ("credentialId") `);
        await queryRunner.query(`ALTER TABLE "user_passkeys" ADD CONSTRAINT "FK_6629ffb39461ac3fcc050166695" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_passkeys" DROP CONSTRAINT "FK_6629ffb39461ac3fcc050166695"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_60e9b91badb1a1cb5927651191"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6629ffb39461ac3fcc05016669"`);
        await queryRunner.query(`DROP TABLE "user_passkeys"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c37da3607f7214c3dda1803d09"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f898d01eec972a9bc4fbef3e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c374eb51a64cb47de9893d0e14"`);
        await queryRunner.query(`DROP TABLE "devices"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c115ba2e37a750404ac8da168"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_90eb9cf1a981244bb2c4870c9c"`);
        await queryRunner.query(`DROP TABLE "metrics"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f5d59a7ad57a4c30d9f4e250e7"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
