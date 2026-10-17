import { fromHundredths, toHundredths } from '../common/utils/decimal.util.js';

export interface MassBalanceInput {
  readonly handedOverKg: number;
  readonly receivedKg: number;
  readonly susutWajar: number;
  readonly toleransi: number;
}

export interface MassBalanceResult {
  readonly expectedMinKg: number;
  readonly expectedMaxKg: number;
  readonly ok: boolean;
  readonly deltaPercent: number;
  readonly severity: 'PERHATIAN' | 'KRITIS' | null;
}

export const computeMassBalance = (input: MassBalanceInput): MassBalanceResult => {
  if (!(input.handedOverKg > 0)) throw new RangeError('MASS_BALANCE_HANDOVER_INVALID');

  const expectedMinKg =
    input.handedOverKg * (1 - input.susutWajar - input.toleransi) <= 0
      ? 0
      : fromHundredths(toHundredths(input.handedOverKg * (1 - input.susutWajar - input.toleransi)));
  const expectedMaxKg = fromHundredths(
    toHundredths(input.handedOverKg * (1 - input.susutWajar + input.toleransi)),
  );
  const deltaPercent =
    Math.round(((input.receivedKg - input.handedOverKg) / input.handedOverKg) * 1000) / 10;
  const ok = input.receivedKg >= expectedMinKg && input.receivedKg <= expectedMaxKg;

  let deviation = 0;
  if (input.receivedKg < expectedMinKg && expectedMinKg > 0) {
    deviation = (expectedMinKg - input.receivedKg) / expectedMinKg;
  } else if (input.receivedKg > expectedMaxKg) {
    deviation = (input.receivedKg - expectedMaxKg) / expectedMaxKg;
  }

  const severity = ok ? null : deviation > input.toleransi * 2 ? 'KRITIS' : 'PERHATIAN';

  return Object.freeze({ expectedMinKg, expectedMaxKg, ok, deltaPercent, severity });
};