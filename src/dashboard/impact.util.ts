import { haversineKm } from '../common/utils/geo.util.js';

export interface ImpactBatchRow {
  readonly id: string;
  readonly sppgId: string;
  readonly sppgLat: number;
  readonly sppgLng: number;
  readonly status: string;
  readonly tier: string | null;
  readonly chosenFacilityId: string | null;
  readonly candidates: readonly ImpactCandidateRow[];
}

export interface ImpactCandidateRow {
  readonly facilityId: string;
  readonly eligible: boolean;
}

export interface ImpactFacility {
  readonly id: string;
  readonly nama: string;
  readonly lat: number;
  readonly lng: number;
}

export interface ImpactTotals {
  readonly totalKm: number;
  readonly estimasiBiayaRp: number | null;
}

export interface ImpactComparison {
  readonly batch: {
    readonly total: number;
    readonly diterima: number;
    readonly butuhTindakLanjut: number;
    readonly ditanganiDiSumber: number;
    readonly dialihkan: number;
    readonly menungguPutusan: number;
  };
  readonly nearest: ImpactTotals & { readonly tidakSesuaiProfil: number };
  readonly argus: ImpactTotals;
  readonly dibandingkan: number;
}

const SOURCE_TIERS: ReadonlySet<string> = new Set(['T0', 'T1']);
const ACCEPTED_STATUSES: ReadonlySet<string> = new Set([
  'DITERIMA',
  'DIOLAH',
  'SELESAI',
]);
const FOLLOW_UP_STATUSES: ReadonlySet<string> = new Set([
  'GAGAL_GATE',
  'TERSANGKUT',
]);

const round1 = (value: number): number => Math.round(value * 10) / 10;

const costOf = (km: number, biayaPerKm: number | null): number | null =>
  biayaPerKm === null ? null : Math.round(km * biayaPerKm);

const nearestFacilityTo = (
  origin: { readonly lat: number; readonly lng: number },
  facilities: readonly ImpactFacility[],
): ImpactFacility | null => {
  let best: ImpactFacility | null = null;
  let bestKm = Number.POSITIVE_INFINITY;
  for (const facility of facilities) {
    const km = haversineKm(origin, facility);
    if (km < bestKm) {
      best = facility;
      bestKm = km;
    }
  }
  return best;
};

export const compareImpact = (
  batches: readonly ImpactBatchRow[],
  facilities: readonly ImpactFacility[],
  biayaPerKm: number | null,
): ImpactComparison => {
  let nearestKm = 0;
  let argusKm = 0;
  let tidakSesuaiProfil = 0;
  let dibandingkan = 0;
  let diterima = 0;
  let butuhTindakLanjut = 0;
  let ditanganiDiSumber = 0;
  let dialihkan = 0;
  let menungguPutusan = 0;

  const facilityById = new Map(
    facilities.map((facility) => [facility.id, facility]),
  );

  for (const batch of batches) {
    if (ACCEPTED_STATUSES.has(batch.status)) diterima += 1;
    if (FOLLOW_UP_STATUSES.has(batch.status)) butuhTindakLanjut += 1;

    if (batch.tier === null) {
      menungguPutusan += 1;
      continue;
    }

    dibandingkan += 1;
    const origin = { lat: batch.sppgLat, lng: batch.sppgLng };
    const nearest = nearestFacilityTo(origin, facilities);
    if (nearest !== null) {
      nearestKm += haversineKm(origin, nearest);
    }

    if (SOURCE_TIERS.has(batch.tier)) {
      ditanganiDiSumber += 1;
    } else {
      dialihkan += 1;
      const chosen =
        batch.chosenFacilityId === null
          ? null
          : (facilityById.get(batch.chosenFacilityId) ?? null);
      if (chosen !== null) {
        argusKm += haversineKm(origin, chosen);
      } else if (nearest !== null) {
        argusKm += haversineKm(origin, nearest);
      }
    }

    const nearestCandidate =
      nearest === null
        ? null
        : (batch.candidates.find(
            (candidate) => candidate.facilityId === nearest.id,
          ) ?? null);
    if (nearestCandidate !== null && !nearestCandidate.eligible) {
      tidakSesuaiProfil += 1;
    }
  }

  const nearestTotal = round1(nearestKm);
  const argusTotal = round1(argusKm);

  return Object.freeze({
    batch: Object.freeze({
      total: batches.length,
      diterima,
      butuhTindakLanjut,
      ditanganiDiSumber,
      dialihkan,
      menungguPutusan,
    }),
    nearest: Object.freeze({
      totalKm: nearestTotal,
      estimasiBiayaRp: costOf(nearestTotal, biayaPerKm),
      tidakSesuaiProfil,
    }),
    argus: Object.freeze({
      totalKm: argusTotal,
      estimasiBiayaRp: costOf(argusTotal, biayaPerKm),
    }),
    dibandingkan,
  });
};
