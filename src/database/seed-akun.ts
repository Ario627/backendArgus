import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { generateId } from '../common/utils/id.util.js';
import { buildConfiguration } from '../config/configuration.js';
import {
  describeViolation,
  parseAkunFile,
  type AkunSeedRow,
} from './akun-seed.util.js';
import { createPgClient } from './pg-client.js';

const USAGE =
  'Penggunaan: tsx src/database/seed-akun.ts <berkas.json> [--dry-run]';

const generatePassword = (): string => randomBytes(12).toString('base64url');

interface ResolvedBinding {
  readonly sppgId: string | null;
  readonly fasilitasId: string | null;
  readonly fleetId: string | null;
}

type RowOutcome = 'dibuat' | 'sudah-ada' | 'dilewati' | 'gagal';

interface RowReport {
  readonly baris: number;
  readonly username: string;
  readonly role: string;
  readonly outcome: RowOutcome;
  readonly password: string | null;
  readonly alasan: string | null;
}

interface BindingContext {
  readonly sppgBySlug: ReadonlyMap<string, string>;
  readonly fasilitasByNama: ReadonlyMap<string, string>;
  readonly fleetByKode: ReadonlyMap<string, string>;
}

const readArgFile = (argv: readonly string[]): string | null => {
  const positional = argv.find((arg) => !arg.startsWith('--'));
  return positional ?? null;
};

const resolveBinding = (
  row: AkunSeedRow,
  context: BindingContext,
): {
  readonly binding: ResolvedBinding | null;
  readonly alasan: string | null;
} => {
  if (row.sppgId !== null || row.sppgSlug !== null) {
    if (row.sppgId !== null) {
      return {
        binding: { sppgId: row.sppgId, fasilitasId: null, fleetId: null },
        alasan: null,
      };
    }
    const found = context.sppgBySlug.get(row.sppgSlug ?? '');
    return found === undefined
      ? { binding: null, alasan: `slug dapur tidak ditemukan: ${row.sppgSlug}` }
      : {
          binding: { sppgId: found, fasilitasId: null, fleetId: null },
          alasan: null,
        };
  }
  if (row.fasilitasId !== null || row.fasilitasNama !== null) {
    if (row.fasilitasId !== null) {
      return {
        binding: { sppgId: null, fasilitasId: row.fasilitasId, fleetId: null },
        alasan: null,
      };
    }
    const found = context.fasilitasByNama.get(row.fasilitasNama ?? '');
    return found === undefined
      ? {
          binding: null,
          alasan: `fasilitas tidak ditemukan: ${row.fasilitasNama}`,
        }
      : {
          binding: { sppgId: null, fasilitasId: found, fleetId: null },
          alasan: null,
        };
  }
  if (row.fleetId !== null || row.fleetKode !== null) {
    if (row.fleetId !== null) {
      return {
        binding: { sppgId: null, fasilitasId: null, fleetId: row.fleetId },
        alasan: null,
      };
    }
    const found = context.fleetByKode.get(row.fleetKode ?? '');
    return found === undefined
      ? { binding: null, alasan: `armada tidak ditemukan: ${row.fleetKode}` }
      : {
          binding: { sppgId: null, fasilitasId: null, fleetId: found },
          alasan: null,
        };
  }
  return {
    binding: { sppgId: null, fasilitasId: null, fleetId: null },
    alasan: null,
  };
};

const loadBindings = async (client: pg.Client): Promise<BindingContext> => {
  const sppg = await client.query<{ id: string; public_slug: string }>(
    'SELECT id, public_slug FROM sppg',
  );
  const fasilitas = await client.query<{ id: string; nama: string }>(
    'SELECT id, nama FROM fasilitas',
  );
  const fleet = await client.query<{ id: string; kode: string }>(
    'SELECT id, kode FROM fleet',
  );
  return {
    sppgBySlug: new Map(sppg.rows.map((row) => [row.public_slug, row.id])),
    fasilitasByNama: new Map(fasilitas.rows.map((row) => [row.nama, row.id])),
    fleetByKode: new Map(fleet.rows.map((row) => [row.kode, row.id])),
  };
};

const findExisting = async (
  client: pg.Client,
  username: string,
): Promise<boolean> => {
  const result = await client.query(
    'SELECT 1 FROM "user" WHERE username = $1',
    [username],
  );
  return (result.rowCount ?? 0) > 0;
};

const insertAkun = async (
  client: pg.Client,
  row: AkunSeedRow,
  binding: ResolvedBinding,
  password: string,
  bcryptRounds: number,
): Promise<void> => {
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  await client.query(
    `INSERT INTO "user" (id, username, password_hash, nama, role, sppg_id, fasilitas_id, fleet_id, aktif)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      generateId(),
      row.username,
      passwordHash,
      row.nama,
      row.role,
      binding.sppgId,
      binding.fasilitasId,
      binding.fleetId,
      row.aktif,
    ],
  );
};

const processRow = async (
  client: pg.Client,
  row: AkunSeedRow,
  context: BindingContext,
  bcryptRounds: number,
  dryRun: boolean,
): Promise<RowReport> => {
  const base = { baris: row.baris, username: row.username, role: row.role };
  if (await findExisting(client, row.username)) {
    return { ...base, outcome: 'sudah-ada', password: null, alasan: null };
  }
  const { binding, alasan } = resolveBinding(row, context);
  if (binding === null) {
    return { ...base, outcome: 'gagal', password: null, alasan };
  }
  const generated = row.password === null;
  const password = row.password ?? generatePassword();
  if (dryRun) {
    return {
      ...base,
      outcome: 'dilewati',
      password: null,
      alasan: 'dry-run',
    };
  }
  await insertAkun(client, row, binding, password, bcryptRounds);
  return {
    ...base,
    outcome: 'dibuat',
    password: generated ? password : null,
    alasan: null,
  };
};

const printReport = (reports: readonly RowReport[], dryRun: boolean): void => {
  const dibuat = reports.filter((row) => row.outcome === 'dibuat');
  const sudahAda = reports.filter((row) => row.outcome === 'sudah-ada');
  const gagal = reports.filter((row) => row.outcome === 'gagal');
  for (const row of reports) {
    const suffix = row.alasan === null ? '' : ` (${row.alasan})`;
    console.log(
      `baris ${row.baris} ${row.username} [${row.role}] -> ${row.outcome}${suffix}`,
    );
  }
  const generatedRows = dibuat.filter((row) => row.password !== null);
  if (generatedRows.length > 0) {
    console.log('');
    console.log(
      'kata sandi dibuat otomatis (ditampilkan sekali, simpan sekarang):',
    );
    for (const row of generatedRows) {
      console.log(`  ${row.username}: ${row.password}`);
    }
  }
  console.log('');
  console.log(
    `ringkasan${dryRun ? ' (dry-run, tidak ada yang ditulis)' : ''}: dibuat=${dibuat.length} sudah-ada=${sudahAda.length} gagal=${gagal.length}`,
  );
};

const main = async (): Promise<number> => {
  const berkas = readArgFile(process.argv.slice(2));
  const dryRun = process.argv.includes('--dry-run');
  if (berkas === null) {
    console.error(USAGE);
    return 2;
  }
  const config = buildConfiguration(process.env);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(berkas, 'utf8')) as unknown;
  } catch (error) {
    console.error(
      `berkas tidak bisa dibaca: ${error instanceof Error ? error.message : 'non-error'}`,
    );
    return 2;
  }
  const parsed = parseAkunFile(raw, config.isProduction);
  if (!parsed.ok) {
    console.error('berkas akun tidak sah:');
    for (const violation of parsed.violations) {
      console.error(`  ${describeViolation(violation)}`);
    }
    return 2;
  }

  const client = createPgClient(config.database, 'argus-seed-akun');
  await client.connect();
  try {
    const context = await loadBindings(client);
    const reports: RowReport[] = [];
    for (const row of parsed.rows) {
      try {
        reports.push(
          await processRow(
            client,
            row,
            context,
            config.auth.bcryptRounds,
            dryRun,
          ),
        );
      } catch (error) {
        reports.push({
          baris: row.baris,
          username: row.username,
          role: row.role,
          outcome: 'gagal',
          password: null,
          alasan: error instanceof Error ? error.message : 'non-error',
        });
      }
    }
    printReport(reports, dryRun);
    return reports.some((row) => row.outcome === 'gagal') ? 1 : 0;
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