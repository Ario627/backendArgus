import type { GateProfile } from '../batch/gate.service.js';
import { FRACTION_CODES, type FractionCode, type WasteFlow } from '../common/constant/domain.constant.js';
import type { MoistureRules, VisibleOilPolicy } from '../facility/acceptance-profile.types.js';

const FRACTION_SET: ReadonlySet<string> = new Set(FRACTION_CODES);
const OIL_POLICIES: ReadonlySet<string> = new Set(['fix', 'reject', 'allow']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readNullableRatio = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

const readNullablePositive = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

const readFractionList = (value: unknown): readonly FractionCode[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const codes: FractionCode[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !FRACTION_SET.has(entry)) return null;
    codes.push(entry as FractionCode);
  }
  return codes;
};

const readMoisture = (value: unknown): MoistureRules => {
  if (!isRecord(value)) {
    return Object.freeze({ passMin: null, passMax: null, fixAbove: null, rejectAbove: null });
  }
  return Object.freeze({
    passMin: readNullableRatio(value['passMin']),
    passMax: readNullableRatio(value['passMax']),
    fixAbove: readNullableRatio(value['fixAbove']),
    rejectAbove: readNullableRatio(value['rejectAbove']),
  });
};

const readVisibleOil = (value: unknown): VisibleOilPolicy | null =>
  typeof value === 'string' && OIL_POLICIES.has(value) ? (value as VisibleOilPolicy) : null;

const readContaminant = (value: unknown): GateProfile['contaminant'] => {
  if (!isRecord(value)) {
    return Object.freeze({ plasticPercentMax: null, visibleOil: null });
  }
  return Object.freeze({
    plasticPercentMax: readNullableRatio(value['plasticPercentMax']),
    visibleOil: readVisibleOil(value['visibleOil']),
  });
};

const readOperatingHours = (value: unknown): string | null =>
  typeof value === 'string' && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(value) ? value : null;

export const toGateProfile = (aturan: Record<string, unknown>): GateProfile =>
  Object.freeze({
    acceptsFractions: readFractionList(aturan['acceptsFractions']),
    moisture: readMoisture(aturan['moisture']),
    maxAgeHours: readNullablePositive(aturan['maxAgeHours']),
    contaminant: readContaminant(aturan['contaminant']),
    capacityKgPerDay: readNullablePositive(aturan['capacityKgPerDay']),
    operatingHours: readOperatingHours(aturan['operatingHours']),
    pricePerKg: readNullablePositive(aturan['pricePerKg']),
  });

export const readAcceptsFlows = (aturan: Record<string, unknown>): readonly WasteFlow[] => {
  const value = aturan['acceptsFlows'];
  if (value === undefined) return Object.freeze(['organik'] as const);
  if (!Array.isArray(value) || value.length === 0) return Object.freeze([] as const);
  const flows: WasteFlow[] = [];
  for (const entry of value) {
    if (entry === 'organik' || entry === 'minyak') flows.push(entry);
  }
  return Object.freeze(flows);
};

export const acceptsMinyakOf = (aturan: Record<string, unknown>): boolean =>
  readAcceptsFlows(aturan).includes('minyak');