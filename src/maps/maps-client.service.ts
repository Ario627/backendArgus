import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { MatrixSource } from '../common/constant/domain.constant.js';
import {
  haversineMeters,
  type GeoCoordinate,
} from '../common/utils/geo.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { parseMapboxMatrix } from './matrix-response.util.js';

const MAX_MATRIX_POINTS = 10;
const MAPBOX_MATRIX_BASE =
  'https://api.mapbox.com/directions-matrix/v1/mapbox/driving';
const MAX_RESPONSE_BYTES = 262144;

export interface TravelMatrix {
  readonly points: readonly GeoCoordinate[];
  readonly durationsSeconds: readonly (readonly number[])[];
  readonly distancesMeters: readonly (readonly number[])[];
  readonly source: MatrixSource;
}

const travelSecondsOf = (meters: number, speedKmh: number): number =>
  Math.round(meters / ((speedKmh * 1000) / 3600));

@Injectable()
export class MapsClientService {
  private readonly logger = new Logger(MapsClientService.name);
  private readonly token: string | null;
  private readonly timeoutMs: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.token = config.mapbox.token;
    this.timeoutMs = config.mapbox.timeoutMs;
  }

  async buildMatrix(
    points: readonly GeoCoordinate[],
    fallbackSpeedKmh: number,
  ): Promise<TravelMatrix> {
    if (
      this.token !== null &&
      points.length >= 2 &&
      points.length <= MAX_MATRIX_POINTS
    ) {
      const cells = await this.fetchMapboxMatrix(points);
      if (cells !== null) {
        return Object.freeze({
          points: Object.freeze([...points]),
          durationsSeconds: cells.durationsSeconds,
          distancesMeters: cells.distancesMeters,
          source: 'mapbox' as const,
        });
      }
    }
    return this.buildHaversineMatrix(points, fallbackSpeedKmh);
  }

  private async fetchMapboxMatrix(
    points: readonly GeoCoordinate[],
  ): Promise<{
    durationsSeconds: readonly (readonly number[])[];
    distancesMeters: readonly (readonly number[])[];
  } | null> {
    const coordinates = points
      .map((point) => `${point.lng},${point.lat}`)
      .join(';');
    const url = `${MAPBOX_MATRIX_BASE}/${coordinates}?annotations=duration,distance&access_token=${encodeURIComponent(this.token ?? '')}`;
    try {
      const response = await axios.get<unknown>(url, {
        timeout: this.timeoutMs,
        maxContentLength: MAX_RESPONSE_BYTES,
      });
      const parsed = parseMapboxMatrix(response.data, points.length);
      if (parsed === null) {
        this.logger.warn('respons Mapbox matrix tidak valid, memakai haversine');
      }
      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'UNKNOWN';
      this.logger.warn(`Mapbox matrix gagal (${message}), memakai haversine`);
      return null;
    }
  }

  private buildHaversineMatrix(
    points: readonly GeoCoordinate[],
    fallbackSpeedKmh: number,
  ): TravelMatrix {
    const size = points.length;
    const durations: number[][] = [];
    const distances: number[][] = [];
    for (let from = 0; from < size; from += 1) {
      const durationRow: number[] = [];
      const distanceRow: number[] = [];
      for (let to = 0; to < size; to += 1) {
        const origin = points[from];
        const target = points[to];
        const meters =
          origin === undefined || target === undefined || from === to
            ? 0
            : haversineMeters(origin, target);
        distanceRow.push(Math.round(meters));
        durationRow.push(travelSecondsOf(meters, fallbackSpeedKmh));
      }
      durations.push(durationRow);
      distances.push(distanceRow);
    }
    return Object.freeze({
      points: Object.freeze([...points]),
      durationsSeconds: Object.freeze(
        durations.map((row) => Object.freeze(row)),
      ),
      distancesMeters: Object.freeze(
        distances.map((row) => Object.freeze(row)),
      ),
      source: 'haversine' as const,
    });
  }
}