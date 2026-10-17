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

export const haversineMeters = (from: GeoCoordinate, to: GeoCoordinate): number => {
  assertCoordinate(from);
  assertCoordinate(to);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  const clamped = a < 0 ? 0 : a > 1 ? 1 : a;
  return EARTH_MEAN_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
};

export const haversineKm = (from: GeoCoordinate, to: GeoCoordinate): number =>
  haversineMeters(from, to) / 1000;