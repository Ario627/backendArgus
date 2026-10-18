import type { GeoCoordinate } from '../common/utils/geo.util.js';

export type DirectionsSource = 'mapbox' | 'garis-lurus';

export interface DirectionStep {
  readonly instruction: string;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly maneuverType: string | null;
  readonly maneuverModifier: string | null;
  readonly location: GeoCoordinate | null;
}

export interface DirectionsReport {
  readonly source: DirectionsSource;
  readonly lowConfidence: boolean;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly bearingDeg: number;
  readonly compass: string;
  readonly polyline: string | null;
  readonly path: readonly GeoCoordinate[];
  readonly steps: readonly DirectionStep[];
}

export interface MapboxDirections {
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly polyline: string | null;
  readonly steps: readonly DirectionStep[];
}
