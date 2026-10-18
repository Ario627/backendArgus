import type {
  AnomalyKind,
  AnomalySeverity,
} from '../common/constant/domain.constant.js';

export const NARRATIVE_PROMPT_VERSION = 1;

export type NarrativeScope = 'semua' | 'sppg';

export interface NarrativeAnomalyFact {
  readonly jenis: AnomalyKind;
  readonly tingkat: AnomalySeverity;
  readonly jumlah: number;
}

export interface NarrativeFacts {
  readonly tanggal: string;
  readonly cakupan: NarrativeScope;
  readonly batch: {
    readonly total: number;
    readonly totalKg: number;
    readonly gate: {
      readonly lolos: number;
      readonly perbaiki: number;
      readonly alihkan: number;
      readonly tolak: number;
    };
    readonly menungguPutusan: number;
  };
  readonly sebelumnya: {
    readonly total: number;
    readonly totalKg: number;
  };
  readonly anomaliTerbuka: readonly NarrativeAnomalyFact[];
  readonly tiketBaru: number;
  readonly adaDataDemo: boolean;
}

export type NarrativeStatus = 'READY' | 'PENDING' | 'DISABLED';

export interface NarrativeView {
  readonly status: NarrativeStatus;
  readonly narasi: string | null;
  readonly model: string | null;
  readonly generatedAt: string | null;
  readonly expiresAt: string | null;
  readonly retryAfterSeconds: number | null;
  readonly reason: string | null;
}

export interface NarrativeCacheRow {
  readonly id: string;
  readonly cache_key: string;
  readonly narasi: string;
  readonly model: string;
  readonly created_at: Date;
  readonly expires_at: Date;
}

export interface NarrativeGenerationInput {
  readonly cacheKey: string;
  readonly facts: NarrativeFacts;
}