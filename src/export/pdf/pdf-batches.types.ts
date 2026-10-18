export interface PdfBatchRow {
  readonly tanggalWib: string;
  readonly sppgNama: string;
  readonly aliran: string;
  readonly beratKg: string;
  readonly gateStatus: string | null;
  readonly tingkatPutusan: string | null;
  readonly status: string;
  readonly fasilitasTujuan: string | null;
  readonly jumlahEvent: number;
  readonly anomaliTerbuka: number;
}

export interface PdfBatchDocumentInput {
  readonly rows: readonly PdfBatchRow[];
  readonly range: { readonly from: string; readonly to: string };
  readonly generatedAt: Date;
  readonly truncated: boolean;
  readonly demoIncluded: boolean;
}

export interface PdfBatchDocument {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly rowCount: number;
}