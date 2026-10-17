import type { ValueTransformer } from 'typeorm';

export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined): string | null =>
    value === null || value === undefined ? null : String(value),
  from: (value: string | number | null): number | null =>
    value === null ? null : Number(value),
};

export const bigintTransformer: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};
