import type { PdfBatchRow } from './pdf-batches.types.js';
import { formatKg } from './pdf-text.util.js';

export type PdfAlign = 'left' | 'right';

export interface PdfColumn {
  readonly key: string;
  readonly label: string;
  readonly width: number;
  readonly align: PdfAlign;
  readonly value: (row: PdfBatchRow, index: number) => string;
}

const optional = (value: string | null): string => value ?? '-';

export const PDF_BATCH_COLUMNS: readonly PdfColumn[] = Object.freeze([
  Object.freeze({
    key: 'nomor',
    label: '#',
    width: 22,
    align: 'right' as const,
    value: (_row: PdfBatchRow, index: number) => String(index + 1),
  }),
  Object.freeze({
    key: 'tanggal',
    label: 'Tanggal',
    width: 52,
    align: 'left' as const,
    value: (row: PdfBatchRow) => row.tanggalWib,
  }),
  Object.freeze({
    key: 'sppg',
    label: 'SPPG',
    width: 104,
    align: 'left' as const,
    value: (row: PdfBatchRow) => row.sppgNama,
  }),
  Object.freeze({
    key: 'aliran',
    label: 'Aliran',
    width: 38,
    align: 'left' as const,
    value: (row: PdfBatchRow) => row.aliran,
  }),
  Object.freeze({
    key: 'berat',
    label: 'Kg',
    width: 42,
    align: 'right' as const,
    value: (row: PdfBatchRow) => formatKg(row.beratKg),
  }),
  Object.freeze({
    key: 'gerbang',
    label: 'Gerbang',
    width: 44,
    align: 'left' as const,
    value: (row: PdfBatchRow) => optional(row.gateStatus),
  }),
  Object.freeze({
    key: 'tingkat',
    label: 'Tingkat',
    width: 42,
    align: 'left' as const,
    value: (row: PdfBatchRow) => optional(row.tingkatPutusan),
  }),
  Object.freeze({
    key: 'status',
    label: 'Status',
    width: 56,
    align: 'left' as const,
    value: (row: PdfBatchRow) => row.status,
  }),
  Object.freeze({
    key: 'fasilitas',
    label: 'Fasilitas',
    width: 49,
    align: 'left' as const,
    value: (row: PdfBatchRow) => optional(row.fasilitasTujuan),
  }),
  Object.freeze({
    key: 'event',
    label: 'Event',
    width: 32,
    align: 'right' as const,
    value: (row: PdfBatchRow) => String(row.jumlahEvent),
  }),
  Object.freeze({
    key: 'anomali',
    label: 'Anomali',
    width: 34,
    align: 'right' as const,
    value: (row: PdfBatchRow) => String(row.anomaliTerbuka),
  }),
]);

export const PDF_TABLE_WIDTH = PDF_BATCH_COLUMNS.reduce(
  (total, column) => total + column.width,
  0,
);

export const rowsPerPage = (input: {
  readonly contentHeight: number;
  readonly rowHeight: number;
}): number => Math.max(1, Math.floor(input.contentHeight / input.rowHeight));

export const paginateRows = <T>(
  rows: readonly T[],
  perPage: number,
): readonly (readonly T[])[] => {
  const size = Math.max(1, perPage);
  const pages: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    pages.push(rows.slice(index, index + size));
  }
  return Object.freeze(pages.map((page) => Object.freeze(page)));
};