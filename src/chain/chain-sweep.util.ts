export const SWEEP_IDS_SQL = `
WITH eligible AS (
  SELECT b.id,
         row_number() OVER (ORDER BY b.dikeluarkan_at DESC, b.id DESC) AS rn
    FROM batch b
   WHERE EXISTS (SELECT 1 FROM ledger_event le WHERE le.batch_id = b.id)
), terbaru AS (
  SELECT id FROM eligible WHERE rn <= $1
), lama AS (
  SELECT id FROM eligible WHERE rn > $1
), sampel AS (
  SELECT id
    FROM lama
   ORDER BY hashtext(id::text || $3)
   LIMIT LEAST(
     GREATEST(1, CEIL(($2::numeric / 100) * (SELECT count(*) FROM lama))::int),
     $4
   )
)
SELECT id FROM terbaru
UNION
SELECT id FROM sampel`;

export const CHAIN_EVENTS_SQL = `
SELECT id, prev_hash, hash, payload
  FROM ledger_event
 WHERE batch_id = $1
 ORDER BY id ASC`;

export const SWEEP_MAX_BATCHES = 500;

export interface SweepPlan {
  readonly newest: number;
  readonly sampleCapacity: number;
}

export interface SweepPlanInput {
  readonly dailyBatches: number;
  readonly maxBatches?: number;
}

export const resolveSweepPlan = (input: SweepPlanInput): SweepPlan => {
  const maxBatches = input.maxBatches ?? SWEEP_MAX_BATCHES;
  const newest = Math.max(1, Math.min(input.dailyBatches, maxBatches));
  return Object.freeze({
    newest,
    sampleCapacity: Math.max(0, maxBatches - newest),
  });
};