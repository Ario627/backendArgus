import type { GeoCoordinate } from '../common/utils/geo.util.js';

export type CongestionLevel = 'lancar' | 'padat' | 'macet';

export type RoutingProvider = 'google' | 'mapbox' | 'osrm' | 'garis-lurus';

export interface TrafficStep {
  readonly instruction: string;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly maneuverType: string | null;
  readonly maneuverModifier: string | null;
  readonly location: GeoCoordinate | null;
}

export interface RouteAlternative {
  readonly id: string;
  readonly label: string;
  readonly via: string | null;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly durationInTrafficSeconds: number;
  readonly congestion: CongestionLevel;
  readonly congestionScore: number;
  readonly trafficKnown: boolean;
  readonly path: readonly GeoCoordinate[];
  readonly polyline: string | null;
  readonly steps: readonly TrafficStep[];
}

export interface RouteAlternativesReport {
  readonly provider: RoutingProvider;
  readonly trafficAware: boolean;
  readonly updatedAt: string;
  readonly from: GeoCoordinate;
  readonly to: GeoCoordinate;
  readonly recommendedId: string;
  readonly alternatives: readonly RouteAlternative[];
  readonly note: string | null;
}

export const CONGESTION_LABELS: Readonly<Record<CongestionLevel, string>> =
  Object.freeze({
    lancar: 'Lancar',
    padat: 'Agak padat',
    macet: 'Macet',
  });

export const congestionOf = (score: number): CongestionLevel => {
  if (score < 0.25) return 'lancar';
  if (score < 0.55) return 'padat';
  return 'macet';
};

export const congestionFromRatio = (ratio: number): number => {
  if (!Number.isFinite(ratio)) return 0;
  const clamped = Math.max(1, ratio);
  return Math.min(1.5, (clamped - 1) * 1.6) / 1.5;
};
