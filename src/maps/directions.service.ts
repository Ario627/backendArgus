import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { GeoCoordinate } from '../common/utils/geo.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { ParameterService } from '../parameter/parameter.service.js';
import type { DirectionsReport, MapboxDirections } from './directions.types.js';
import {
  buildStraightLineReport,
  parseCoordinatePair,
  parseMapboxDirections,
  withBearing,
} from './directions.util.js';
import { directionsCoordinateError } from './maps.errors.js';

const MAPBOX_DIRECTIONS_BASE =
  'https://api.mapbox.com/directions/v5/mapbox/driving';
const MAX_RESPONSE_BYTES = 262144;
const CACHE_TTL_MS = 60000;
const CACHE_MAX_ENTRIES = 128;
const DEFAULT_CITY_SPEED_KMH = 20;

interface CacheEntry {
  readonly value: DirectionsReport;
  readonly expiresAt: number;
}

@Injectable()
export class DirectionsService {
  private readonly logger = new Logger(DirectionsService.name);
  private readonly token: string | null;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    configService: ConfigService,
    private readonly parameterService: ParameterService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.token = config.mapbox.token;
    this.timeoutMs = config.mapbox.timeoutMs;
  }

  async directions(
    fromValue: string,
    toValue: string,
  ): Promise<DirectionsReport> {
    const from = parseCoordinatePair(fromValue);
    const to = parseCoordinatePair(toValue);
    if (from === null || to === null) throw directionsCoordinateError();
    const cacheKey = this.cacheKeyOf(from, to);
    const cached = this.readCache(cacheKey);
    if (cached !== null) return cached;
    const report =
      (this.token === null ? null : await this.fetchMapbox(from, to)) ??
      (await this.buildFallback(from, to));
    this.writeCache(cacheKey, report);
    return report;
  }

  private cacheKeyOf(from: GeoCoordinate, to: GeoCoordinate): string {
    return [
      from.lat.toFixed(5),
      from.lng.toFixed(5),
      to.lat.toFixed(5),
      to.lng.toFixed(5),
    ].join(';');
  }

  private readCache(key: string): DirectionsReport | null {
    const entry = this.cache.get(key);
    if (entry === undefined) return null;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private writeCache(key: string, value: DirectionsReport): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private async fetchMapbox(
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): Promise<DirectionsReport | null> {
    const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
    const url = `${MAPBOX_DIRECTIONS_BASE}/${coordinates}?steps=true&geometries=polyline&overview=full&language=id&access_token=${encodeURIComponent(this.token ?? '')}`;
    try {
      const response = await axios.get<unknown>(url, {
        timeout: this.timeoutMs,
        maxContentLength: MAX_RESPONSE_BYTES,
      });
      const parsed: MapboxDirections | null = parseMapboxDirections(
        response.data,
      );
      if (parsed === null) {
        this.logger.warn(
          'respons Mapbox directions tidak valid, memakai garis lurus',
        );
        return null;
      }
      return withBearing(from, to, parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      this.logger.warn(
        `Mapbox directions gagal (${message}), memakai garis lurus`,
      );
      return null;
    }
  }

  private async buildFallback(
    from: GeoCoordinate,
    to: GeoCoordinate,
  ): Promise<DirectionsReport> {
    const row = await this.parameterService.getValue('kecepatan_kota_km_jam');
    const raw = row?.nilai;
    const speedKmh =
      typeof raw === 'number' && raw > 0 ? raw : DEFAULT_CITY_SPEED_KMH;
    return buildStraightLineReport(from, to, speedKmh);
  }
}
