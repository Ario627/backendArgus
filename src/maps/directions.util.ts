import {
  compassPointOf,
  haversineMeters,
  initialBearingDeg,
  isValidLatitude,
  isValidLongitude,
  type GeoCoordinate,
} from '../common/utils/geo.util.js';
import type {
  DirectionStep,
  DirectionsReport,
  MapboxDirections,
} from './directions.types.js';

const COORDINATE_PATTERN = /^(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/;
const ARRIVAL_RADIUS_METERS = 30;

interface MapboxManeuver {
  readonly type?: unknown;
  readonly modifier?: unknown;
  readonly location?: unknown;
  readonly instruction?: unknown;
}

interface MapboxStepPayload {
  readonly distance?: unknown;
  readonly duration?: unknown;
  readonly name?: unknown;
  readonly maneuver?: MapboxManeuver;
}

interface MapboxRoutePayload {
  readonly distance?: unknown;
  readonly duration?: unknown;
  readonly geometry?: unknown;
  readonly legs?: unknown;
}

export const parseCoordinatePair = (value: string): GeoCoordinate | null => {
  const match = COORDINATE_PATTERN.exec(value.trim());
  if (match === null) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;
  return { lat, lng };
};

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const textOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const stepOf = (payload: MapboxStepPayload): DirectionStep | null => {
  const distanceMeters = finiteNumber(payload.distance);
  const durationSeconds = finiteNumber(payload.duration);
  if (distanceMeters === null || durationSeconds === null) return null;
  const maneuver = payload.maneuver ?? {};
  const rawLocation = Array.isArray(maneuver.location)
    ? maneuver.location
    : null;
  const lng = rawLocation === null ? null : finiteNumber(rawLocation[0]);
  const lat = rawLocation === null ? null : finiteNumber(rawLocation[1]);
  const name = textOf(payload.name);
  const instruction =
    textOf(maneuver.instruction) ??
    (name === null ? 'Lanjutkan perjalanan' : `Lanjutkan melalui ${name}`);
  const validLocation =
    lat !== null &&
    lng !== null &&
    isValidLatitude(lat) &&
    isValidLongitude(lng);
  return Object.freeze({
    instruction,
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
    maneuverType: textOf(maneuver.type),
    maneuverModifier: textOf(maneuver.modifier),
    location: validLocation ? Object.freeze({ lat, lng }) : null,
  });
};

export const parseMapboxDirections = (
  payload: unknown,
): MapboxDirections | null => {
  if (payload === null || typeof payload !== 'object') return null;
  const routes = (payload as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  const candidate: unknown = routes[0];
  if (candidate === null || typeof candidate !== 'object') return null;
  const route = candidate as MapboxRoutePayload;
  const distanceMeters = finiteNumber(route.distance);
  const durationSeconds = finiteNumber(route.duration);
  if (distanceMeters === null || durationSeconds === null) return null;
  const legs: readonly unknown[] = Array.isArray(route.legs) ? route.legs : [];
  const firstLeg = legs[0];
  const rawSteps =
    firstLeg !== null && typeof firstLeg === 'object'
      ? (firstLeg as { steps?: unknown }).steps
      : null;
  if (!Array.isArray(rawSteps)) return null;
  const steps: DirectionStep[] = [];
  const rawStepsList: readonly unknown[] = rawSteps;
  for (const raw of rawStepsList) {
    if (raw === null || typeof raw !== 'object') continue;
    const parsed = stepOf(raw);
    if (parsed !== null) steps.push(parsed);
  }
  if (steps.length === 0) return null;
  return {
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
    polyline: textOf(route.geometry),
    steps: Object.freeze(steps),
  };
};

export const buildStraightLineReport = (
  from: GeoCoordinate,
  to: GeoCoordinate,
  speedKmh: number,
): DirectionsReport => {
  const distanceMeters = Math.round(haversineMeters(from, to));
  const safeSpeed = speedKmh > 0 ? speedKmh : 20;
  const durationSeconds =
    distanceMeters === 0
      ? 0
      : Math.round(distanceMeters / ((safeSpeed * 1000) / 3600));
  const bearingDeg = Math.round(initialBearingDeg(from, to));
  const compass = compassPointOf(bearingDeg);
  const arrival = distanceMeters < ARRIVAL_RADIUS_METERS;
  const instruction = arrival
    ? 'Anda sudah berada di sekitar lokasi tujuan.'
    : `Jarak lurus ${(distanceMeters / 1000).toFixed(1)} km ke arah ${compass}. Ikuti jalan utama menuju titik tujuan.`;
  const step: DirectionStep = Object.freeze({
    instruction,
    distanceMeters,
    durationSeconds,
    maneuverType: arrival ? 'arrive' : 'depart',
    maneuverModifier: null,
    location: arrival ? Object.freeze({ ...to }) : Object.freeze({ ...from }),
  });
  return Object.freeze({
    source: 'garis-lurus' as const,
    lowConfidence: true,
    distanceMeters,
    durationSeconds,
    bearingDeg,
    compass,
    polyline: null,
    path: Object.freeze([Object.freeze({ ...from }), Object.freeze({ ...to })]),
    steps: Object.freeze([step]),
  });
};

export const withBearing = (
  from: GeoCoordinate,
  to: GeoCoordinate,
  parsed: MapboxDirections,
): DirectionsReport => {
  const bearingDeg = Math.round(initialBearingDeg(from, to));
  return Object.freeze({
    source: 'mapbox' as const,
    lowConfidence: false,
    distanceMeters: parsed.distanceMeters,
    durationSeconds: parsed.durationSeconds,
    bearingDeg,
    compass: compassPointOf(bearingDeg),
    polyline: parsed.polyline,
    path: Object.freeze([]),
    steps: parsed.steps,
  });
};
