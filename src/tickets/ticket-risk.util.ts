import type { TicketKind } from '../common/constant/domain.constant.js';

export const TICKET_RISK_KINDS: readonly TicketKind[] = Object.freeze([
  'bau',
  'limbah_cair',
  'tumpukan',
]);

const SKOR_DASAR = 15;
const BONUS_JENIS = 15;
const BONUS_ANOMALI_DASAR = 20;
const BONUS_ANOMALI_BERAT = 15;
const AMBANG_ANOMALI_BERAT = 3;
const BONUS_TERSANGKUT = 25;
const AMBANG_TERSANGKUT = 2;
const BONUS_FOTO = 10;
const SKOR_MAKS = 100;

export interface TicketRiskInput {
  readonly jenis: TicketKind;
  readonly anomali72h: number;
  readonly tersangkut72h: number;
  readonly berfoto: boolean;
}

export interface TicketRiskResult {
  readonly skor: number;
  readonly komponen: Readonly<Record<string, number>>;
}

const countOf = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

const skorAnomali = (anomali72h: number): number => {
  const count = countOf(anomali72h);
  if (count === 0) return 0;
  return count >= AMBANG_ANOMALI_BERAT
    ? BONUS_ANOMALI_DASAR + BONUS_ANOMALI_BERAT
    : BONUS_ANOMALI_DASAR;
};

const skorTersangkut = (tersangkut72h: number): number =>
  countOf(tersangkut72h) > AMBANG_TERSANGKUT ? BONUS_TERSANGKUT : 0;

export const hitungSkorRisikoTiket = (
  input: TicketRiskInput,
): TicketRiskResult => {
  const komponen: Record<string, number> = {
    dasar: SKOR_DASAR,
    jenis: TICKET_RISK_KINDS.includes(input.jenis) ? BONUS_JENIS : 0,
    anomali: skorAnomali(input.anomali72h),
    tersangkut: skorTersangkut(input.tersangkut72h),
    foto: input.berfoto ? BONUS_FOTO : 0,
  };
  const total = Object.values(komponen).reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    skor: Math.min(SKOR_MAKS, total),
    komponen: Object.freeze(komponen),
  });
};