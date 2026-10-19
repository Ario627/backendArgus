import type {
  GateStatus,
  MoistureProxy,
  WasteFlow,
} from '../common/constant/domain.constant.js';

export const DISPATCH_WEIGHTS = Object.freeze({
  age: 0.34,
  gate: 0.18,
  weight: 0.18,
  reach: 0.3,
});

const GATE_SCORES: Readonly<Record<GateStatus, number>> = Object.freeze({
  LOLOS: 50,
  PERBAIKI: 88,
  ALIHKAN: 70,
  TOLAK: 25,
});

type MoistureKey = 'kering' | 'sedang' | 'basah' | 'nihil';

const SPOILAGE_FACTOR: Readonly<
  Record<WasteFlow, Readonly<Record<MoistureKey, number>>>
> = Object.freeze({
  organik: Object.freeze({ kering: 0.85, sedang: 1, basah: 1.18, nihil: 0.95 }),
  minyak: Object.freeze({
    kering: 0.72,
    sedang: 0.78,
    basah: 0.85,
    nihil: 0.75,
  }),
});

const WEIGHT_FULL_SCORE_KG = 25;

export type DispatchReasonTone = 'daun' | 'kunyit' | 'bata' | 'netral';

export interface DispatchReason {
  readonly code: string;
  readonly label: string;
  readonly tone: DispatchReasonTone;
}

export interface DispatchBatchInput {
  readonly id: string;
  readonly sppgId: string;
  readonly sppgNama: string;
  readonly aliran: WasteFlow;
  readonly weightKg: number;
  readonly createdMs: number;
  readonly gateStatus: GateStatus | null;
  readonly moistureProxy: MoistureProxy | null;
}

export interface DispatchVehicleInput {
  readonly id: string;
  readonly kode: string;
  readonly kapasitasKg: number | null;
  readonly loadKg: number;
  readonly openStops: number;
  readonly lastLat: number | null;
  readonly lastLng: number | null;
  readonly stalenessSeconds: number | null;
  readonly online: boolean;
}

export interface DispatchLegInput {
  readonly vehicleId: string;
  readonly etaSeconds: number;
  readonly distanceMeters: number;
  readonly idealSeconds: number;
}

export interface DispatchEvaluation {
  readonly priority: number;
  readonly eligible: boolean;
  readonly ageHours: number;
  readonly late: boolean;
  readonly components: {
    readonly age: number;
    readonly gate: number;
    readonly weight: number;
    readonly reach: number;
  };
  readonly reasons: readonly DispatchReason[];
  readonly recommendedVehicleId: string | null;
  readonly recommendedEtaSeconds: number | null;
  readonly congestionRatio: number | null;
}

export interface DispatchScoringOptions {
  readonly nowMs: number;
  readonly maxAgeHours: number;
  readonly stalePenaltySeconds: number;
  readonly openStopPenaltySeconds: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const fitScoreOf = (
  vehicle: DispatchVehicleInput,
  weightKg: number,
): number => {
  if (vehicle.kapasitasKg === null || vehicle.kapasitasKg <= 0) return 55;
  const remaining = vehicle.kapasitasKg - vehicle.loadKg;
  if (remaining < weightKg) return 0;
  const utilisation = weightKg / vehicle.kapasitasKg;
  const fill =
    vehicle.kapasitasKg === 0 ? 0 : vehicle.loadKg / vehicle.kapasitasKg;
  const waste = clamp(1 - utilisation, 0, 1);
  return clamp(100 - waste * 45 - fill * 15, 0, 100);
};

export const pickVehicle = (
  vehicles: readonly DispatchVehicleInput[],
  legs: readonly DispatchLegInput[],
  weightKg: number,
  options: DispatchScoringOptions,
): {
  readonly vehicle: DispatchVehicleInput;
  readonly leg: DispatchLegInput;
} | null => {
  let best: {
    vehicle: DispatchVehicleInput;
    leg: DispatchLegInput;
    score: number;
  } | null = null;

  for (const leg of legs) {
    const vehicle = vehicles.find((entry) => entry.id === leg.vehicleId);
    if (vehicle === undefined || !vehicle.online) continue;
    const fit = fitScoreOf(vehicle, weightKg);
    if (fit === 0) continue;

    const stale =
      vehicle.stalenessSeconds === null
        ? options.stalePenaltySeconds
        : vehicle.stalenessSeconds > 300
          ? options.stalePenaltySeconds
          : 0;
    const eta =
      leg.etaSeconds +
      stale +
      vehicle.openStops * options.openStopPenaltySeconds;
    const etaScore = clamp(100 - eta / 60, 5, 100);
    const score =
      0.55 * etaScore +
      0.3 * fit +
      0.15 * clamp(100 - vehicle.openStops * 18, 10, 100);

    if (best === null || score > best.score) best = { vehicle, leg, score };
  }

  return best === null ? null : { vehicle: best.vehicle, leg: best.leg };
};

export const evaluateBatch = (
  batch: DispatchBatchInput,
  vehicles: readonly DispatchVehicleInput[],
  legsByBatch: readonly DispatchLegInput[],
  options: DispatchScoringOptions,
): DispatchEvaluation => {
  const ageHours = Math.max(0, (options.nowMs - batch.createdMs) / 3_600_000);
  const ratio = options.maxAgeHours <= 0 ? 0 : ageHours / options.maxAgeHours;
  const moistureKey = batch.moistureProxy ?? 'nihil';
  const spoilage = SPOILAGE_FACTOR[batch.aliran][moistureKey];
  const late = ageHours > options.maxAgeHours;
  const ageScore = clamp(ratio * 100 * spoilage, 0, 100);

  const gateScore =
    batch.gateStatus === null ? 60 : GATE_SCORES[batch.gateStatus];
  const weightScore = clamp(
    (batch.weightKg / WEIGHT_FULL_SCORE_KG) * 100,
    5,
    100,
  );

  const chosen = pickVehicle(vehicles, legsByBatch, batch.weightKg, options);
  const etaSeconds = chosen?.leg.etaSeconds ?? null;
  const congestionRatio =
    chosen === null || chosen.leg.idealSeconds <= 0
      ? null
      : round1((chosen.leg.etaSeconds / chosen.leg.idealSeconds) * 100) / 100;

  const distanceKm = chosen === null ? null : chosen.leg.distanceMeters / 1000;
  const reachScore =
    chosen === null || distanceKm === null
      ? 20
      : clamp(
          100 -
            distanceKm * 4 -
            Math.max(0, (etaSeconds ?? 0) - chosen.leg.idealSeconds) / 15,
          5,
          100,
        );

  const priority = round1(
    DISPATCH_WEIGHTS.age * ageScore +
      DISPATCH_WEIGHTS.gate * gateScore +
      DISPATCH_WEIGHTS.weight * weightScore +
      DISPATCH_WEIGHTS.reach * reachScore,
  );

  const reasons: DispatchReason[] = [];
  if (late) {
    reasons.push({
      code: 'LEWAT_UMUR',
      label: `Lewat batas umur ${Math.round(ageHours)} jam — risiko susut tinggi`,
      tone: 'bata',
    });
  } else if (ageScore >= 70) {
    reasons.push({
      code: 'MENDESAK_UMUR',
      label: `Sudah ${Math.round(ageHours * 10) / 10} jam menunggu`,
      tone: 'kunyit',
    });
  }

  if (batch.gateStatus === 'PERBAIKI') {
    reasons.push({
      code: 'PERLU_PERBAIKAN',
      label: 'Perlu perbaikan kadar air/minyak sebelum diterima',
      tone: 'kunyit',
    });
  }
  if (batch.gateStatus === 'ALIHKAN') {
    reasons.push({
      code: 'ALIHKAN',
      label: 'Dialihkan ke fasilitas lain',
      tone: 'kunyit',
    });
  }
  if (batch.gateStatus === 'TOLAK') {
    reasons.push({
      code: 'DITOLAK',
      label: 'Ditolak gerbang — jangan diangkut ke fasilitas penerima',
      tone: 'bata',
    });
  }

  if (batch.weightKg >= WEIGHT_FULL_SCORE_KG) {
    reasons.push({
      code: 'MUATAN_BESAR',
      label: `${Math.round(batch.weightKg * 10) / 10} kg — efisien untuk satu perjalanan`,
      tone: 'netral',
    });
  }

  if (congestionRatio !== null && congestionRatio >= 1.35) {
    reasons.push({
      code: 'JALAN_PADAT',
      label: 'Perjalanan lebih lambat dari normal — perhitungkan macet',
      tone: 'kunyit',
    });
  }

  if (chosen === null) {
    reasons.push({
      code: 'TANPA_ARMADA',
      label: 'Tidak ada armada aktif dengan kapasitas cukup',
      tone: 'bata',
    });
  } else {
    reasons.push({
      code: 'ARMADA',
      label: `Disarankan ${chosen.vehicle.kode}`,
      tone: 'daun',
    });
  }

  return Object.freeze({
    priority,
    eligible: batch.gateStatus !== 'TOLAK',
    ageHours: round1(ageHours),
    late,
    components: Object.freeze({
      age: round1(ageScore),
      gate: round1(gateScore),
      weight: round1(weightScore),
      reach: round1(reachScore),
    }),
    reasons: Object.freeze(reasons),
    recommendedVehicleId: chosen?.vehicle.id ?? null,
    recommendedEtaSeconds: etaSeconds === null ? null : Math.round(etaSeconds),
    congestionRatio,
  });
};
