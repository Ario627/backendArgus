import type {
  FractionCode,
  GateStatus,
  MoistureProxy,
  WasteFlow,
} from '../common/constant/domain.constant.js';
import { GATE_SEVERITY } from '../common/constant/domain.constant.js';
import { sumTo2 } from '../common/utils/decimal.util.js';
import type { MoistureRules, VisibleOilPolicy } from '../facility/acceptance-profile.types.js';

export interface GateProfile {
  readonly acceptsFractions: readonly FractionCode[] | null;
  readonly moisture: MoistureRules;
  readonly maxAgeHours: number | null;
  readonly contaminant: {
    readonly plasticPercentMax: number | null;
    readonly visibleOil: VisibleOilPolicy | null;
  };
  readonly capacityKgPerDay: number | null;
  readonly operatingHours: string | null;
  readonly pricePerKg: number | null;
}

export interface GateTarget {
  readonly facilityId: string;
  readonly acceptsMinyak: boolean;
}

export interface GateInput {
  readonly aliran: WasteFlow;
  readonly weightKg: number;
  readonly fractions: Readonly<Partial<Record<FractionCode, number>>>;
  readonly moistureProxy: MoistureProxy | null;
  readonly visibleOil: boolean;
  readonly ageHours: number;
  readonly queueKgToday: number;
  readonly profile: GateProfile;
  readonly target: GateTarget | null;
}

export interface GateViolation {
  readonly rule: string;
  readonly detail: string;
}

export interface GateNote {
  readonly rule: string;
  readonly detail: string;
}

export interface GateResult {
  readonly status: GateStatus;
  readonly fixes: readonly string[];
  readonly violations: readonly GateViolation[];
  readonly notes: readonly GateNote[];
  readonly usedDefaultProfile: boolean;
}

type FindingSeverity = GateStatus | 'INFO';

interface GateFinding {
  readonly rule: string;
  readonly detail: string;
  readonly severity: FindingSeverity;
  readonly fix?: string;
}

export const DEFAULT_SAFE_PROFILE: GateProfile = Object.freeze({
  acceptsFractions: null,
  moisture: Object.freeze({ passMin: 45, passMax: 75, fixAbove: 75, rejectAbove: 80 }),
  maxAgeHours: null,
  contaminant: Object.freeze({ plasticPercentMax: null, visibleOil: null }),
  capacityKgPerDay: null,
  operatingHours: null,
  pricePerKg: null,
});

const formatHours = (value: number): string => (Math.round(value * 10) / 10).toFixed(1);

const ageFindings = (input: GateInput): readonly GateFinding[] => {
  const maxAgeHours = input.profile.maxAgeHours;
  if (maxAgeHours === null || input.ageHours <= maxAgeHours) return [];
  return [
    {
      rule: 'UMUR_LEWAT',
      severity: 'TOLAK',
      detail: `umur ${formatHours(input.ageHours)} jam melewati batas ${maxAgeHours} jam`,
    },
  ];
};

const moistureFindings = (input: GateInput): readonly GateFinding[] => {
  if (input.moistureProxy === 'basah') {
    return [
      {
        rule: 'MOISTURE_BASAH',
        severity: 'PERBAIKI',
        detail: 'proksi uji remas: menetes',
        fix: 'tiriskan',
      },
    ];
  }
  if (input.moistureProxy === 'kering' && input.aliran === 'organik') {
    return [
      {
        rule: 'MOISTURE_KERING',
        severity: 'INFO',
        detail: 'proksi uji remas: kering; substrat kering memperlambat pengolahan',
      },
    ];
  }
  return [];
};

const oilFindings = (input: GateInput): readonly GateFinding[] => {
  if (!input.visibleOil) return [];
  const policy = input.profile.contaminant.visibleOil;
  if (policy === 'reject') {
    return [
      {
        rule: 'MINYAK_TERLIHAT',
        severity: 'TOLAK',
        detail: 'minyak terlihat dan profil tujuan menolaknya',
      },
    ];
  }
  if (policy === 'fix') {
    return [
      {
        rule: 'MINYAK_TERLIHAT',
        severity: 'PERBAIKI',
        detail: 'minyak terlihat pada fraksi',
        fix: 'pisahkan minyak ke jerigen',
      },
    ];
  }
  return [];
};

const contaminantFindings = (input: GateInput): readonly GateFinding[] => {
  const plasticMax = input.profile.contaminant.plasticPercentMax;
  const contaminantPercent = input.fractions.E ?? 0;
  if (plasticMax === null || contaminantPercent <= plasticMax) return [];
  return [
    {
      rule: 'KONTAMINAN_E_MELEBIHI',
      severity: 'PERBAIKI',
      detail: `fraksi E ${contaminantPercent}% > batas ${plasticMax}%`,
      fix: 'pisahkan plastik/kontaminan',
    },
  ];
};

const fractionFindings = (input: GateInput): readonly GateFinding[] => {
  const accepted = input.profile.acceptsFractions;
  if (accepted === null) return [];
  const rejected = (Object.keys(input.fractions) as FractionCode[]).filter(
    (code) => (input.fractions[code] ?? 0) > 0 && !accepted.includes(code),
  );
  if (rejected.length === 0) return [];
  return [
    {
      rule: 'FRAKSI_TIDAK_DITERIMA',
      severity: 'ALIHKAN',
      detail: `fraksi ${rejected.sort().join(', ')} tidak diterima profil tujuan`,
    },
  ];
};

const capacityFindings = (input: GateInput): readonly GateFinding[] => {
  const capacity = input.profile.capacityKgPerDay;
  if (capacity === null) return [];
  const totalKg = sumTo2([input.queueKgToday, input.weightKg]);
  if (totalKg <= capacity) return [];
  return [
    {
      rule: 'KAPASITAS_HARIAN_PENUH',
      severity: 'ALIHKAN',
      detail: `antrean ${input.queueKgToday} kg dan batch ${input.weightKg} kg melebihi kapasitas ${capacity} kg/hari`,
    },
  ];
};

const flowFindings = (input: GateInput): readonly GateFinding[] => {
  if (input.aliran !== 'minyak' || input.target === null || input.target.acceptsMinyak) return [];
  return [
    {
      rule: 'ALIRAN_MINYAK_TIDAK_DIDUKUNG',
      severity: 'ALIHKAN',
      detail: 'aliran minyak tidak diterima oleh fasilitas tujuan',
    },
  ];
};

const collectFixes = (findings: readonly GateFinding[]): readonly string[] => {
  const fixes: string[] = [];
  for (const finding of findings) {
    if (finding.fix !== undefined && !fixes.includes(finding.fix)) {
      fixes.push(finding.fix);
    }
  }
  return Object.freeze(fixes);
};

const hardestStatus = (findings: readonly GateFinding[]): GateStatus =>
  findings.reduce<GateStatus>(
    (acc, finding) =>
      finding.severity === 'INFO' || GATE_SEVERITY[finding.severity] <= GATE_SEVERITY[acc]
        ? acc
        : finding.severity,
    'LOLOS',
  );

export const evaluateGate = (input: GateInput): GateResult => {
  const findings: readonly GateFinding[] = [
    ...ageFindings(input),
    ...moistureFindings(input),
    ...oilFindings(input),
    ...contaminantFindings(input),
    ...fractionFindings(input),
    ...capacityFindings(input),
    ...flowFindings(input),
  ];

  const violations = findings
    .filter((finding) => finding.severity !== 'INFO')
    .map((finding) => ({ rule: finding.rule, detail: finding.detail }));
  const notes = findings
    .filter((finding) => finding.severity === 'INFO')
    .map((finding) => ({ rule: finding.rule, detail: finding.detail }));

  return Object.freeze({
    status: hardestStatus(findings),
    fixes: collectFixes(findings),
    violations: Object.freeze(violations),
    notes: Object.freeze(notes),
    usedDefaultProfile: input.profile === DEFAULT_SAFE_PROFILE,
  });
};