import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DEFAULT_SAFE_PROFILE } from '../batch/gate.service.js';
import type { AppConfiguration } from '../config/configuration.js';
import { haversineKm } from '../common/utils/geo.util.js';
import type { UtcDayRange } from '../common/utils/daily-range.util.js';
import { AcceptanceProfile } from '../database/entities/acceptance-profile.entity.js';
import { Facility } from '../database/entities/facility.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { acceptsMinyakOf, toGateProfile } from './profile.mapper.js';
import type { CandidateTier, ScoreCandidate } from './score.util.js';

const EARTH_DEG_LAT_KM = 111.32;
const MIN_COS_LAT = 0.1;

const round1 = (value: number): number => Math.round(value * 10) / 10;

const QUEUE_TIERS = Object.freeze(['T1', 'T2', 'T3']);

@Injectable()
export class CandidateBuilder {
  private readonly radiusKm: number;

  constructor(
    @InjectRepository(Facility) private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(AcceptanceProfile)
    private readonly profileRepository: Repository<AcceptanceProfile>,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.radiusKm = config.disposition.candidateRadiusKm;
  }

  async build(sppg: Sppg): Promise<readonly ScoreCandidate[]> {
    const facilities = await this.findFacilitiesInRadius(sppg);
    const profiles = await this.loadProfiles(facilities.map((facility) => facility.id));
    const candidates: ScoreCandidate[] = [];

    if (sppg.kapasitasOlahKg !== null) {
      candidates.push(this.buildKitchenUnit(sppg));
    }

    for (const facility of facilities) {
      const aturan = profiles.get(facility.id) ?? null;
      candidates.push(
        Object.freeze({
          facilityId: facility.id,
          nama: facility.nama,
          tier: facility.tingkat as CandidateTier,
          distanceKm: round1(
            haversineKm(
              { lat: sppg.lat, lng: sppg.lng },
              { lat: facility.lat, lng: facility.lng },
            ),
          ),
          profile: aturan === null ? DEFAULT_SAFE_PROFILE : toGateProfile(aturan),
          acceptsMinyak: aturan === null ? false : acceptsMinyakOf(aturan),
          queueKgToday: 0,
        }),
      );
    }

    return Object.freeze(candidates);
  }

  async queueByFacility(
    sppgId: string,
    range: UtcDayRange,
    excludeBatchIds: readonly string[],
  ): Promise<Map<string, number>> {
    const rows = (await this.facilityRepository.manager.query(
      `SELECT alasan_putusan->>'chosenFacilityId' AS facility_id,
              COALESCE(SUM(berat_kg), 0) AS total_kg
         FROM batch
        WHERE sppg_id = $1
          AND dikeluarkan_at >= $2
          AND dikeluarkan_at < $3
          AND tingkat_putusan = ANY($4)
          AND alasan_putusan->>'chosenFacilityId' IS NOT NULL
          AND NOT (id = ANY($5::uuid[]))
        GROUP BY 1`,
      [sppgId, range.start, range.end, QUEUE_TIERS, [...excludeBatchIds]],
    )) as { facility_id: string; total_kg: string }[];

    const queue = new Map<string, number>();
    for (const row of rows) {
      if (row.facility_id.length === 0) continue;
      queue.set(row.facility_id, Number(row.total_kg));
    }
    return queue;
  }

  private async findFacilitiesInRadius(sppg: Sppg): Promise<readonly Facility[]> {
    const deltaLat = this.radiusKm / EARTH_DEG_LAT_KM;
    const cosLat = Math.max(MIN_COS_LAT, Math.cos((sppg.lat * Math.PI) / 180));
    const deltaLng = this.radiusKm / (EARTH_DEG_LAT_KM * cosLat);

    const rows = await this.facilityRepository
      .createQueryBuilder('f')
      .where('f.aktif = true')
      .andWhere('f.lat BETWEEN :minLat AND :maxLat', {
        minLat: sppg.lat - deltaLat,
        maxLat: sppg.lat + deltaLat,
      })
      .andWhere('f.lng BETWEEN :minLng AND :maxLng', {
        minLng: sppg.lng - deltaLng,
        maxLng: sppg.lng + deltaLng,
      })
      .orderBy('f.tingkat', 'ASC')
      .addOrderBy('f.nama', 'ASC')
      .getMany();

    return rows.filter(
      (facility) =>
        haversineKm(
          { lat: sppg.lat, lng: sppg.lng },
          { lat: facility.lat, lng: facility.lng },
        ) <= this.radiusKm,
    );
  }

  private async loadProfiles(
    facilityIds: readonly string[],
  ): Promise<Map<string, Record<string, unknown>>> {
    if (facilityIds.length === 0) return new Map();
    const rows = await this.profileRepository.find({
      where: { fasilitasId: In([...facilityIds]), berlakuSampai: IsNull() },
    });
    return new Map(rows.map((row) => [row.fasilitasId, row.aturan]));
  }

  private buildKitchenUnit(sppg: Sppg): ScoreCandidate {
    return Object.freeze({
      facilityId: sppg.id,
      nama: sppg.nama,
      tier: 'T1',
      distanceKm: 0,
      profile: Object.freeze({
        ...DEFAULT_SAFE_PROFILE,
        capacityKgPerDay: sppg.kapasitasOlahKg,
      }),
      acceptsMinyak: false,
      queueKgToday: 0,
    });
  }
}