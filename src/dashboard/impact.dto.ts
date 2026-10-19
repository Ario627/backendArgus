export interface DashboardImpactDto {
  readonly date: string;
  readonly scopeSppgId: string | null;
  readonly biayaPerKm: number | null;
  readonly batch: {
    readonly total: number;
    readonly diterima: number;
    readonly butuhTindakLanjut: number;
    readonly ditanganiDiSumber: number;
    readonly dialihkan: number;
    readonly menungguPutusan: number;
  };
  readonly nearest: {
    readonly totalKm: number;
    readonly estimasiBiayaRp: number | null;
    readonly tidakSesuaiProfil: number;
  };
  readonly argus: {
    readonly totalKm: number;
    readonly estimasiBiayaRp: number | null;
  };
  readonly dibandingkan: number;
  readonly catatan: string;
}
