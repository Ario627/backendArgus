import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { buildConfiguration } from '../config/configuration.js';
import { runMigrations, type MigrationReport } from './migration-runner.js';
import { createPgClient } from './pg-client.js';

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
);
const USAGE = 'Penggunaan: tsx src/database/migrate.ts <run|status>';

const parseMode = (nilai: string | undefined): 'run' | 'status' | null =>
  nilai === 'run' || nilai === 'status' ? nilai : null;

const buatClient = (): pg.Client => {
  const config = buildConfiguration(process.env);
  return createPgClient(config.database, 'argus-migrate');
};

const cetakLaporan = (
  mode: 'run' | 'status',
  laporan: MigrationReport,
): void => {
  console.log(`migrasi mode=${mode} terdaftar=${laporan.sudahTerdaftar}`);
  for (const nama of laporan.diterapkan) {
    console.log(`diterapkan: ${nama}`);
  }
  if (mode === 'status') {
    for (const nama of laporan.tertunda) {
      console.log(`tertunda: ${nama}`);
    }
    if (laporan.tertunda.length > 0) {
      console.log('skema tertinggal dari disk; jalankan migration:run');
    }
  }
};

const main = async (): Promise<number> => {
  const mode = parseMode(process.argv[2]);
  if (mode === null) {
    console.error(USAGE);
    return 2;
  }

  const client = buatClient();
  await client.connect();
  try {
    const laporan = await runMigrations(client, MIGRATIONS_DIR, mode);
    cetakLaporan(mode, laporan);
    return 0;
  } finally {
    await client.end();
  }
};

main()
  .then((kode) => {
    process.exitCode = kode;
  })
  .catch((galat: unknown) => {
    console.error(galat instanceof Error ? galat.message : String(galat));
    process.exitCode = 1;
  });
