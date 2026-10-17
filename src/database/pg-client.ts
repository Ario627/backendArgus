import pg from 'pg';
import type { DatabaseConfig } from '../config/configuration.js';
import { registerPgTypeParsers } from './pg-type-parsers.js';

registerPgTypeParsers();

export const createPgClient = (
  database: DatabaseConfig,
  applicationName: string,
): pg.Client =>
  new pg.Client({
    host: database.host,
    port: database.port,
    database: database.name,
    user: database.user,
    password: database.password,
    ssl: database.ssl ? { rejectUnauthorized: true } : undefined,
    application_name: applicationName,
    connectionTimeoutMillis: 10000,
  });
