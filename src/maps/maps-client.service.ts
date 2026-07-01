import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { DistanceMatrix, DistanceMatrixRow } from 'src/common/types';

interface GeoPoint {
  id: string;
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

@Injectable()
export class MapsClientService{
    private readonly logger = new Logger(MapsClientService.name);
    private readonly apiKey: string;
    private readonly timeOutMs: number;

    constructor(
        private readonly http: HttpService,
        config: ConfigService,
    ) {
        this.apiKey = config.get<string>('app.mapbox.apiKey') ?? '';
        this.timeOutMs = config.get<number>('app.mapbox.timeoutMs') ?? 5000;

    }

    async getDistanceMatrix(
        origins:  GeoPoint[],
        destinations: GeoPoint[]
    ): Promise<DistanceMatrix> {
        if(origins.length === 0 || destinations.length === 0) {
            return {mode: 'haversine_fallback', rows: []};
        }

        try {
            return await this.fetchMapboxMatrix(origins, destinations);
        } catch(err) {
            this.logger.warn(
              `Mapbox matrix failed, using haversine fallback: ${(err as Error).message}`,
            );

            return this.haversinMatrix(origins, destinations);
        }
    }


    private async fetchMapboxMatrix(
        origins: GeoPoint[],
        destinations: GeoPoint[],
    ):  Promise<DistanceMatrix> {
        const coords = [
            ...origins.map((o) => `${o.lng},${o.lat}`),
            ...destinations.map((d) => `${d.lng},${d.lat}`),
        ].join(';');

        const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}`;
        const {data} =  await firstValueFrom(
            this.http.get(url, {
                params: {
                    access_token: this.apiKey,
                    annotations: `distance.duration`,
                },
                timeout: this.timeOutMs,
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

        return {mode: 'mapbox', rows};
    }


    private haversinMatrix(origins: GeoPoint[], destinations: GeoPoint[]): DistanceMatrix {
        const rows: DistanceMatrixRow[] = origins.flatMap((o) => 
            destinations.map((d) => ({
                from: o.id,
                to: d.id,
                meters: this.haversinMeters(o.lat, o.lng, d.lat, d.lng),
                seconds: 0
            }))
        );
        return {mode: 'haversine_fallback', rows};

    }

    private haversinMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = 
            Math.sin(dLat / 2) ** 2 +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLng / 2) ** 2;
            return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
    }

    private toRad(deg: number): number {
        return (deg * Math.PI) / 180;
    }
}