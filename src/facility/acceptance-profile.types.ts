import type { FractionCode, WasteFlow } from '../common/constant/domain.constant.js';

export const VISIBLE_OIL_POLICIES = Object.freeze(['fix', 'reject', 'allow'] as const);
export type VisibleOilPolicy = (typeof VISIBLE_OIL_POLICIES)[number];

export type MoistureRules = {
  readonly passMin: number | null;
  readonly passMax: number | null;
  readonly fixAbove: number | null;
  readonly rejectAbove: number | null;
};

export type ContaminantRules = {
  readonly plasticPercentMax: number | null;
  readonly visibleOil: VisibleOilPolicy;
};

export type AcceptanceProfileRules = {
  readonly acceptsFractions: readonly FractionCode[];
  readonly acceptsFlows: readonly WasteFlow[];
  readonly moisture: MoistureRules;
  readonly maxAgeHours: number | null;
  readonly contaminant: ContaminantRules;
  readonly capacityKgPerDay: number | null;
  readonly operatingHours: string | null;
  readonly pricePerKg: number | null;
};

export type ProfileViolation = {
  readonly rule: string;
  readonly path: string;
  readonly detail: string;
};

export type ProfileParseResult =
  | { readonly ok: true; readonly profile: AcceptanceProfileRules }
  | { readonly ok: false; readonly violations: readonly ProfileViolation[] };