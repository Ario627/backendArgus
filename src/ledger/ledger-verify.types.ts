import type { AnomalyKind, AnomalySeverity } from '../common/constant/domain.constant.js';
import type { MassBalanceResult } from './mass-balance.util.js';
import type { TransferEvaluation } from './transfer.util.js';

export interface AnomalyReport {
  readonly jenis: AnomalyKind;
  readonly tingkat: AnomalySeverity;
  readonly detail: Record<string, unknown>;
}

export interface ChainIssueReport {
  readonly index: number;
  readonly eventId: string;
  readonly reason: 'HASH_MISMATCH' | 'PREV_LINK_MISMATCH';
}

export interface MassBalanceReport extends MassBalanceResult {
  readonly handedOverKg: number;
  readonly receivedKg: number;
  readonly parameter: {
    readonly susutWajar: number;
    readonly toleransi: number;
    readonly susutWajarSumber: string;
    readonly toleransiSumber: string;
  };
}

export interface SpoilageReport {
  readonly maxAgeHours: number | null;
  readonly elapsedHours: number | null;
  readonly late: boolean | null;
}

export interface VerificationReport {
  readonly batchId: string;
  readonly chainOk: boolean;
  readonly eventsChecked: number;
  readonly chainIssue: ChainIssueReport | null;
  readonly transferStatus: TransferEvaluation['status'];
  readonly transfer: TransferEvaluation;
  readonly massBalance: MassBalanceReport | null;
  readonly spoilage: SpoilageReport;
  readonly anomalies: readonly AnomalyReport[];
  readonly notes: readonly string[];
}