import type {
  ParameterKey,
  ParameterSource,
} from '../common/constant/domain.constant.js';

export interface ParameterDto {
  readonly kunci: ParameterKey;
  readonly nilai: number | null;
  readonly satuan: string | null;
  readonly sumber: ParameterSource;
  readonly catatan: string | null;
  readonly terkalibrasi: boolean;
  readonly updatedAt: string | null;
  readonly updatedBy: string | null;
}

export const toParameterDto = (input: {
  readonly kunci: ParameterKey;
  readonly nilai: number | null;
  readonly satuan: string | null;
  readonly sumber: ParameterSource;
  readonly catatan: string | null;
  readonly updatedBy: string | null;
  readonly updatedAt: Date | null;
}): ParameterDto =>
  Object.freeze({
    kunci: input.kunci,
    nilai: input.nilai,
    satuan: input.satuan,
    sumber: input.sumber,
    catatan: input.catatan,
    terkalibrasi: input.nilai !== null && input.sumber !== 'belum_ada',
    updatedAt: input.updatedAt?.toISOString() ?? null,
    updatedBy: input.updatedBy,
  });