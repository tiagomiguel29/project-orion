import 'reflect-metadata';
import { DataSource } from 'typeorm';

/**
 * Standalone DataSource for the TypeORM CLI (migration generate/run) and for
 * the one-shot migration step at deploy time. The globs use __dirname so the
 * same file works under ts-node (src/*.ts) and compiled (dist/*.js).
 *
 * Schema is owned by migrations — the app runs with synchronize disabled so
 * multiple instances never race on DDL.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
