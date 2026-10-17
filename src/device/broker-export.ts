import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { buildConfiguration } from '../config/configuration.js';
import { createPgClient } from '../database/pg-client.js';
import {
  buildBrokerExport,
  type BrokerDeviceRow,
} from './broker-export.util.js';

const DEFAULT_OUTPUT_DIR = 'broker-out';
const PASSWD_FILE = 'passwd';
const ACL_FILE = 'acl';
const PASSWD_MODE = 0o600;
const ACL_MODE = 0o644;

const DEVICE_ROWS_SQL = `
SELECT d.id,
       d.tipe,
       d.fleet_id AS "fleetId",
       d.mqtt_username AS "mqttUsername",
       d.mqtt_password_hash AS "mqttPasswordHash"
  FROM device d
 WHERE d.revoked_at IS NULL
 ORDER BY d.mqtt_username`;

const main = async (): Promise<number> => {
  const config = buildConfiguration(process.env);
  const outputDir = resolve(process.argv[2] ?? DEFAULT_OUTPUT_DIR);
  const client = createPgClient(config.database, 'argus-broker-export');
  await client.connect();
  try {
    const result = await client.query<BrokerDeviceRow>(DEVICE_ROWS_SQL);
    const files = buildBrokerExport(result.rows, config.mqtt.username);
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, PASSWD_FILE), files.passwd, {
      mode: PASSWD_MODE,
    });
    writeFileSync(join(outputDir, ACL_FILE), files.acl, { mode: ACL_MODE });
    console.log(
      `ekspor broker: ${result.rows.length} perangkat aktif -> ${outputDir}`,
    );
    if (files.skippedAcl.length > 0) {
      console.log(
        `tanpa entri acl (cek manual): ${files.skippedAcl.join(', ')}`,
      );
    }
    return 0;
  } finally {
    await client.end();
  }
};

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof pg.DatabaseError ? error.message : error);
    process.exitCode = 1;
  });