import { evaluateGate, type GateProfile } from '../batch/gate.service.js';
import {
  GATE_REJECT_PROBABILITY,
  type DispositionTier,
  type FractionCode,
  type GateStatus,
  type MoistureProxy,
  type WasteFlow,
} from '../common/constant/domain.constant.js';
import { fromHundredths, toHundredths } from '../common/utils/decimal.util.js';

export const DEFAULT_CITY_SPEED_KMH = 20;

export type CandidateTier = Exclude<DispositionTier, 'T0'>;

export type DispositionReason = 'SKOR_TERENDAH' | 'NO_ELIGIBLE_CANDIDATE' | 'PARAMETER_BELUM_TERKALIBRASI';

export type CandidateIneligibility =
  | 'GATE_TOLAK'
  | 'MELEWATI_BATAS_UMUR'
  | 'KAPASITAS_PENUH';

export interface ScoreParameters {
  readonly biayaPerKm: number;
  readonly faktorMuat: number;
  readonly biayaTolak: number;
  readonly penaltiUmurPerJam: number;
  readonly kecepatanKotaKmJam: number;
  readonly assumedSpeed: boolean;
}

export interface ScoreBatch {
  readonly aliran: WasteFlow;
  readonly weightKg: number;
  readonly ageHours: number;
  readonly fractions: Readonly<Partial<Record<FractionCode, number>>>;
  readonly moistureProxy: MoistureProxy | null;
  readonly visibleOil: boolean;
}

export interface ScoreCandidate {
  readonly facilityId: string;
  readonly nama: string;
  readonly tier: CandidateTier;
  readonly distanceKm: number;
  readonly profile: GateProfile;
  readonly acceptsMinyak: boolean;
  readonly queueKgToday: number;
}

export interface CandidateBreakdown {
  readonly cost: number;
  readonly value: number;
  readonly risk: number;
}

export interface CandidateScore {
  readonly facilityId: string;
  readonly nama: string;
  readonly tier: CandidateTier;
  readonly eligible: boolean;
  readonly reason?: CandidateIneligibility;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly score?: number;
  readonly breakdown?: CandidateBreakdown;
  readonly notes?: readonly string[];
}

export interface DispositionDecision {
  readonly chosenTier: DispositionTier;
  readonly chosenFacilityId: string | null;
  readonly chosenFacilityNama: string | null;
  readonly reason: DispositionReason;
  readonly assumedSpeed: boolean;
  readonly candidates: readonly CandidateScore[];
}

interface Eligibility {
  readonly eligible: boolean;
  readonly reason?: CandidateIneligibility;
  readonly detail?: Record<string, unknown>;
  readonly gate: GateStatus;
  readonly arrivalAgeHours: number;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

const tierRank = (tier: CandidateTier): number => Number.parseInt(tier.slice(1), 10);

const computeEligibility = (
  batch: ScoreBatch,
  candidate: ScoreCandidate,
  speedKmh: number,
): Eligibility => {
  const gate = evaluateGate({
    aliran: batch.aliran,
    weightKg: batch.weightKg,
    fractions: batch.fractions,
    moistureProxy: batch.moistureProxy,
    visibleOil: batch.visibleOil,
    ageHours: batch.ageHours,
    queueKgToday: candidate.queueKgToday,
    profile: candidate.profile,
    target: { facilityId: candidate.facilityId, acceptsMinyak: candidate.acceptsMinyak },
  });
  const arrivalAgeHours = batch.ageHours + candidate.distanceKm / speedKmh;

  if (gate.status === 'TOLAK') {
    return {
      eligible: false,
      reason: 'GATE_TOLAK',
      detail: {
        violations: gate.violations.map((violation) => violation.rule),
        arrivalAgeHours: round1(arrivalAgeHours),
      },
      gate: gate.status,
      arrivalAgeHours,
    };
  }

  const maxAgeHours = candidate.profile.maxAgeHours;
  if (maxAgeHours !== null && arrivalAgeHours > maxAgeHours) {
    return {
      eligible: false,
      reason: 'MELEWATI_BATAS_UMUR',
      detail: { arrivalAgeHours: round1(arrivalAgeHours), maxAgeHours },
      gate: gate.status,
      arrivalAgeHours,
    };
  }

  const capacityKgPerDay = candidate.profile.capacityKgPerDay;
  if (
    capacityKgPerDay !== null &&
    fromHundredths(toHundredths(candidate.queueKgToday) + toHundredths(batch.weightKg)) > capacityKgPerDay
  ) {
    return {
      eligible: false,
      reason: 'KAPASITAS_PENUH',
      detail: {
        queueKgToday: candidate.queueKgToday,
        weightKg: batch.weightKg,
        capacityKgPerDay,
      },
      gate: gate.status,
      arrivalAgeHours,
    };
  }

  return { eligible: true, gate: gate.status, arrivalAgeHours };
};

const computeBreakdown = (
  batch: ScoreBatch,
  candidate: ScoreCandidate,
  gate: GateStatus,
  arrivalAgeHours: number,
  params: ScoreParameters,
): CandidateBreakdown => {
  const cost = fromHundredths(
    toHundredths((candidate.distanceKm * params.biayaPerKm) / params.faktorMuat),
  );
  const value = fromHundredths(toHundredths((candidate.profile.pricePerKg ?? 0) * batch.weightKg));
  const risk = fromHundredths(
    toHundredths(
      GATE_REJECT_PROBABILITY[gate] * params.biayaTolak + params.penaltiUmurPerJam * arrivalAgeHours,
    ),
  );
  return Object.freeze({ cost, value, risk });
};

const scoreOf = (breakdown: CandidateBreakdown): number =>
  fromHundredths(toHundredths(breakdown.cost) - toHundredths(breakdown.value) + toHundredths(breakdown.risk));

const buildCandidateScore = (
  batch: ScoreBatch,
  candidate: ScoreCandidate,
  params: ScoreParameters | null,
  speedKmh: number,
): CandidateScore => {
  const eligibility = computeEligibility(batch, candidate, speedKmh);
  if (!eligibility.eligible) {
    return Object.freeze({
      facilityId: candidate.facilityId,
      nama: candidate.nama,
      tier: candidate.tier,
      eligible: false,
      reason: eligibility.reason,
      detail: Object.freeze(eligibility.detail ?? {}),
    });
  }

  const notes: string[] = [];
  if (eligibility.gate === 'PERBAIKI' || eligibility.gate === 'ALIHKAN') {
    notes.push('P_TOLAK_ASUMSI');
  }
  if (params === null) {
    notes.push('PARAMETER_BELUM_TERKALIBRASI');
    return Object.freeze({
      facilityId: candidate.facilityId,
      nama: candidate.nama,
      tier: candidate.tier,
      eligible: true,
      notes: Object.freeze(notes),
    });
  }

  const breakdown = computeBreakdown(batch, candidate, eligibility.gate, eligibility.arrivalAgeHours, params);
  return Object.freeze({
    facilityId: candidate.facilityId,
    nama: candidate.nama,
    tier: candidate.tier,
    eligible: true,
    score: scoreOf(breakdown),
    breakdown,
    notes: Object.freeze(notes),
  });
};

const compareCandidates = (left: CandidateScore, right: CandidateScore): number => {
  if (left.score !== right.score) return (left.score ?? 0) - (right.score ?? 0);
  if (left.tier !== right.tier) return tierRank(left.tier) - tierRank(right.tier);
  return left.facilityId < right.facilityId ? -1 : 1;
};

export const hitungSkorDisposisi = (
  batch: ScoreBatch,
  candidates: readonly ScoreCandidate[],
  params: ScoreParameters | null,
): DispositionDecision => {
  if (params !== null && params.faktorMuat <= 0) {
    throw new RangeError('FAKTOR_MUAT_INVALID');
  }

  const speedKmh = params?.kecepatanKotaKmJam ?? DEFAULT_CITY_SPEED_KMH;
  const assumedSpeed = params === null ? true : params.assumedSpeed;
  const scored = candidates.map((candidate) => buildCandidateScore(batch, candidate, params, speedKmh));

  if (params === null) {
    return Object.freeze({
      chosenTier: 'T4',
      chosenFacilityId: null,
      chosenFacilityNama: null,
      reason: 'PARAMETER_BELUM_TERKALIBRASI',
      assumedSpeed,
      candidates: Object.freeze(scored),
    });
  }

  const eligible = scored.filter((candidate) => candidate.eligible && candidate.score !== undefined);
  if (eligible.length === 0) {
    return Object.freeze({
      chosenTier: 'T4',
      chosenFacilityId: null,
      chosenFacilityNama: null,
      reason: 'NO_ELIGIBLE_CANDIDATE',
      assumedSpeed,
      candidates: Object.freeze(scored),
    });
  }

  const best = [...eligible].sort(compareCandidates)[0];
  return Object.freeze({
    chosenTier: best.tier,
    chosenFacilityId: best.facilityId,
    chosenFacilityNama: best.nama,
    reason: 'SKOR_TERENDAH',
    assumedSpeed,
    candidates: Object.freeze(scored),
  });
};