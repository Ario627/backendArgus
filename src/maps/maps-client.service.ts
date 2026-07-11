import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DistanceMatrix, DistanceMatrixRow, GeoPoint } from 'src/common/types';
import { haversineMeters } from 'src/common/utils/geo';

const MAPBOX_MAX_COORDS = 25;  

@Injectable()
export class MapsClientService {
  private readonly logger = new Logger(MapsClientService.name);
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('app.mapbox.apiKey') ?? '';
    this.timeoutMs = config.get<number>('app.mapbox.timeoutMs') ?? 5000;
  }


  async getFullMatrix(allPoints: GeoPoint[]): Promise<DistanceMatrix> {
    if (allPoints.length <= 1) {
      return { mode: 'haversine_fallback', rows: [] };
    }


    if (this.apiKey && allPoints.length <= MAPBOX_MAX_COORDS) {
      try {
        return await this.fetchFullMatrix(allPoints);
      } catch (err) {
        this.logger.warn(
          `Mapbox full matrix failed, falling back to haversine: ${(err as Error).message}`,
        );
      }
    } else if (this.apiKey) {
      this.logger.warn(
        `Too many points (${allPoints.length}) for Mapbox API (max ${MAPBOX_MAX_COORDS}), using haversine`,
      );
    }

    return this.haversineFullMatrix(allPoints);
  }


  private async fetchFullMatrix(points: GeoPoint[]): Promise<DistanceMatrix> {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}`;

    const { data } = await firstValueFrom(
      this.http.get(url, {
        params: {
          access_token: this.apiKey,
          annotations: 'distance,duration',
          sources: 'all',
          destinations: 'all',
        },
        timeout: this.timeoutMs,
      }),
    );

    const rows: DistanceMatrixRow[] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const meters = Math.round(data.distances?.[i]?.[j] ?? 0);
        const seconds = Math.round(data.durations?.[i]?.[j] ?? 0);
        rows.push({ from: points[i].id, to: points[j].id, meters, seconds });
      }
    }

    return { mode: 'mapbox', rows };
  }


  private haversineFullMatrix(points: GeoPoint[]): DistanceMatrix {
    const rows: DistanceMatrixRow[] = [];
    const avgSpeedMps = 8.33; // ~30 km/h for urban waste trucks

    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const meters = haversineMeters(
          points[i].lat, points[i].lng,
          points[j].lat, points[j].lng,
        );
        rows.push({
          from: points[i].id,
          to: points[j].id,
          meters,
          seconds: Math.round(meters / avgSpeedMps),
        });
      }
    }

    return { mode: 'haversine_fallback', rows };
  }


  async getDistanceMatrix(
    origins: GeoPoint[],
    destinations: GeoPoint[],
  ): Promise<DistanceMatrix> {
    if (origins.length === 0 || destinations.length === 0) {
      return { mode: 'haversine_fallback', rows: [] };
    }

    try {
      return await this.fetchMapboxMatrix(origins, destinations);
    } catch (err) {
      this.logger.warn(
        `Mapbox matrix failed, using haversine fallback: ${(err as Error).message}`,
      );
      return this.haversineMatrix(origins, destinations);
    }
  }

  private async fetchMapboxMatrix(
    origins: GeoPoint[],
    destinations: GeoPoint[],
  ): Promise<DistanceMatrix> {
    const coords = [
      ...origins.map((o) => `${o.lng},${o.lat}`),
      ...destinations.map((d) => `${d.lng},${d.lat}`),
    ].join(';');

    const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}`;
    const { data } = await firstValueFrom(
      this.http.get(url, {
        params: {
          access_token: this.apiKey,
          annotations: 'distance,duration',
        },
        timeout: this.timeoutMs,
      }),
    );

    const rows: DistanceMatrixRow[] = [];
    for (let i = 0; i < origins.length; i++) {
      for (let j = 0; j < destinations.length; j++) {
        rows.push({
          from: origins[i].id,
          to: destinations[j].id,
          meters: Math.round(data.distances?.[i]?.[j + origins.length] ?? 0),
          seconds: Math.round(data.durations?.[i]?.[j + origins.length] ?? 0),
        });
      }
    }

    return { mode: 'mapbox', rows };
  }

  private haversineMatrix(
    origins: GeoPoint[],
    destinations: GeoPoint[],
  ): DistanceMatrix {
    const rows: DistanceMatrixRow[] = origins.flatMap((o) =>
      destinations.map((d) => ({
        from: o.id,
        to: d.id,
        meters: haversineMeters(o.lat, o.lng, d.lat, d.lng),
        seconds: 0,
      })),
    );
    return { mode: 'haversine_fallback', rows };
  }
}
