export const DISPOSITION_TIERS = Object.freeze([
  'T0',
  'T1',
  'T2',
  'T3',
  'T4',
] as const);
export type DispositionTier = (typeof DISPOSITION_TIERS)[number];

export const DISPOSITION_TIER_LABELS: Readonly<
  Record<DispositionTier, string>
> = Object.freeze({
  T0: 'Cegah di sumber',
  T1: 'Olah di dapur',
  T2: 'Hub kluster',
  T3: 'Fasilitas pusat',
  T4: 'Fallback tercatat',
});

export const GATE_STATUSES = Object.freeze([
  'LOLOS',
  'PERBAIKI',
  'ALIHKAN',
  'TOLAK',
] as const);
export type GateStatus = (typeof GATE_STATUSES)[number];

export const GATE_SEVERITY: Readonly<Record<GateStatus, number>> =
  Object.freeze({
    LOLOS: 0,
    PERBAIKI: 1,
    ALIHKAN: 2,
    TOLAK: 3,
  });

export const GATE_REJECT_PROBABILITY: Readonly<Record<GateStatus, number>> =
  Object.freeze({
    LOLOS: 0,
    PERBAIKI: 0.25,
    ALIHKAN: 0.6,
    TOLAK: 1,
  });

export const FRACTION_CODES = Object.freeze(['A', 'B', 'C', 'D', 'E'] as const);
export type FractionCode = (typeof FRACTION_CODES)[number];

export const FRACTION_LABELS: Readonly<Record<FractionCode, string>> =
  Object.freeze({
    A: 'Sisa persiapan sayur mentah',
    B: 'Sisa piring nasi/lauk matang',
    C: 'Berkuah atau berminyak',
    D: 'Kulit keras atau cangkang',
    E: 'Kontaminan',
  });

export const WASTE_FLOWS = Object.freeze(['organik', 'minyak'] as const);
export type WasteFlow = (typeof WASTE_FLOWS)[number];

export const MOISTURE_PROXIES = Object.freeze([
  'kering',
  'sedang',
  'basah',
] as const);
export type MoistureProxy = (typeof MOISTURE_PROXIES)[number];

export const BATCH_STATUSES = Object.freeze([
  'DICATAT',
  'MENUNGGU_ANGKUT',
  'DIANGKUT',
  'DITERIMA',
  'DIOLAH',
  'SELESAI',
  'GAGAL_GATE',
  'TERSANGKUT',
] as const);
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const LEDGER_EVENT_TYPES = Object.freeze([
  'DIKELUARKAN',
  'DITIMBANG',
  'SERAH_TERIMA',
  'DITERIMA',
  'DIOLAH',
  'KELUARAN',
  'KOREKSI',
] as const);
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export const USER_ROLES = Object.freeze([
  'admin',
  'sppg_staff',
  'driver',
  'facility',
  'dlh_auditor',
] as const);
export type UserRole = (typeof USER_ROLES)[number];

export const FACILITY_LEVELS = Object.freeze(['T1', 'T2', 'T3', 'T4'] as const);
export type FacilityLevel = (typeof FACILITY_LEVELS)[number];

export const FACILITY_KINDS = Object.freeze([
  'komposter',
  'bsf',
  'hub',
  'tps3r',
  'tpa',
  'lainnya',
] as const);
export type FacilityKind = (typeof FACILITY_KINDS)[number];

export const DISTRIBUTION_POINT_KINDS = Object.freeze([
  'sekolah',
  'paud',
  'posyandu',
  'puskesmas',
  'lainnya',
] as const);
export type DistributionPointKind = (typeof DISTRIBUTION_POINT_KINDS)[number];

export const MENU_COMPONENTS = Object.freeze([
  'karbohidrat',
  'protein',
  'sayur',
  'buah',
  'susu',
  'lainnya',
] as const);
export type MenuComponent = (typeof MENU_COMPONENTS)[number];

export const LEFTOVER_SCALE = Object.freeze([0, 1, 2, 3, 4] as const);
export type LeftoverLevel = (typeof LEFTOVER_SCALE)[number];

export const LEFTOVER_SCALE_LABELS: Readonly<Record<LeftoverLevel, string>> =
  Object.freeze({
    0: 'Habis',
    1: 'Sisa sedikit',
    2: 'Separuh',
    3: 'Sisa banyak',
    4: 'Hampir penuh',
  });

export const TICKET_KINDS = Object.freeze([
  'bau',
  'limbah_cair',
  'tumpukan',
  'lainnya',
] as const);
export type TicketKind = (typeof TICKET_KINDS)[number];

export const TICKET_KIND_LABELS: Readonly<Record<TicketKind, string>> =
  Object.freeze({
    bau: 'Bau',
    limbah_cair: 'Limbah cair',
    tumpukan: 'Tumpukan',
    lainnya: 'Lainnya',
  });

export const TICKET_STATUSES = Object.freeze([
  'BARU',
  'DIVERIFIKASI',
  'DITANGGAPI',
  'SELESAI',
  'DITOLAK_MODERASI',
] as const);
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ANOMALY_KINDS = Object.freeze([
  'NERACA_MASSA',
  'DURASI_UMUR',
  'DIGIT_TIDAK_WAJAR',
  'RANTAI_TIMPA',
  'JEDA_PENGAMBILAN',
] as const);
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];

export const ANOMALY_SEVERITIES = Object.freeze([
  'INFO',
  'PERHATIAN',
  'KRITIS',
] as const);
export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

export const PARAMETER_SOURCES = Object.freeze([
  'literatur',
  'kalibrasi_pilot',
  'manual_admin',
  'belum_ada',
] as const);
export type ParameterSource = (typeof PARAMETER_SOURCES)[number];

export const PHOTO_MIME_TYPES = Object.freeze([
  'image/webp',
  'image/jpeg',
] as const);
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

export const PHOTO_REF_TYPES = Object.freeze([
  'batch',
  'ledger_event',
  'tiket',
  'lainnya',
] as const);
export type PhotoRefType = (typeof PHOTO_REF_TYPES)[number];

export const FLEET_STATUSES = Object.freeze([
  'ONLINE_NORMAL',
  'ONLINE_BROKEN',
  'STALE',
  'OFFLINE',
] as const);
export type FleetStatus = (typeof FLEET_STATUSES)[number];

export const HARDWARE_STATUSES = Object.freeze(['normal', 'broken'] as const);
export type HardwareStatus = (typeof HARDWARE_STATUSES)[number];

export const DEVICE_TYPES = Object.freeze(['tracker', 'timbangan'] as const);
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const ROUTE_STATUSES = Object.freeze([
  'DRAFT',
  'AKTIF',
  'SELESAI',
  'NEEDS_MANUAL_SCHEDULING',
  'BATAL',
] as const);
export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const ROUTE_SOURCES = Object.freeze([
  'optimizer',
  'greedy',
  'manual',
] as const);
export type RouteSource = (typeof ROUTE_SOURCES)[number];

export const MATRIX_SOURCES = Object.freeze(['mapbox', 'haversine'] as const);
export type MatrixSource = (typeof MATRIX_SOURCES)[number];

export const ROUTE_STOP_KINDS = Object.freeze(['AMBIL', 'ANTAR'] as const);
export type RouteStopKind = (typeof ROUTE_STOP_KINDS)[number];

export const ROUTE_STOP_STATUSES = Object.freeze([
  'RENCANA',
  'SAMPAI',
  'SELESAI',
  'GAGAL',
] as const);
export type RouteStopStatus = (typeof ROUTE_STOP_STATUSES)[number];

export const CONFIRMABLE_STOP_STATUSES = Object.freeze([
  'SAMPAI',
  'SELESAI',
  'GAGAL',
] as const);
export type ConfirmableStopStatus = (typeof CONFIRMABLE_STOP_STATUSES)[number];

export const BATCH_WEIGHT_LIMITS = Object.freeze({
  minKg: 0.1,
  maxKg: 500,
  minyakMaxKg: 200,
});

export const PARAMETER_KEYS = Object.freeze([
  'biaya_per_km',
  'faktor_muat',
  'biaya_tolak',
  'penalti_umur_per_jam',
  'susut_wajar_proksi',
  'toleransi_neraca',
  'ambang_proporsi_digit',
  'kecepatan_kota_km_jam',
] as const);
export type ParameterKey = (typeof PARAMETER_KEYS)[number];
