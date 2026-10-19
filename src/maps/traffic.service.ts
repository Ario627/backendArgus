import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  compassPointOf,
  haversineMeters,
  initialBearingDeg,
  type GeoCoordinate,
} from '../common/utils/geo.util.js';
import type {
  AppConfiguration,
  RoutingConfig,
} from '../config/configuration.js';
import { ParameterService } from '../parameter/parameter.service.js';
import {
  congestionFromRatio,
  congestionOf,
  type CongestionLevel,
  type RouteAlternative,
  type RouteAlternativesReport,
  type RoutingProvider,
  type TrafficStep,
} from './traffic.types.js';
import { decodePolyline, googleManeuver, stepOf } from './traffic.util.js';

const CACHE_TTL_MS = 45_000;
const CACHE_MAX_ENTRIES = 96;
const MAX_RESPONSE_BYTES = 1048576;
const GOOGLE_ROUTES_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes';
const GOOGLE_FIELD_MASK = [
  'routes.description',
  'routes.distanceMeters',
  'routes.duration',
  'routes.staticDuration',
  'routes.polyline.encodedPolyline',
  'routes.routeLabels',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.navigationInstruction',
  'routes.legs.steps.startLocation',
].join(',');
const DEFAULT_CITY_SPEED_KMH = 20;

interface CacheEntry {
  readonly value: RouteAlternativesReport;
  readonly expiresAt: number;
}

interface BuiltAlternative {
  readonly alternative: RouteAlternative;
  readonly staticSeconds: number;
}

const secondsOfGoogleDuration = (value: unknown): number => {
  if (typeof value !== 'string') return Number.NaN;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  return match === null ? Number.NaN : Number(match[1]);
};

const alternativeIdOf = (provider: RoutingProvider, index: number): string =>
  `${provider}-${index + 1}`;

const colorOf = (congestion: CongestionLevel): string => congestion;

const pickRecommended = (alternatives: readonly RouteAlternative[]): string => {
  let best = alternatives[0];
  for (const candidate of alternatives) {
    if (best === undefined) {
      best = candidate;
      continue;
    }
    if (candidate.durationInTrafficSeconds < best.durationInTrafficSeconds)
      best = candidate;
  }
  return best?.id ?? '';
};

@Injectable()
export class TrafficRouteService {
  private readonly logger = new Logger(TrafficRouteService.name);
  private readonly mapboxToken: string | null;
  private readonly routing: RoutingConfig;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    configService: ConfigService,
    private readonly parameterService: ParameterService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.mapboxToken = config.mapbox.token;
    this.routing = config.routing;
  }

  async route(
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): Promise<RouteAlternativesReport> {
    const cacheKey = [
      from.lat.toFixed(5),
      from.lng.toFixed(5),
      to.lat.toFixed(5),
      to.lng.toFixed(5),
    ].join(';');
    const cached = this.readCache(cacheKey);
    if (cached !== null) return cached;

    const report = await this.resolve(from, to);
    this.writeCache(cacheKey, report);
    return report;
  }

  private readCache(key: string): RouteAlternativesReport | null {
    const entry = this.cache.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private writeCache(key: string, value: RouteAlternativesReport): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private async resolve(
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): Promise<RouteAlternativesReport> {
    if (this.routing.trafficEnabled && this.routing.googleKey !== null) {
      const google = await this.fetchGoogle(from, to, this.routing.googleKey);
      if (google !== null) return google;
    }
    if (this.mapboxToken !== null) {
      const mapbox = await this.fetchMapbox(from, to, this.mapboxToken);
      if (mapbox !== null) return mapbox;
    }
    const osrm = await this.fetchOsrm(from, to);
    if (osrm !== null) return osrm;
    return this.buildStraightLine(from, to);
  }

  private async fetchGoogle(
    from: GeoCoordinate,
    to: GeoCoordinate,
    key: string,
  ): Promise<RouteAlternativesReport | null> {
    try {
      const response = await axios.post<unknown>(
        GOOGLE_ROUTES_URL,
        {
          origin: {
            location: { latLng: { latitude: from.lat, longitude: from.lng } },
          },
          destination: {
            location: { latLng: { latitude: to.lat, longitude: to.lng } },
          },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
          computeAlternativeRoutes: this.routing.alternatives > 1,
          polylineQuality: 'HIGH_QUALITY',
          polylineEncoding: 'GEO_LINE',
          languageCode: 'id',
          units: 'METRIC',
          departureTime: new Date(Date.now() + 30_000).toISOString(),
        },
        {
          timeout: this.routing.timeoutMs,
          maxContentLength: MAX_RESPONSE_BYTES,
          headers: {
            'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': GOOGLE_FIELD_MASK,
          },
        },
      );
      const parsed = this.parseGoogle(response.data, from, to);
      if (parsed === null) {
        this.logger.warn(
          'respons Google Routes tidak valid, mencoba penyedia lain',
        );
        return null;
      }
      return parsed;
    } catch (error) {
      this.logger.warn(
        `Google Routes gagal (${error instanceof Error ? error.message : 'UNKNOWN'})`,
      );
      return null;
    }
  }

  private parseGoogle(
    payload: unknown,
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): RouteAlternativesReport | null {
    if (payload === null || typeof payload !== 'object') return null;
    const routes = (payload as { routes?: unknown }).routes;
    if (!Array.isArray(routes) || routes.length === 0) return null;

    const built: BuiltAlternative[] = [];
    let index = 0;
    for (const raw of routes) {
      if (raw === null || typeof raw !== 'object') continue;
      const route = raw as Record<string, unknown>;
      const distanceMeters =
        typeof route['distanceMeters'] === 'number'
          ? route['distanceMeters']
          : Number.NaN;
      const durationSeconds = secondsOfGoogleDuration(route['duration']);
      const staticSeconds = secondsOfGoogleDuration(route['staticDuration']);
      const polyline =
        typeof route['polyline'] === 'object' && route['polyline'] !== null
          ? (route['polyline'] as Record<string, unknown>)['encodedPolyline']
          : undefined;
      if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds))
        continue;
      if (typeof polyline !== 'string' || polyline.length < 4) continue;

      const ratio =
        Number.isFinite(staticSeconds) && staticSeconds > 0
          ? durationSeconds / staticSeconds
          : 1;
      const score = congestionFromRatio(ratio);
      const steps = this.parseGoogleSteps(route);
      const description =
        typeof route['description'] === 'string' ? route['description'] : null;
      built.push({
        staticSeconds: Number.isFinite(staticSeconds)
          ? staticSeconds
          : durationSeconds,
        alternative: Object.freeze({
          id: alternativeIdOf('google', index),
          label: description === null ? `Alternatif ${index + 1}` : description,
          via: description,
          distanceMeters: Math.round(distanceMeters),
          durationSeconds: Math.round(
            Number.isFinite(staticSeconds) ? staticSeconds : durationSeconds,
          ),
          durationInTrafficSeconds: Math.round(durationSeconds),
          congestion: congestionOf(score),
          congestionScore: score,
          trafficKnown: true,
          path: decodePolyline(polyline),
          polyline,
          steps,
        }),
      });
      index += 1;
    }
    if (built.length === 0) return null;
    return this.compose('google', built, true, null, from, to);
  }

  private parseGoogleSteps(
    route: Record<string, unknown>,
  ): readonly TrafficStep[] {
    const legs = Array.isArray(route['legs']) ? route['legs'] : [];
    const steps: TrafficStep[] = [];
    for (const rawLeg of legs) {
      if (rawLeg === null || typeof rawLeg !== 'object') continue;
      const rawSteps = (rawLeg as Record<string, unknown>)['steps'];
      if (!Array.isArray(rawSteps)) continue;
      for (const rawStep of rawSteps) {
        if (rawStep === null || typeof rawStep !== 'object') continue;
        const step = rawStep as Record<string, unknown>;
        const distance =
          typeof step['distanceMeters'] === 'number'
            ? step['distanceMeters']
            : 0;
        const duration = secondsOfGoogleDuration(step['staticDuration']);
        const navigation = step['navigationInstruction'];
        const instruction =
          navigation !== null && typeof navigation === 'object'
            ? (navigation as Record<string, unknown>)['instructions']
            : null;
        const maneuver =
          navigation !== null && typeof navigation === 'object'
            ? (navigation as Record<string, unknown>)['maneuver']
            : null;
        const mapped = googleManeuver(
          typeof maneuver === 'string' ? maneuver : null,
        );
        const startLocation = step['startLocation'];
        const latLng =
          startLocation !== null && typeof startLocation === 'object'
            ? (startLocation as Record<string, unknown>)['latLng']
            : null;
        const lat =
          latLng !== null && typeof latLng === 'object'
            ? (latLng as Record<string, unknown>)['latitude']
            : null;
        const lng =
          latLng !== null && typeof latLng === 'object'
            ? (latLng as Record<string, unknown>)['longitude']
            : null;
        steps.push(
          stepOf({
            instruction: typeof instruction === 'string' ? instruction : null,
            type: mapped.type,
            modifier: mapped.modifier,
            road: null,
            distanceMeters: distance,
            durationSeconds: Number.isFinite(duration) ? duration : 0,
            location:
              typeof lat === 'number' && typeof lng === 'number'
                ? { lat, lng }
                : null,
          }),
        );
      }
    }
    return Object.freeze(steps);
  }

  private async fetchMapbox(
    from: GeoCoordinate,
    to: GeoCoordinate,
    token: string,
  ): Promise<RouteAlternativesReport | null> {
    const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const query = new URLSearchParams({
      alternatives: this.routing.alternatives > 1 ? 'true' : 'false',
      annotations: 'congestion,duration,distance',
      geometries: 'polyline',
      overview: 'full',
      steps: 'true',
      language: 'id',
      access_token: token,
    });
    try {
      const response = await axios.get<unknown>(
        `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}?${query.toString()}`,
        {
          timeout: this.routing.timeoutMs,
          maxContentLength: MAX_RESPONSE_BYTES,
        },
      );
      return this.parseMapbox(response.data, from, to);
    } catch (error) {
      this.logger.warn(
        `Mapbox traffic gagal (${error instanceof Error ? error.message : 'UNKNOWN'})`,
      );
      return null;
    }
  }

  private parseMapbox(
    payload: unknown,
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): RouteAlternativesReport | null {
    if (payload === null || typeof payload !== 'object') return null;
    const routes = (payload as { routes?: unknown }).routes;
    if (!Array.isArray(routes) || routes.length === 0) return null;

    const built: BuiltAlternative[] = [];
    let index = 0;
    for (const raw of routes) {
      if (raw === null || typeof raw !== 'object') continue;
      const route = raw as Record<string, unknown>;
      const distanceMeters =
        typeof route['distance'] === 'number' ? route['distance'] : Number.NaN;
      const durationSeconds =
        typeof route['duration'] === 'number' ? route['duration'] : Number.NaN;
      const geometry = route['geometry'];
      if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds))
        continue;
      if (typeof geometry !== 'string' || geometry.length < 4) continue;

      const congestion = this.mapboxCongestion(route);
      const providerDuration = Math.round(durationSeconds);
      built.push({
        staticSeconds: providerDuration,
        alternative: Object.freeze({
          id: alternativeIdOf('mapbox', index),
          label:
            congestion.via === null
              ? `Alternatif ${index + 1}`
              : congestion.via,
          via: congestion.via,
          distanceMeters: Math.round(distanceMeters),
          durationSeconds: providerDuration,
          durationInTrafficSeconds: congestion.adjustedSeconds,
          congestion: congestion.level,
          congestionScore: congestion.score,
          trafficKnown: true,
          path: decodePolyline(geometry),
          polyline: geometry,
          steps: this.parseMapboxSteps(route),
        }),
      });
      index += 1;
    }
    if (built.length === 0) return null;
    return this.compose('mapbox', built, true, null, from, to);
  }

  private mapboxCongestion(route: Record<string, unknown>): {
    readonly level: CongestionLevel;
    readonly score: number;
    readonly adjustedSeconds: number;
    readonly via: string | null;
  } {
    const durationSeconds =
      typeof route['duration'] === 'number' ? route['duration'] : Number.NaN;
    const legs = Array.isArray(route['legs']) ? route['legs'] : [];
    let weighted = 0;
    let total = 0;
    let firstRoad: string | null = null;
    for (const rawLeg of legs) {
      if (rawLeg === null || typeof rawLeg !== 'object') continue;
      const annotation = (rawLeg as Record<string, unknown>)['annotation'];
      if (annotation === null || typeof annotation !== 'object') continue;
      const congestionRaw = (annotation as Record<string, unknown>)[
        'congestion'
      ];
      const distancesRaw = (annotation as Record<string, unknown>)['distance'];
      if (!Array.isArray(congestionRaw) || !Array.isArray(distancesRaw))
        continue;
      const congestion: readonly unknown[] = congestionRaw;
      const distances: readonly unknown[] = distancesRaw;
      for (let i = 0; i < congestion.length; i += 1) {
        const level = congestion[i];
        const distance = distances[i];
        if (typeof distance !== 'number') continue;
        const weight =
          level === 'severe'
            ? 1.4
            : level === 'heavy'
              ? 1
              : level === 'moderate'
                ? 0.5
                : level === 'low'
                  ? 0
                  : 0.25;
        weighted += distance * weight;
        total += distance;
      }
    }
    const steps = Array.isArray(route['legs']) ? route['legs'] : [];
    for (const rawLeg of steps) {
      if (rawLeg === null || typeof rawLeg !== 'object') continue;
      const rawSteps = (rawLeg as Record<string, unknown>)['steps'];
      if (!Array.isArray(rawSteps)) continue;
      for (const rawStep of rawSteps) {
        if (rawStep === null || typeof rawStep !== 'object') continue;
        const name = (rawStep as Record<string, unknown>)['name'];
        if (typeof name === 'string' && name.trim().length > 3) {
          firstRoad = name.trim();
          break;
        }
      }
      if (firstRoad !== null) break;
    }
    const score =
      total > 0 ? Math.min(1, weighted / total) : congestionFromRatio(1);
    return {
      level: congestionOf(score),
      score,
      adjustedSeconds: Number.isFinite(durationSeconds)
        ? Math.round(durationSeconds)
        : 0,
      via: firstRoad,
    };
  }

  private parseMapboxSteps(
    route: Record<string, unknown>,
  ): readonly TrafficStep[] {
    const legs = Array.isArray(route['legs']) ? route['legs'] : [];
    const steps: TrafficStep[] = [];
    for (const rawLeg of legs) {
      if (rawLeg === null || typeof rawLeg !== 'object') continue;
      const rawSteps = (rawLeg as Record<string, unknown>)['steps'];
      if (!Array.isArray(rawSteps)) continue;
      for (const rawStep of rawSteps) {
        if (rawStep === null || typeof rawStep !== 'object') continue;
        const step = rawStep as Record<string, unknown>;
        const distance =
          typeof step['distance'] === 'number' ? step['distance'] : 0;
        const duration =
          typeof step['duration'] === 'number' ? step['duration'] : 0;
        const maneuver = step['maneuver'];
        const instruction =
          maneuver !== null && typeof maneuver === 'object'
            ? (maneuver as Record<string, unknown>)['instruction']
            : null;
        const type =
          maneuver !== null && typeof maneuver === 'object'
            ? (maneuver as Record<string, unknown>)['type']
            : null;
        const modifier =
          maneuver !== null && typeof maneuver === 'object'
            ? (maneuver as Record<string, unknown>)['modifier']
            : null;
        const location =
          maneuver !== null && typeof maneuver === 'object'
            ? (maneuver as Record<string, unknown>)['location']
            : null;
        const lng =
          Array.isArray(location) && typeof location[0] === 'number'
            ? location[0]
            : null;
        const lat =
          Array.isArray(location) && typeof location[1] === 'number'
            ? location[1]
            : null;
        const name = step['name'];
        steps.push(
          stepOf({
            instruction: typeof instruction === 'string' ? instruction : null,
            type: typeof type === 'string' ? type : null,
            modifier: typeof modifier === 'string' ? modifier : null,
            road: typeof name === 'string' ? name : null,
            distanceMeters: distance,
            durationSeconds: duration,
            location: lat !== null && lng !== null ? { lat, lng } : null,
          }),
        );
      }
    }
    return Object.freeze(steps);
  }

  private async fetchOsrm(
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): Promise<RouteAlternativesReport | null> {
    const base = this.routing.osrmBaseUrl.replace(/\/+$/, '');
    const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const query = new URLSearchParams({
      alternatives: this.routing.alternatives > 1 ? 'true' : 'false',
      overview: 'full',
      geometries: 'polyline',
      steps: 'true',
      annotations: 'duration,distance',
    });
    try {
      const response = await axios.get<unknown>(
        `${base}/route/v1/driving/${coordinates}?${query.toString()}`,
        {
          timeout: this.routing.timeoutMs,
          maxContentLength: MAX_RESPONSE_BYTES,
        },
      );
      return this.parseOsrm(response.data, from, to);
    } catch (error) {
      this.logger.warn(
        `OSRM gagal (${error instanceof Error ? error.message : 'UNKNOWN'})`,
      );
      return null;
    }
  }

  private parseOsrm(
    payload: unknown,
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): RouteAlternativesReport | null {
    if (payload === null || typeof payload !== 'object') return null;
    const record = payload as Record<string, unknown>;
    if (record['code'] !== 'Ok') return null;
    const routes = record['routes'];
    if (!Array.isArray(routes) || routes.length === 0) return null;

    const built: BuiltAlternative[] = [];
    let index = 0;
    for (const raw of routes) {
      if (raw === null || typeof raw !== 'object') continue;
      const route = raw as Record<string, unknown>;
      const distanceMeters =
        typeof route['distance'] === 'number' ? route['distance'] : Number.NaN;
      const durationSeconds =
        typeof route['duration'] === 'number' ? route['duration'] : Number.NaN;
      const geometry = route['geometry'];
      if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds))
        continue;
      if (typeof geometry !== 'string' || geometry.length < 4) continue;
      const steps = this.parseOsrmSteps(route);
      const via = this.firstRoadOf(steps);
      built.push({
        staticSeconds: Math.round(durationSeconds),
        alternative: Object.freeze({
          id: alternativeIdOf('osrm', index),
          label: via === null ? `Alternatif ${index + 1}` : `Lewat ${via}`,
          via,
          distanceMeters: Math.round(distanceMeters),
          durationSeconds: Math.round(durationSeconds),
          durationInTrafficSeconds: Math.round(durationSeconds),
          congestion: 'lancar' as const,
          congestionScore: 0,
          trafficKnown: false,
          path: decodePolyline(geometry),
          polyline: geometry,
          steps,
        }),
      });
      index += 1;
    }
    if (built.length === 0) return null;
    return this.compose(
      'osrm',
      built,
      false,
      'Perkiraan tanpa data lalu lintas langsung. Waktu tempuh bisa berbeda saat jam sibuk.',
      from,
      to,
    );
  }

  private parseOsrmSteps(
    route: Record<string, unknown>,
  ): readonly TrafficStep[] {
    const legs = Array.isArray(route['legs']) ? route['legs'] : [];
    const steps: TrafficStep[] = [];
    for (const rawLeg of legs) {
      if (rawLeg === null || typeof rawLeg !== 'object') continue;
      const rawSteps = (rawLeg as Record<string, unknown>)['steps'];
      if (!Array.isArray(rawSteps)) continue;
      for (const rawStep of rawSteps) {
        if (rawStep === null || typeof rawStep !== 'object') continue;
        const step = rawStep as Record<string, unknown>;
        const distance =
          typeof step['distance'] === 'number' ? step['distance'] : 0;
        const duration =
          typeof step['duration'] === 'number' ? step['duration'] : 0;
        const maneuver = step['maneuver'];
        const type =
          maneuver !== null && typeof maneuver === 'object'
            ? (maneuver as Record<string, unknown>)['type']
            : null;
        const modifier =
          maneuver !== null && typeof maneuver === 'object'
            ? (maneuver as Record<string, unknown>)['modifier']
            : null;
        const location =
          maneuver !== null && typeof maneuver === 'object'
            ? (maneuver as Record<string, unknown>)['location']
            : null;
        const lng =
          Array.isArray(location) && typeof location[0] === 'number'
            ? location[0]
            : null;
        const lat =
          Array.isArray(location) && typeof location[1] === 'number'
            ? location[1]
            : null;
        const name = step['name'];
        steps.push(
          stepOf({
            instruction: null,
            type: typeof type === 'string' ? type : null,
            modifier: typeof modifier === 'string' ? modifier : null,
            road: typeof name === 'string' ? name : null,
            distanceMeters: distance,
            durationSeconds: duration,
            location: lat !== null && lng !== null ? { lat, lng } : null,
          }),
        );
      }
    }
    return Object.freeze(steps);
  }

  private firstRoadOf(steps: readonly TrafficStep[]): string | null {
    for (const step of steps) {
      const match = /(?:ke|lewat|di) (.+)$/.exec(step.instruction);
      if (match !== null && match[1] !== undefined && match[1].length > 3)
        return match[1];
    }
    return null;
  }

  private async buildStraightLine(
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): Promise<RouteAlternativesReport> {
    const row = await this.parameterService.getValue('kecepatan_kota_km_jam');
    const raw = row?.nilai;
    const speedKmh =
      typeof raw === 'number' && raw > 0 ? raw : DEFAULT_CITY_SPEED_KMH;
    const distanceMeters = Math.round(haversineMeters(from, to));
    const seconds = Math.round(distanceMeters / ((speedKmh * 1000) / 3600));
    const compass = compassPointOf(initialBearingDeg(from, to));
    const alternative: RouteAlternative = Object.freeze({
      id: alternativeIdOf('garis-lurus', 0),
      label: `Arah ${compass}`,
      via: null,
      distanceMeters,
      durationSeconds: seconds,
      durationInTrafficSeconds: seconds,
      congestion: 'lancar' as const,
      congestionScore: 0,
      trafficKnown: false,
      path: Object.freeze([
        Object.freeze({ ...from }),
        Object.freeze({ ...to }),
      ]),
      polyline: null,
      steps: Object.freeze([
        stepOf({
          instruction: `Belum ada data jalan untuk wilayah ini. Jarak lurus ${(distanceMeters / 1000).toFixed(1)} km ke arah ${compass}.`,
          type: 'depart',
          modifier: compass,
          road: null,
          distanceMeters,
          durationSeconds: seconds,
          location: { ...from },
        }),
        stepOf({
          instruction: 'Tiba di tujuan bila sudah dekat.',
          type: 'arrive',
          modifier: null,
          road: null,
          distanceMeters: 0,
          durationSeconds: 0,
          location: { ...to },
        }),
      ]),
    });
    return Object.freeze({
      provider: 'garis-lurus' as const,
      trafficAware: false,
      updatedAt: new Date().toISOString(),
      from,
      to,
      recommendedId: alternative.id,
      alternatives: Object.freeze([alternative]),
      note: 'Semua penyedia peta tidak dapat dihubungi. Arah memakai garis lurus — jangan dijadikan patokan jalan.',
    });
  }

  private compose(
    provider: RoutingProvider,
    built: readonly BuiltAlternative[],
    trafficAware: boolean,
    note: string | null,
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): RouteAlternativesReport {
    const alternatives = built.map((entry) => entry.alternative);
    return Object.freeze({
      provider,
      trafficAware,
      updatedAt: new Date().toISOString(),
      from: { ...from },
      to: { ...to },
      recommendedId: pickRecommended(alternatives),
      alternatives: Object.freeze(alternatives),
      note,
    });
  }
}

export { colorOf };
