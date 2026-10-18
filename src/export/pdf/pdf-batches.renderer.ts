import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  rgb,
  type PDFPage,
} from 'pdf-lib';
import {
  PDF_BATCH_COLUMNS,
  PDF_TABLE_WIDTH,
  rowsPerPage,
  type PdfColumn,
} from './pdf-batches.layout.js';
import type {
  PdfBatchDocument,
  PdfBatchDocumentInput,
  PdfBatchRow,
} from './pdf-batches.types.js';
import { truncateToWidth } from './pdf-text.util.js';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const TITLE_SIZE = 15;
const SUBTITLE_SIZE = 8.5;
const META_SIZE = 8;
const CELL_SIZE = 7.5;
const HEADER_ROW_HEIGHT = 18;
const ROW_HEIGHT = 13;
const TABLE_TOP = 748;
const FOOTER_Y = 30;
const TABLE_BOTTOM_LIMIT = 56;
const CELL_PADDING = 3;
const ELLIPSIS_SAFE_MARGIN = 1;

const INK = rgb(0.11, 0.12, 0.13);
const MUTED = rgb(0.42, 0.45, 0.47);
const LINE = rgb(0.86, 0.87, 0.88);
const BAND = rgb(0.95, 0.96, 0.96);

interface Fonts {
  readonly regular: PDFFont;
  readonly bold: PDFFont;
}

const toWibStamp = (instant: Date): string => {
  const shifted = new Date(instant.getTime() + 7 * 3600000);
  const iso = shifted.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} WIB`;
};

const drawFooter = (
  page: PDFPage,
  fonts: Fonts,
  pageNumber: number,
  totalPages: number,
): void => {
  page.drawText('ARGUS — laporan audit internal', {
    x: MARGIN_X,
    y: FOOTER_Y,
    size: 7,
    font: fonts.regular,
    color: MUTED,
  });
  const label = `Halaman ${pageNumber} dari ${totalPages}`;
  const width = fonts.regular.widthOfTextAtSize(label, 7);
  page.drawText(label, {
    x: MARGIN_X + PDF_TABLE_WIDTH - width,
    y: FOOTER_Y,
    size: 7,
    font: fonts.regular,
    color: MUTED,
  });
};

const drawTableHeader = (page: PDFPage, fonts: Fonts, top: number): void => {
  page.drawRectangle({
    x: MARGIN_X,
    y: top - HEADER_ROW_HEIGHT,
    width: PDF_TABLE_WIDTH,
    height: HEADER_ROW_HEIGHT,
    color: BAND,
  });
  let cursor = MARGIN_X;
  for (const column of PDF_BATCH_COLUMNS) {
    const label = truncateToWidth(
      column.label,
      column.width - CELL_PADDING * 2,
      (text) => fonts.bold.widthOfTextAtSize(text, CELL_SIZE),
    );
    const textWidth = fonts.bold.widthOfTextAtSize(label, CELL_SIZE);
    const x =
      column.align === 'right'
        ? cursor + column.width - CELL_PADDING - textWidth
        : cursor + CELL_PADDING;
    page.drawText(label, {
      x,
      y: top - HEADER_ROW_HEIGHT + 5.5,
      size: CELL_SIZE,
      font: fonts.bold,
      color: INK,
    });
    cursor += column.width;
  }
};

const drawRow = (
  page: PDFPage,
  fonts: Fonts,
  column: PdfColumn,
  row: PdfBatchRow,
  index: number,
  cursorX: number,
  rowTop: number,
): void => {
  const raw = column.value(row, index);
  const text = truncateToWidth(
    raw,
    column.width - CELL_PADDING * 2 - ELLIPSIS_SAFE_MARGIN,
    (value) => fonts.regular.widthOfTextAtSize(value, CELL_SIZE),
  );
  if (text.length === 0) return;
  const textWidth = fonts.regular.widthOfTextAtSize(text, CELL_SIZE);
  const x =
    column.align === 'right'
      ? cursorX + column.width - CELL_PADDING - textWidth
      : cursorX + CELL_PADDING;
  page.drawText(text, {
    x,
    y: rowTop + 3.5,
    size: CELL_SIZE,
    font: fonts.regular,
    color: INK,
  });
};

const buildMetaLine = (
  input: PdfBatchDocumentInput,
  rowCount: number,
): string => {
  const parts = [
    `Periode ${input.range.from} s/d ${input.range.to} (WIB)`,
    `dibuat ${toWibStamp(input.generatedAt)}`,
    `${rowCount} batch`,
  ];
  if (input.truncated) parts.push('dipotong ke batas baris');
  parts.push(
    input.demoIncluded ? 'termasuk data demo' : 'data demo dikecualikan',
  );
  return parts.join(' · ');
};

const drawHeading = (
  page: PDFPage,
  fonts: Fonts,
  input: PdfBatchDocumentInput,
  pageNumber: number,
): void => {
  const title =
    pageNumber === 1 ? 'Laporan Audit Batch' : 'Laporan Audit Batch (lanjutan)';
  page.drawText(title, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 52,
    size: TITLE_SIZE,
    font: fonts.bold,
    color: INK,
  });
  page.drawText('ARGUS — jejak keputusan dan bukti limbah dapur MBG', {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 66,
    size: SUBTITLE_SIZE,
    font: fonts.regular,
    color: MUTED,
  });
  if (pageNumber === 1) {
    page.drawText(buildMetaLine(input, input.rows.length), {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 80,
      size: META_SIZE,
      font: fonts.regular,
      color: MUTED,
    });
  }
};

const drawEmptyState = (page: PDFPage, fonts: Fonts): void => {
  page.drawText('Tidak ada batch pada periode ini.', {
    x: MARGIN_X,
    y: TABLE_TOP - 40,
    size: 9,
    font: fonts.regular,
    color: MUTED,
  });
};

const drawTablePage = (
  page: PDFPage,
  fonts: Fonts,
  rows: readonly PdfBatchRow[],
  offset: number,
): void => {
  drawTableHeader(page, fonts, TABLE_TOP);
  let rowTop = TABLE_TOP - HEADER_ROW_HEIGHT;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row === undefined) continue;
    rowTop -= ROW_HEIGHT;
    page.drawLine({
      start: { x: MARGIN_X, y: rowTop + ROW_HEIGHT },
      end: { x: MARGIN_X + PDF_TABLE_WIDTH, y: rowTop + ROW_HEIGHT },
      thickness: 0.25,
      color: LINE,
    });
    let cursor = MARGIN_X;
    for (const column of PDF_BATCH_COLUMNS) {
      drawRow(page, fonts, column, row, offset + index, cursor, rowTop);
      cursor += column.width;
    }
  }
  page.drawLine({
    start: { x: MARGIN_X, y: rowTop },
    end: { x: MARGIN_X + PDF_TABLE_WIDTH, y: rowTop },
    thickness: 0.5,
    color: LINE,
  });
};

export const renderBatchesPdf = async (
  input: PdfBatchDocumentInput,
): Promise<PdfBatchDocument> => {
  const document = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
  };
  const perPage = rowsPerPage({
    contentHeight: TABLE_TOP - HEADER_ROW_HEIGHT - TABLE_BOTTOM_LIMIT,
    rowHeight: ROW_HEIGHT,
  });
  const pages: PdfBatchRow[][] = [];
  for (let index = 0; index < input.rows.length; index += perPage) {
    pages.push(input.rows.slice(index, index + perPage));
  }
  if (pages.length === 0) {
    pages.push([]);
  }
  document.setTitle(
    `ARGUS audit batch ${input.range.from} s/d ${input.range.to}`,
  );
  document.setSubject('Laporan audit batch ARGUS');
  document.setCreator('ARGUS');
  document.setProducer('ARGUS');
  document.setCreationDate(input.generatedAt);

  pages.forEach((pageRows, index) => {
    const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeading(page, fonts, input, index + 1);
    if (pageRows.length === 0 && index === 0) {
      drawEmptyState(page, fonts);
    } else {
      drawTablePage(page, fonts, pageRows, index * perPage);
    }
    drawFooter(page, fonts, index + 1, pages.length);
  });

  const bytes = await document.save();
  return Object.freeze({
    bytes,
    pageCount: pages.length,
    rowCount: input.rows.length,
  });
};