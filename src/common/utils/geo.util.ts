export interface GeoCoordinate {
  readonly lat: number;
  readonly lng: number;
}

const EARTH_MEAN_RADIUS_METERS = 6371008.8;

export const isValidLatitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -90 && value <= 90;

export const isValidLongitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -180 && value <= 180;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const assertCoordinate = (point: GeoCoordinate): void => {
  if (!isValidLatitude(point.lat) || !isValidLongitude(point.lng)) {
    throw new RangeError('GEO_COORDINATE_INVALID');
  }
};

export const haversineMeters = (
  from: GeoCoordinate,
  to: GeoCoordinate,
): number => {
  assertCoordinate(from);
  assertCoordinate(to);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(deltaLng / 2) ** 2;
  const clamped = a < 0 ? 0 : a > 1 ? 1 : a;
  return (
    EARTH_MEAN_RADIUS_METERS *
    2 *
    Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped))
  );
};

export const haversineKm = (from: GeoCoordinate, to: GeoCoordinate): number =>
  haversineMeters(from, to) / 1000;

export const initialBearingDeg = (
  from: GeoCoordinate,
  to: GeoCoordinate,
): number => {
  assertCoordinate(from);
  assertCoordinate(to);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
};

export const COMPASS_POINTS = Object.freeze([
  'utara',
  'timur laut',
  'timur',
  'tenggara',
  'selatan',
  'barat daya',
  'barat',
  'barat laut',
] as const);

export type CompassPoint = (typeof COMPASS_POINTS)[number];

export const compassPointOf = (bearingDeg: number): CompassPoint => {
  const normalized = ((bearingDeg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return COMPASS_POINTS[index] ?? 'utara';
};
