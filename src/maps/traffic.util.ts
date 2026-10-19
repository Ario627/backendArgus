import type { GeoCoordinate } from '../common/utils/geo.util.js';
import type { TrafficStep } from './traffic.types.js';

const ROAD_HINT_MAX = 48;

export const decodePolyline = (encoded: string): readonly GeoCoordinate[] => {
  const points: GeoCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return Object.freeze(points);
};

const cleanName = (name: string | null): string | null => {
  if (name === null) return null;
  const trimmed = name.replace(/\s+/g, ' ').trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > ROAD_HINT_MAX
    ? `${trimmed.slice(0, ROAD_HINT_MAX - 1)}…`
    : trimmed;
};

export const describeManeuver = (
  type: string | null,
  modifier: string | null,
  road: string | null,
): string => {
  const target = cleanName(road);
  const dest = target === null ? 'jalan berikutnya' : `ke ${target}`;
  const movement = (modifier ?? '').toLowerCase();
  const kind = (type ?? '').toLowerCase();

  if (kind === 'depart') {
    return target === null
      ? 'Mulai perjalanan'
      : `Mulai perjalanan lewat ${target}`;
  }
  if (kind === 'arrive' || kind === 'destination') return 'Tiba di tujuan';
  if (kind === 'uturn' || movement.includes('uturn'))
    return `Putar balik ${dest}`;
  if (kind === 'roundabout' || kind === 'rotary')
    return `Masuk bundaran, keluar ${dest}`;
  if (kind === 'merge') return `Gabung ${dest}`;
  if (kind === 'fork') return `Ambil cabang ${dest}`;
  if (kind === 'ramp') return `Ambil jalan penghubung ${dest}`;
  if (kind === 'off ramp') return `Keluar jalan ${dest}`;
  if (kind === 'on ramp') return `Masuk jalan ${dest}`;
  if (kind === 'end of road') {
    if (movement.startsWith('left'))
      return `Di ujung jalan, belok kiri ${dest}`;
    if (movement.startsWith('right'))
      return `Di ujung jalan, belok kanan ${dest}`;
    return `Lurus ${dest}`;
  }
  if (
    kind === 'turn' ||
    kind === 'new name' ||
    kind === 'continue' ||
    kind === 'notification'
  ) {
    if (movement.startsWith('sharp left')) return `Tajam ke kiri ${dest}`;
    if (movement.startsWith('sharp right')) return `Tajam ke kanan ${dest}`;
    if (movement.startsWith('slight left')) return `Agak ke kiri ${dest}`;
    if (movement.startsWith('slight right')) return `Agak ke kanan ${dest}`;
    if (movement.startsWith('left')) return `Belok kiri ${dest}`;
    if (movement.startsWith('right')) return `Belok kanan ${dest}`;
    if (movement === 'straight' || kind === 'continue' || kind === 'new name') {
      return `Lurus terus ${dest}`;
    }
  }
  if (kind === 'ferry') return `Naik feri ${dest}`;
  return `Lanjutkan ${dest}`;
};

export const stepOf = (raw: {
  readonly instruction?: string | null;
  readonly type?: string | null;
  readonly modifier?: string | null;
  readonly road?: string | null;
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly location?: GeoCoordinate | null;
}): TrafficStep => {
  const provided = cleanName(raw.instruction ?? null);
  return Object.freeze({
    instruction:
      provided ??
      describeManeuver(
        raw.type ?? null,
        raw.modifier ?? null,
        raw.road ?? null,
      ),
    distanceMeters: Math.max(0, Math.round(raw.distanceMeters)),
    durationSeconds: Math.max(0, Math.round(raw.durationSeconds)),
    maneuverType: raw.type ?? null,
    maneuverModifier: raw.modifier ?? null,
    location: raw.location === undefined ? null : raw.location,
  });
};

const MANEUVER_TO_MODIFIER: Readonly<Record<string, string>> = Object.freeze({
  TURN_LEFT: 'left',
  TURN_RIGHT: 'right',
  TURN_SLIGHT_LEFT: 'slight left',
  TURN_SLIGHT_RIGHT: 'slight right',
  TURN_SHARP_LEFT: 'sharp left',
  TURN_SHARP_RIGHT: 'sharp right',
  UTURN_LEFT: 'uturn',
  UTURN_RIGHT: 'uturn',
  STRAIGHT: 'straight',
  MERGE: 'straight',
  DEPART: 'straight',
  DESTINATION: 'straight',
  ROUNDABOUT_LEFT: 'left',
  ROUNDABOUT_RIGHT: 'right',
});

export const googleManeuver = (
  maneuver: string | null,
): { readonly type: string; readonly modifier: string } => {
  if (maneuver === null) return { type: 'continue', modifier: 'straight' };
  if (maneuver === 'DEPART') return { type: 'depart', modifier: 'straight' };
  if (maneuver === 'DESTINATION')
    return { type: 'arrive', modifier: 'straight' };
  if (maneuver.startsWith('ROUNDABOUT'))
    return { type: 'roundabout', modifier: 'left' };
  if (maneuver.startsWith('RAMP') || maneuver.startsWith('FORK')) {
    return {
      type: 'fork',
      modifier: MANEUVER_TO_MODIFIER[maneuver] ?? 'straight',
    };
  }
  if (maneuver.startsWith('MERGE'))
    return { type: 'merge', modifier: 'straight' };
  if (maneuver.startsWith('FERRY'))
    return { type: 'ferry', modifier: 'straight' };
  if (maneuver.startsWith('NAME_CHANGE'))
    return { type: 'continue', modifier: 'straight' };
  return {
    type: 'turn',
    modifier: MANEUVER_TO_MODIFIER[maneuver] ?? 'straight',
  };
};
