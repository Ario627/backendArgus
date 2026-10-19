import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../common/types.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import { jakartaDateOf } from '../common/utils/daily-range.util.js';
import { haversineMeters } from '../common/utils/geo.util.js';
import { generateId } from '../common/utils/id.util.js';
import { AuditService } from '../audit/audit.service.js';
import type { AppConfiguration } from '../config/configuration.js';
import { ConfigService } from '@nestjs/config';
import { Batch } from '../database/entities/batch.entity.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { RoutePlan } from '../database/entities/route-plan.entity.js';
import { RouteStop } from '../database/entities/route-stop.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { MapsClientService } from '../maps/maps-client.service.js';
import { ParameterService } from '../parameter/parameter.service.js';
import type {
  GateStatus,
  MoistureProxy,
  WasteFlow,
} from '../common/constant/domain.constant.js';
import {
  evaluateBatch,
  fitScoreOf,
  type DispatchLegInput,
  type DispatchReason,
  type DispatchVehicleInput,
} from './dispatch.util.js';

const DEFAULT_CITY_SPEED_KMH = 20;
const DEFAULT_MAX_AGE_HOURS = 24;
const BATCH_LIMIT = 100;
const STALE_PENALTY_SECONDS = 240;
const OPEN_STOP_PENALTY_SECONDS = 90;

interface WaitingBatchRow {
  readonly id: string;
  readonly sppgId: string;
  readonly sppgNama: string;
  readonly aliran: WasteFlow;
  readonly weightKg: number;
  readonly createdAt: Date;
  readonly gateStatus: GateStatus | null;
  readonly moistureProxy: MoistureProxy | null;
  readonly sppgLat: number;
  readonly sppgLng: number;
}

interface VehicleRow {
  readonly id: string;
  readonly kode: string;
  readonly kapasitasKg: number | null;
  readonly lastLat: number | null;
  readonly lastLng: number | null;
  readonly status: string;
  readonly stalenessSeconds: number | null;
}

interface LoadRow {
  readonly fleetId: string;
  readonly openStops: number;
  readonly loadKg: number;
}

export interface DispatchLegDto {
  readonly vehicleId: string;
  readonly kode: string;
  readonly etaSeconds: number;
  readonly distanceMeters: number;
  readonly congestionRatio: number | null;
  readonly capacityOk: boolean;
  readonly fitScore: number;
}

export interface DispatchBoardItemDto {
  readonly batchId: string;
  readonly sppgId: string;
  readonly sppgNama: string;
  readonly aliran: WasteFlow;
  readonly weightKg: number;
  readonly gateStatus: GateStatus | null;
  readonly createdAt: string;
  readonly ageHours: number;
  readonly late: boolean;
  readonly priority: number;
  readonly eligible: boolean;
  readonly components: {
    readonly age: number;
    readonly gate: number;
    readonly weight: number;
    readonly reach: number;
  };
  readonly reasons: readonly DispatchReason[];
  readonly recommendedVehicleId: string | null;
  readonly recommendedEtaSeconds: number | null;
  readonly congestionRatio: number | null;
  readonly legs: readonly DispatchLegDto[];
}

export interface DispatchVehicleDto {
  readonly id: string;
  readonly kode: string;
  readonly kapasitasKg: number | null;
  readonly loadKg: number;
  readonly openStops: number;
  readonly online: boolean;
  readonly stalenessSeconds: number | null;
}

export interface DispatchBoardDto {
  readonly generatedAt: string;
  readonly tanggal: string;
  readonly scopeSppgId: string | null;
  readonly matrixSource: 'mapbox' | 'haversine';
  readonly vehicles: readonly DispatchVehicleDto[];
  readonly items: readonly DispatchBoardItemDto[];
  readonly waitingCount: number;
  readonly waitingKg: number;
  readonly note: string | null;
}

export interface DispatchAssignmentDto {
  readonly batchId: string;
  readonly fleetId: string;
  readonly planId: string;
  readonly stopId: string;
  readonly urutan: number;
  readonly auto: boolean;
}

export interface AutoDispatchResult {
  readonly assigned: readonly DispatchAssignmentDto[];
  readonly skipped: readonly {
    readonly batchId: string;
    readonly reason: string;
  }[];
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly autoOnCreate: boolean;
  private readonly maxPerRun: number;

  constructor(
    configService: ConfigService,
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    @InjectRepository(Fleet)
    private readonly fleetRepository: Repository<Fleet>,
    @InjectRepository(Sppg) private readonly sppgRepository: Repository<Sppg>,
    @InjectRepository(RoutePlan)
    private readonly planRepository: Repository<RoutePlan>,
    @InjectRepository(RouteStop)
    private readonly stopRepository: Repository<RouteStop>,
    private readonly mapsClient: MapsClientService,
    private readonly parameterService: ParameterService,
    private readonly auditService: AuditService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.autoOnCreate = config.dispatch.autoOnCreate;
    this.maxPerRun = config.dispatch.maxPerRun;
  }

  private async citySpeed(): Promise<number> {
    const row = await this.parameterService.getValue('kecepatan_kota_km_jam');
    const value = row?.nilai;
    return typeof value === 'number' && value > 0
      ? value
      : DEFAULT_CITY_SPEED_KMH;
  }

  private async maxAgeHours(): Promise<number> {
    const row = await this.parameterService.getValue('penalti_umur_per_jam');
    void row;
    return DEFAULT_MAX_AGE_HOURS;
  }

  private scopeOf(
    actor: AuthenticatedUser,
    requested: string | undefined,
  ): string | null {
    if (actor.role === 'sppg_staff') {
      if (actor.sppgId === null) throw forbiddenActionError();
      if (requested !== undefined && requested !== actor.sppgId)
        throw forbiddenActionError();
      return actor.sppgId;
    }
    return requested ?? null;
  }

  private async waitingBatches(
    scopeSppgId: string | null,
  ): Promise<WaitingBatchRow[]> {
    return this.batchRepository.manager.query<WaitingBatchRow[]>(
      `SELECT b.id,
              b.sppg_id AS "sppgId",
              s.nama AS "sppgNama",
              b.aliran,
              b.berat_kg::float8 AS "weightKg",
              b.dikeluarkan_at AS "createdAt",
              b.gate_status AS "gateStatus",
              b.kadar_air_proksi AS "moistureProxy",
              s.lat AS "sppgLat",
              s.lng AS "sppgLng"
         FROM batch b
         JOIN sppg s ON s.id = b.sppg_id
        WHERE b.status IN ('MENUNGGU_ANGKUT','GAGAL_GATE')
          AND ($1::uuid IS NULL OR b.sppg_id = $1)
          AND NOT EXISTS (
            SELECT 1
              FROM route_stop rs
              JOIN route_plan rp ON rp.id = rs.plan_id
             WHERE rs.batch_id = b.id
               AND rp.status = 'AKTIF'
               AND rs.status IN ('RENCANA','SAMPAI')
          )
        ORDER BY b.dikeluarkan_at ASC
        LIMIT ${BATCH_LIMIT}`,
      [scopeSppgId],
    );
  }

  private async vehicleRows(): Promise<VehicleRow[]> {
    return this.fleetRepository.manager.query<VehicleRow[]>(
      `SELECT id,
              kode,
              kapasitas_kg::float8 AS "kapasitasKg",
              last_lat AS "lastLat",
              last_lng AS "lastLng",
              status_operasional AS "status",
              CASE WHEN last_device_timestamp IS NULL THEN NULL
                   ELSE EXTRACT(EPOCH FROM (now() - last_device_timestamp))::int
              END AS "stalenessSeconds"
         FROM fleet
        WHERE aktif = true
          AND status_operasional <> 'ONLINE_BROKEN'
        ORDER BY kode ASC`,
    );
  }

  private async loadRows(): Promise<LoadRow[]> {
    return this.stopRepository.manager.query<LoadRow[]>(
      `SELECT rs.fleet_id AS "fleetId",
              COUNT(*)::int AS "openStops",
              COALESCE(SUM(b.berat_kg), 0)::float8 AS "loadKg"
         FROM route_stop rs
         JOIN route_plan rp ON rp.id = rs.plan_id AND rp.status = 'AKTIF'
         JOIN batch b ON b.id = rs.batch_id
        WHERE rs.fleet_id IS NOT NULL
          AND rs.status IN ('RENCANA','SAMPAI')
        GROUP BY rs.fleet_id`,
    );
  }

  private toVehicleInput(
    row: VehicleRow,
    load: LoadRow | undefined,
  ): DispatchVehicleInput {
    return Object.freeze({
      id: row.id,
      kode: row.kode,
      kapasitasKg: row.kapasitasKg,
      loadKg: load?.loadKg ?? 0,
      openStops: load?.openStops ?? 0,
      lastLat: row.lastLat,
      lastLng: row.lastLng,
      stalenessSeconds: row.stalenessSeconds,
      online: row.lastLat !== null && row.lastLng !== null,
    });
  }

  async board(
    actor: AuthenticatedUser,
    requestedSppgId?: string,
  ): Promise<DispatchBoardDto> {
    const scopeSppgId = this.scopeOf(actor, requestedSppgId);
    const [batches, vehicleRows, loads, speedKmh, maxAgeHours] =
      await Promise.all([
        this.waitingBatches(scopeSppgId),
        this.vehicleRows(),
        this.loadRows(),
        this.citySpeed(),
        this.maxAgeHours(),
      ]);

    const loadByFleet = new Map(loads.map((row) => [row.fleetId, row]));
    const vehicles = vehicleRows.map((row) =>
      this.toVehicleInput(row, loadByFleet.get(row.id)),
    );
    const positioned = vehicles.filter(
      (
        vehicle,
      ): vehicle is DispatchVehicleInput & {
        lastLat: number;
        lastLng: number;
      } => vehicle.lastLat !== null && vehicle.lastLng !== null,
    );

    const sppgPoints = new Map<string, { lat: number; lng: number }>();
    for (const batch of batches) {
      sppgPoints.set(batch.sppgId, { lat: batch.sppgLat, lng: batch.sppgLng });
    }
    const sppgList = [...sppgPoints.entries()];

    let durations: number[][] | null = null;
    let distances: number[][] | null = null;
    let matrixSource: 'mapbox' | 'haversine' = 'haversine';
    if (
      positioned.length > 0 &&
      sppgList.length > 0 &&
      positioned.length + sppgList.length <= 10
    ) {
      const points = [
        ...positioned.map((vehicle) => ({
          lat: vehicle.lastLat,
          lng: vehicle.lastLng,
        })),
        ...sppgList.map(([, point]) => point),
      ];
      const matrix = await this.mapsClient.buildMatrix(points, speedKmh);
      matrixSource = matrix.source;
      durations = matrix.durationsSeconds.map((row) => [...row]);
      distances = matrix.distancesMeters.map((row) => [...row]);
    }

    const idealSecondsOf = (meters: number): number =>
      meters <= 0 ? 0 : Math.round(meters / ((speedKmh * 1000) / 3600));

    const items: DispatchBoardItemDto[] = [];
    for (const batch of batches) {
      const sppgIndex = sppgList.findIndex(([id]) => id === batch.sppgId);
      const legs: DispatchLegDto[] = [];
      const legInputs: DispatchLegInput[] = [];

      for (let index = 0; index < positioned.length; index += 1) {
        const vehicle = positioned[index];
        if (vehicle === undefined) continue;
        let etaSeconds: number;
        let distanceMeters: number;
        if (durations !== null && distances !== null && sppgIndex >= 0) {
          etaSeconds = Math.round(
            durations[index]?.[positioned.length + sppgIndex] ?? 0,
          );
          distanceMeters = Math.round(
            distances[index]?.[positioned.length + sppgIndex] ?? 0,
          );
        } else {
          distanceMeters = Math.round(
            haversineMeters(
              { lat: vehicle.lastLat, lng: vehicle.lastLng },
              { lat: batch.sppgLat, lng: batch.sppgLng },
            ),
          );
          etaSeconds = idealSecondsOf(distanceMeters);
        }
        const ideal = idealSecondsOf(distanceMeters);
        legInputs.push({
          vehicleId: vehicle.id,
          etaSeconds,
          distanceMeters,
          idealSeconds: ideal,
        });
        legs.push({
          vehicleId: vehicle.id,
          kode: vehicle.kode,
          etaSeconds,
          distanceMeters,
          congestionRatio:
            ideal <= 0 ? null : Math.round((etaSeconds / ideal) * 100) / 100,
          capacityOk: fitScoreOf(vehicle, batch.weightKg) > 0,
          fitScore: Math.round(fitScoreOf(vehicle, batch.weightKg)),
        });
      }

      const evaluation = evaluateBatch(
        {
          id: batch.id,
          sppgId: batch.sppgId,
          sppgNama: batch.sppgNama,
          aliran: batch.aliran,
          weightKg: batch.weightKg,
          createdMs: new Date(batch.createdAt).getTime(),
          gateStatus: batch.gateStatus,
          moistureProxy: batch.moistureProxy,
        },
        vehicles,
        legInputs,
        {
          nowMs: Date.now(),
          maxAgeHours,
          stalePenaltySeconds: STALE_PENALTY_SECONDS,
          openStopPenaltySeconds: OPEN_STOP_PENALTY_SECONDS,
        },
      );

      items.push({
        batchId: batch.id,
        sppgId: batch.sppgId,
        sppgNama: batch.sppgNama,
        aliran: batch.aliran,
        weightKg: batch.weightKg,
        gateStatus: batch.gateStatus,
        createdAt: new Date(batch.createdAt).toISOString(),
        ageHours: evaluation.ageHours,
        late: evaluation.late,
        priority: evaluation.priority,
        eligible: evaluation.eligible,
        components: evaluation.components,
        reasons: evaluation.reasons,
        recommendedVehicleId: evaluation.recommendedVehicleId,
        recommendedEtaSeconds: evaluation.recommendedEtaSeconds,
        congestionRatio: evaluation.congestionRatio,
        legs: Object.freeze(
          legs.sort((left, right) => left.etaSeconds - right.etaSeconds),
        ),
      });
    }

    items.sort((left, right) => {
      if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
      if (right.priority !== left.priority)
        return right.priority - left.priority;
      return right.ageHours - left.ageHours;
    });

    const waitingKg = items.reduce((total, item) => total + item.weightKg, 0);

    return Object.freeze({
      generatedAt: new Date().toISOString(),
      tanggal: jakartaDateOf(new Date()),
      scopeSppgId,
      matrixSource,
      vehicles: Object.freeze(
        vehicles.map((vehicle) => ({
          id: vehicle.id,
          kode: vehicle.kode,
          kapasitasKg: vehicle.kapasitasKg,
          loadKg: vehicle.loadKg,
          openStops: vehicle.openStops,
          online: vehicle.online,
          stalenessSeconds: vehicle.stalenessSeconds,
        })),
      ),
      items: Object.freeze(items),
      waitingCount: items.length,
      waitingKg: Math.round(waitingKg * 100) / 100,
      note:
        positioned.length === 0
          ? 'Belum ada armada dengan posisi terakhir. Penugasan memakai urutan prioritas saja.'
          : null,
    });
  }

  private async ensurePlan(
    sppgId: string,
    actor: AuthenticatedUser | null,
  ): Promise<string> {
    const tanggal = jakartaDateOf(new Date());
    const existing = await this.planRepository.manager.query<{ id: string }[]>(
      `SELECT id FROM route_plan
        WHERE sppg_id = $1 AND tanggal = $2 AND status = 'AKTIF'
        ORDER BY created_at DESC
        LIMIT 1`,
      [sppgId, tanggal],
    );
    const planId = existing[0]?.id;
    if (planId !== undefined) return planId;

    const createdId = generateId();
    await this.planRepository.manager.query(
      `INSERT INTO route_plan
         (id, tanggal, status, sppg_id, source, matrix_source, total_kg, total_km, ringkasan, dibuat_oleh, is_demo)
       VALUES ($1, $2, 'AKTIF', $3, 'manual', 'haversine', 0, NULL, NULL, $4, false)`,
      [createdId, tanggal, sppgId, actor?.id ?? null],
    );
    return createdId;
  }

  async assign(
    batchId: string,
    fleetId: string,
    actor: AuthenticatedUser,
    auto = false,
  ): Promise<DispatchAssignmentDto> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });
    if (batch === null) {
      throw new NotFoundException({
        code: 'BATCH_NOT_FOUND',
        message: 'Batch tidak ditemukan',
      });
    }
    if (actor.role === 'sppg_staff' && actor.sppgId !== batch.sppgId) {
      throw forbiddenActionError();
    }
    if (batch.gateStatus === 'TOLAK') {
      throw new UnprocessableEntityException({
        code: 'DISPATCH_BATCH_DITOLAK',
        message:
          'Batch ditolak gerbang; tidak boleh diangkut ke fasilitas penerima',
      });
    }
    if (batch.status !== 'MENUNGGU_ANGKUT' && batch.status !== 'GAGAL_GATE') {
      throw new ConflictException({
        code: 'DISPATCH_BATCH_NOT_WAITING',
        message: 'Batch ini tidak sedang menunggu pengangkutan',
      });
    }

    const existingStop = await this.stopRepository.manager.query<
      { id: string }[]
    >(
      `SELECT rs.id
         FROM route_stop rs
         JOIN route_plan rp ON rp.id = rs.plan_id
        WHERE rs.batch_id = $1
          AND rp.status = 'AKTIF'
          AND rs.status IN ('RENCANA','SAMPAI')
        LIMIT 1`,
      [batchId],
    );
    if (existingStop.length > 0) {
      throw new ConflictException({
        code: 'DISPATCH_ALREADY_ASSIGNED',
        message: 'Batch ini sudah ada di rute aktif',
      });
    }

    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId },
    });
    if (fleet === null || !fleet.aktif) {
      throw new NotFoundException({
        code: 'FLEET_NOT_FOUND',
        message: 'Armada tidak ditemukan atau nonaktif',
      });
    }
    if (fleet.statusOperasional === 'ONLINE_BROKEN') {
      throw new ConflictException({
        code: 'DISPATCH_FLEET_BROKEN',
        message: 'Armada melaporkan rusak; pilih armada lain',
      });
    }

    const [load] = await this.stopRepository.manager.query<
      { loadKg: number; openStops: number }[]
    >(
      `SELECT COALESCE(SUM(b.berat_kg), 0)::float8 AS "loadKg", COUNT(*)::int AS "openStops"
         FROM route_stop rs
         JOIN route_plan rp ON rp.id = rs.plan_id AND rp.status = 'AKTIF'
         JOIN batch b ON b.id = rs.batch_id
        WHERE rs.fleet_id = $1 AND rs.status IN ('RENCANA','SAMPAI')`,
      [fleetId],
    );
    if (
      fleet.kapasitasKg !== null &&
      fleet.kapasitasKg > 0 &&
      (load?.loadKg ?? 0) + batch.beratKg > fleet.kapasitasKg + 0.001
    ) {
      throw new ConflictException({
        code: 'DISPATCH_CAPACITY_FULL',
        message: `Kapasitas ${fleet.kode} tidak cukup untuk muatan ini`,
      });
    }

    const planId = await this.ensurePlan(batch.sppgId, actor);
    const [maxRow] = await this.stopRepository.manager.query<
      { next: number }[]
    >(
      `SELECT COALESCE(MAX(urutan) + 1, 0)::int AS next FROM route_stop WHERE plan_id = $1`,
      [planId],
    );
    const urutan = maxRow?.next ?? 0;
    const stopId = generateId();

    await this.stopRepository.manager.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO route_stop (id, plan_id, batch_id, fleet_id, urutan, jenis, fasilitas_id, status)
         VALUES ($1, $2, $3, $4, $5, 'AMBIL', NULL, 'RENCANA')`,
        [stopId, planId, batchId, fleetId, urutan],
      );
      await manager.query(
        `UPDATE route_plan
            SET total_kg = total_kg + $2
          WHERE id = $1`,
        [planId, batch.beratKg],
      );
    });

    await this.auditService.record({
      aktor: actor.id,
      aktorPeran: actor.role,
      aksi: auto ? 'dispatch.auto_assign' : 'dispatch.assign',
      entitas: 'batch',
      entitasId: batchId,
      detail: {
        fleetId,
        planId,
        stopId,
        urutan,
        weightKg: batch.beratKg,
        auto,
      },
      requestId: null,
    });

    return Object.freeze({ batchId, fleetId, planId, stopId, urutan, auto });
  }

  async autoAssign(
    actor: AuthenticatedUser,
    requestedSppgId?: string,
    limit = this.maxPerRun,
  ): Promise<AutoDispatchResult> {
    const board = await this.board(actor, requestedSppgId);
    const remaining = new Map<string, number>();
    const capacityOf = new Map(
      board.vehicles.map((vehicle) => [
        vehicle.id,
        vehicle.kapasitasKg === null
          ? Number.POSITIVE_INFINITY
          : vehicle.kapasitasKg,
      ]),
    );
    for (const vehicle of board.vehicles) {
      remaining.set(
        vehicle.id,
        (capacityOf.get(vehicle.id) ?? 0) - vehicle.loadKg,
      );
    }

    const assigned: DispatchAssignmentDto[] = [];
    const skipped: { batchId: string; reason: string }[] = [];

    for (const item of board.items) {
      if (assigned.length >= limit) break;
      if (!item.eligible) {
        skipped.push({ batchId: item.batchId, reason: 'DITOLAK_GERBANG' });
        continue;
      }
      const candidates = item.legs
        .filter((leg) => {
          const free = remaining.get(leg.vehicleId) ?? 0;
          return free >= item.weightKg - 0.001;
        })
        .sort((left, right) => left.etaSeconds - right.etaSeconds);
      const chosen = candidates[0];
      if (chosen === undefined) {
        skipped.push({ batchId: item.batchId, reason: 'TANPA_KAPASITAS' });
        continue;
      }
      try {
        const result = await this.assign(
          item.batchId,
          chosen.vehicleId,
          actor,
          true,
        );
        assigned.push(result);
        remaining.set(
          chosen.vehicleId,
          (remaining.get(chosen.vehicleId) ?? 0) - item.weightKg,
        );
      } catch (error) {
        skipped.push({
          batchId: item.batchId,
          reason: error instanceof Error ? error.name : 'GAGAL',
        });
      }
    }

    this.logger.log(
      `dispatch otomatis: ${assigned.length} ditugaskan, ${skipped.length} dilewati, cakupan=${requestedSppgId ?? 'semua'}`,
    );
    return Object.freeze({
      assigned: Object.freeze(assigned),
      skipped: Object.freeze(skipped),
    });
  }

  async autoAssignOnCreate(
    actor: AuthenticatedUser,
    sppgId: string,
  ): Promise<void> {
    if (!this.autoOnCreate) return;
    try {
      const board = await this.board(actor, sppgId);
      if (board.items.length === 0) return;
      await this.autoAssign(actor, sppgId);
    } catch (error) {
      this.logger.warn(
        `dispatch otomatis gagal untuk sppg=${sppgId} (${error instanceof Error ? error.message : 'UNKNOWN'})`,
      );
    }
  }
}
