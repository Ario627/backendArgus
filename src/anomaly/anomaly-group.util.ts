import type {
  AnomalyKind,
  AnomalySeverity,
} from '../common/constant/domain.constant.js';
import type { AnomalyReport } from '../ledger/ledger-verify.types.js';

export const SEVERITY_RANK: Readonly<Record<AnomalySeverity, number>> =
  Object.freeze({ INFO: 0, PERHATIAN: 1, KRITIS: 2 });

export interface GroupedAnomaly {
  readonly jenis: AnomalyKind;
  readonly tingkat: AnomalySeverity;
  readonly items: readonly Record<string, unknown>[];
}

interface Accumulator {
  tingkat: AnomalySeverity;
  items: Record<string, unknown>[];
}

export const groupAnomalies = (
  reports: readonly AnomalyReport[],
): readonly GroupedAnomaly[] => {
  const byJenis = new Map<AnomalyKind, Accumulator>();
  for (const report of reports) {
    const existing = byJenis.get(report.jenis);
    if (existing === undefined) {
      byJenis.set(report.jenis, {
        tingkat: report.tingkat,
        items: [report.detail],
      });
      continue;
    }
    existing.items.push(report.detail);
    if (SEVERITY_RANK[report.tingkat] > SEVERITY_RANK[existing.tingkat]) {
      existing.tingkat = report.tingkat;
    }
  }
  return Object.freeze(
    [...byJenis.entries()].map(([jenis, value]) =>
      Object.freeze({
        jenis,
        tingkat: value.tingkat,
        items: Object.freeze([...value.items]),
      }),
    ),
  );
};