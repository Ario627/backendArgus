import { isUuid } from '../audit/audit-target.util.js';
import {
  CHAIN_EVENTS_SQL,
  resolveSweepPlan,
  SWEEP_IDS_SQL,
} from '../chain/chain-sweep.util.js';
import { verifyChain } from '../common/utils/hash.util.js';
import { jakartaDateOf } from '../common/utils/daily-range.util.js';
import { buildConfiguration } from '../config/configuration.js';
import { createPgClient } from './pg-client.js';
import type { Client } from 'pg';

const USAGE =
  'Penggunaan: tsx src/database/verify-chains.ts [--batch <uuid>] [--limit <n>] [--sample <n>]';

interface ChainEventRow {
  readonly id: string | number;
  readonly prev_hash: string | null;
  readonly hash: string;
  readonly payload: unknown;
}

interface IdRow {
  readonly id: string;
}

interface CliOptions {
  readonly batchId: string | null;
  readonly limit: number;
  readonly samplePercent: number;
}

const readArg = (argv: readonly string[], name: string): string | null => {
  const withEquals = argv.find((arg) => arg.startsWith(`--${name}=`));
  if (withEquals !== undefined) {
    return withEquals.slice(name.length + 3);
  }
  const index = argv.indexOf(`--${name}`);
  if (index >= 0) {
    return argv[index + 1] ?? null;
  }
  return null;
};

const readPositiveInt = (
  argv: readonly string[],
  name: string,
  fallback: number,
): number | null => {
  const raw = readArg(argv, name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  return value > 0 ? value : null;
};

const parseOptions = (
  argv: readonly string[],
  limit: number,
  samplePercent: number,
): CliOptions | null => {
  const batchId = readArg(argv, 'batch');
  if (batchId !== null && !isUuid(batchId)) return null;
  const limitValue = readPositiveInt(argv, 'limit', limit);
  const sampleValue = readPositiveInt(argv, 'sample', samplePercent);
  if (limitValue === null || sampleValue === null || sampleValue > 100) {
    return null;
  }
  return { batchId, limit: limitValue, samplePercent: sampleValue };
};

const collectBatchIds = async (
  client: Client,
  options: CliOptions,
): Promise<readonly string[]> => {
  if (options.batchId !== null) {
    return [options.batchId];
  }
  const plan = resolveSweepPlan({ dailyBatches: options.limit });
  const result = await client.query<IdRow>(SWEEP_IDS_SQL, [
    plan.newest,
    options.samplePercent,
    jakartaDateOf(new Date()),
    plan.sampleCapacity,
  ]);
  return result.rows.map((row) => row.id);
};

const verifyBatch = async (
  client: Client,
  batchId: string,
): Promise<boolean> => {
  const result = await client.query<ChainEventRow>(CHAIN_EVENTS_SQL, [batchId]);
  const verification = verifyChain(
    result.rows.map((row) => ({
      id: row.id,
      prevHash: row.prev_hash,
      hash: row.hash,
      payload: row.payload,
    })),
  );
  if (verification.ok) {
    console.log(`OK    batch=${batchId} event=${verification.checked}`);
    return true;
  }
  console.log(
    `TIMPA batch=${batchId} index=${verification.breach?.index ?? -1} alasan=${verification.breach?.reason ?? 'UNKNOWN'}`,
  );
  return false;
};

const main = async (): Promise<number> => {
  const config = buildConfiguration(process.env);
  const options = parseOptions(
    process.argv.slice(2),
    config.chain.verifyDailyBatches,
    config.chain.verifySamplePercent,
  );
  if (options === null) {
    console.error(USAGE);
    return 2;
  }

  const client = createPgClient(config.database, 'argus-verify-chains');
  await client.connect();
  try {
    const ids = await collectBatchIds(client, options);
    let ok = 0;
    let breach = 0;
    for (const batchId of ids) {
      if (await verifyBatch(client, batchId)) {
        ok += 1;
      } else {
        breach += 1;
      }
    }
    console.log(
      `ringkasan: diperiksa=${ids.length} utuh=${ok} timpa=${breach}`,
    );
    return breach === 0 ? 0 : 1;
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