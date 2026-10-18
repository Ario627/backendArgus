import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import type { MatrixSource } from '../common/constant/domain.constant.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { DEFAULT_PAGE_SIZE } from '../common/dto/list-query.dto.js';
import { generateId } from '../common/utils/id.util.js';
import { jakartaDateOf } from '../common/utils/daily-range.util.js';
import type { GeoCoordinate } from '../common/utils/geo.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { RoutePlan } from '../database/entities/route-plan.entity.js';
import { RouteStop } from '../database/entities/route-stop.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { sppgNotFoundError } from '../sppg/sppg.errors.js';
import { MapsClientService } from '../maps/maps-client.service.js';
import { ParameterService } from '../parameter/parameter.service.js';
import type {
  OptimizerPreviousRoute,
  OptimizerStop,
  OptimizerVehicle,
} from './optimizer.contract.js';
import { OptimizerClient } from './optimizer.client.js';
import { buildOptimizerRequest } from './optimizer-request.util.js';
import {
  groupPreviousRoutes,
  type PreviousStopRow,
} from './previous-routes.util.js';
import { windowSeconds } from './route-window.util.js';
import {
  resolveCostModel,
  type OptimizerCostModel,
} from './optimizer-cost.util.js';
import { countHonoredLocks, planGreedy } from './greedy.util.js';
import { OpsNotifierService } from '../ops/ops-notifier.service.js';
import {
  routeNoBatchesError,
  routePlanActiveError,
  routePlanNotReplanableError,
  routePlanNotFoundError,
  routeStopClosedError,
  routeStopNotFoundError,
  routeStopTransitionError,
} from './routing.errors.js';
import {
  toRoutePlanDetailDto,
  toRoutePlanDto,
  toRouteStopDto,
  type RoutePlanDetailDto,
  type RoutePlanDto,
  type RouteStopDto,
} from './routing.mapper.js';
import type { ConfirmStopDto } from './dto/confirm-stop.dto.js';
import type { PlanRouteDto } from './dto/plan-route.dto.js';
import type { RouteListQueryDto } from './dto/route-list-query.dto.js';
import type {
  RoutePlanSummary,
  RouteSolverStats,
  RouteUnassignedEntry,
} from './route-summary.types.js';

const WIB_OFFSET = '+07:00';
const SERVICE_SECONDS_PER_STOP = 600;
const MAX_ELIGIBLE_BATCHES = 200;

const ELIGIBLE_BATCHES_SQL = `
SELECT b.id AS "batchId",
       b.berat_kg AS "beratKg",
       b.dikeluarkan_at AS "dikeluarkanAt",
       f.id AS "fasilitasId",
       f.lat AS "fasilitasLat",
       f.lng AS "fasilitasLng",
       p.aturan ->> 'maxAgeHours' AS "maxAgeHours"
  FROM batch b
  JOIN fasilitas f
    ON f.id = CASE
         WHEN b.alasan_putusan ->> 'chosenFacilityId'
              ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         THEN (b.alasan_putusan ->> 'chosenFacilityId')::uuid
       END
  LEFT JOIN LATERAL (
    SELECT pp.aturan
      FROM profil_penerimaan pp
     WHERE pp.fasilitas_id = f.id
       AND pp.berlaku_sampai IS NULL
     ORDER BY pp.versi DESC
     LIMIT 1
  ) p ON TRUE
 WHERE b.sppg_id = $1
   AND b.status = 'MENUNGGU_ANGKUT'
   AND b.tingkat_putusan IN ('T2', 'T3')
 ORDER BY b.dikeluarkan_at ASC, b.id ASC
 LIMIT ${MAX_ELIGIBLE_BATCHES}`;

const WITHOUT_FACILITY_SQL = `
SELECT b.id AS "batchId"
  FROM batch b
 WHERE b.sppg_id = $1
   AND b.status = 'MENUNGGU_ANGKUT'
   AND b.tingkat_putusan IN ('T2', 'T3')
   AND NOT (b.alasan_putusan ->> 'chosenFacilityId'
            ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
 ORDER BY b.dikeluarkan_at ASC, b.id ASC
 LIMIT ${MAX_ELIGIBLE_BATCHES}`;

const FLEET_SQL = `
SELECT id,
       kode,
       kapasitas_kg AS "kapasitasKg",
       last_lat AS "lastLat",
       last_lng AS "lastLng"
  FROM fleet
 WHERE aktif = TRUE
   AND status_operasional <> 'ONLINE_BROKEN'
 ORDER BY kode ASC`;

const ACTIVE_PLAN_SQL = `
SELECT id
  FROM route_plan
 WHERE sppg_id = $1
   AND tanggal = $2
   AND status = 'AKTIF'
 LIMIT 1`;

const CANCEL_PLAN_SQL = `
WITH cancelled AS (
  UPDATE route_plan
     SET status = 'BATAL'
   WHERE id = $1
     AND status IN ('AKTIF', 'NEEDS_MANUAL_SCHEDULING', 'DRAFT')
  RETURNING id
)
SELECT id FROM cancelled`;

const CLOSE_STOPS_SQL = `
SELECT count(*)::int AS "openStops"
  FROM route_stop
 WHERE plan_id = $1
   AND status IN ('RENCANA', 'SAMPAI')`;

const BROKEN_PLAN_SQL = `
SELECT rp.id AS "planId"
  FROM route_plan rp
  JOIN route_stop rs ON rs.plan_id = rp.id
  JOIN fleet f ON f.id = rs.fleet_id
 WHERE rp.status = 'AKTIF'
   AND rs.status = 'RENCANA'
   AND f.status_operasional = 'ONLINE_BROKEN'
 GROUP BY rp.id
 LIMIT 20`;

const PREVIOUS_STOPS_SQL = `
SELECT rs.fleet_id AS "fleetId",
       rs.batch_id AS "batchId"
  FROM route_stop rs
 WHERE rs.plan_id = $1
   AND rs.fleet_id IS NOT NULL
 ORDER BY rs.fleet_id ASC, rs.urutan ASC`;

interface EligibleBatchRow {
  readonly batchId: string;
  readonly beratKg: string;
  readonly dikeluarkanAt: Date;
  readonly fasilitasId: string;
  readonly fasilitasLat: number;
  readonly fasilitasLng: number;
  readonly maxAgeHours: string | null;
}

interface WithoutFacilityRow {
  readonly batchId: string;
}

interface FleetRow {
  readonly id: string;
  readonly kode: string;
  readonly kapasitasKg: string | null;
  readonly lastLat: number | null;
  readonly lastLng: number | null;
}

interface IdRow {
  readonly id: string;
}

interface OpenStopsRow {
  readonly openStops: number;
}

interface BuildPlanInput {
  readonly sppgId: string;
  readonly date: string;
  readonly actorId: string | null;
  readonly allowGreedy: boolean;
  readonly reason: string | null;
  readonly previousPlanId: string | null;
}

export interface PlanRouteResult {
  readonly plan: RoutePlanDetailDto;
  readonly degraded: boolean;
}

interface PersistStopInput {
  readonly batchId: string;
  readonly fleetId: string | null;
  readonly fasilitasId: string | null;
}

interface PersistOptions {
  readonly status: 'AKTIF' | 'NEEDS_MANUAL_SCHEDULING';
  readonly source: 'optimizer' | 'greedy' | 'manual';
  readonly matrixSource: MatrixSource;
  readonly totalKg: number;
  readonly totalKm: number | null;
  readonly unassigned: readonly RouteUnassignedEntry[];
  readonly skippedVehicles: readonly string[];
  readonly vehicles: readonly OptimizerVehicle[];
  readonly solverStats: RouteSolverStats | null;
  readonly speedSource: string;
  readonly costSource: string;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly windowStart: string;
  private readonly windowEnd: string;
  private readonly maxRouteSeconds: number | null;
  private readonly timeLimitSeconds: number;
  private readonly fallbackSpeedKmh: number;
  private readonly recoveryTimeoutMs: number;

  constructor(
    configService: ConfigService,
    @InjectRepository(RoutePlan)
    private readonly planRepository: Repository<RoutePlan>,
    @InjectRepository(RouteStop)
    private readonly stopRepository: Repository<RouteStop>,
    private readonly mapsClient: MapsClientService,
    private readonly optimizerClient: OptimizerClient,
    private readonly parameterService: ParameterService,
    private readonly opsNotifier: OpsNotifierService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.windowStart = config.route.windowStart;
    this.windowEnd = config.route.windowEnd;
    this.maxRouteSeconds = windowSeconds(
      config.route.windowStart,
      config.route.windowEnd,
    );
    this.timeLimitSeconds = config.route.timeLimitSeconds;
    this.fallbackSpeedKmh = config.route.fallbackSpeedKmh;
    this.recoveryTimeoutMs = config.optimizer.recoveryTimeoutMs;
  }

  private windowStartIso(date: string): string {
    return `${date}T${this.windowStart}:00${WIB_OFFSET}`;
  }

  private windowEndIso(date: string): string {
    return `${date}T${this.windowEnd}:00${WIB_OFFSET}`;
  }

  private async resolveSpeed(): Promise<{
    speedKmh: number;
    source: string;
  }> {
    const reading = await this.parameterService.getValue(
      'kecepatan_kota_km_jam',
    );
    if (reading !== null && reading.nilai !== null && reading.nilai > 0) {
      return { speedKmh: reading.nilai, source: `parameter:${reading.sumber}` };
    }
    return { speedKmh: this.fallbackSpeedKmh, source: 'fallback_env' };
  }

  private async resolveCostModel(
    speedKmh: number,
  ): Promise<OptimizerCostModel> {
    const readings = await this.parameterService.getMany([
      'biaya_per_km',
      'penalti_umur_per_jam',
    ]);
    return resolveCostModel(
      readings.get('biaya_per_km') ?? null,
      readings.get('penalti_umur_per_jam') ?? null,
      speedKmh,
    );
  }

  private stopIndexMapOf(
    batches: readonly EligibleBatchRow[],
  ): ReadonlyMap<string, number> {
    const index = new Map<string, number>();
    batches.forEach((batch, position) => {
      index.set(batch.batchId, position + 1);
    });
    return index;
  }

  private networkKm(
    sequences: readonly (readonly string[])[],
    batchIndex: ReadonlyMap<string, number>,
    distancesMeters: readonly (readonly number[])[],
  ): number {
    let meters = 0;
    for (const sequence of sequences) {
      let previous = 0;
      for (const batchId of sequence) {
        const nodeIndex = batchIndex.get(batchId);
        if (nodeIndex === undefined) continue;
        meters += distancesMeters[previous]?.[nodeIndex] ?? 0;
        previous = nodeIndex;
      }
    }
    return Math.round(meters / 10) / 100;
  }

  private async loadPreviousRoutes(
    manager: EntityManager,
    planId: string,
  ): Promise<readonly OptimizerPreviousRoute[]> {
    const rows = await manager.query<PreviousStopRow[]>(PREVIOUS_STOPS_SQL, [
      planId,
    ]);
    return groupPreviousRoutes(rows);
  }

  private async loadEligible(
    manager: EntityManager,
    sppgId: string,
  ): Promise<{
    batches: readonly EligibleBatchRow[];
    tanpaFasilitas: readonly string[];
  }> {
    const batches = await manager.query<EligibleBatchRow[]>(
      ELIGIBLE_BATCHES_SQL,
      [sppgId],
    );
    const tanpaFasilitas = await manager.query<WithoutFacilityRow[]>(
      WITHOUT_FACILITY_SQL,
      [sppgId],
    );
    return {
      batches,
      tanpaFasilitas: tanpaFasilitas.map((row) => row.batchId),
    };
  }

  private buildVehicles(
    fleets: readonly FleetRow[],
    sppgPoint: GeoCoordinate,
    startIso: string,
  ): { vehicles: readonly OptimizerVehicle[]; skipped: readonly string[] } {
    const vehicles: OptimizerVehicle[] = [];
    const skipped: string[] = [];
    for (const fleet of fleets) {
      const capacityKg =
        fleet.kapasitasKg === null ? null : Number(fleet.kapasitasKg);
      if (
        capacityKg === null ||
        !Number.isFinite(capacityKg) ||
        capacityKg <= 0
      ) {
        skipped.push(fleet.id);
        continue;
      }
      vehicles.push({
        fleetId: fleet.id,
        capacityKg,
        startLat: fleet.lastLat ?? sppgPoint.lat,
        startLng: fleet.lastLng ?? sppgPoint.lng,
        startTime: startIso,
      });
    }
    return { vehicles, skipped };
  }

  private buildStops(
    batches: readonly EligibleBatchRow[],
    readyAtIso: string,
  ): readonly OptimizerStop[] {
    return batches.map((batch) => {
      const maxAgeHours =
        batch.maxAgeHours === null ? null : Number(batch.maxAgeHours);
      const deadline =
        maxAgeHours === null || !Number.isFinite(maxAgeHours)
          ? null
          : new Date(
              batch.dikeluarkanAt.getTime() + maxAgeHours * 3600000,
            ).toISOString();
      return {
        batchId: batch.batchId,
        lat: batch.fasilitasLat,
        lng: batch.fasilitasLng,
        kg: Number(batch.beratKg),
        readyAt: readyAtIso,
        deadline,
        targetFacilityId: batch.fasilitasId,
      };
    });
  }

  private async persistPlan(
    input: BuildPlanInput,
    tanpaFasilitas: readonly string[],
    stopsToPersist: readonly PersistStopInput[],
    options: PersistOptions,
  ): Promise<RoutePlanDetailDto> {
    const sppg = await this.planRepository.manager.findOne(Sppg, {
      where: { id: input.sppgId },
    });
    const isDemo = sppg?.isDemo ?? false;
    const planId = generateId();
    const ringkasan: RoutePlanSummary = Object.freeze({
      window: Object.freeze({
        start: this.windowStartIso(input.date),
        end: this.windowEndIso(input.date),
      }),
      speedSource: options.speedSource,
      costSource: options.costSource,
      unassigned: Object.freeze([...options.unassigned]),
      tanpaFasilitas: Object.freeze([...tanpaFasilitas]),
      skippedVehicles: Object.freeze([...options.skippedVehicles]),
      vehicles: Object.freeze(
        options.vehicles.map((vehicle) =>
          Object.freeze({
            fleetId: vehicle.fleetId,
            capacityKg: vehicle.capacityKg,
          }),
        ),
      ),
      solverStats: options.solverStats,
      reason: input.reason,
    });

    await this.planRepository.manager.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO route_plan
           (id, tanggal, status, sppg_id, source, matrix_source, total_kg, total_km, ringkasan, dibuat_oleh, is_demo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
        [
          planId,
          input.date,
          options.status,
          input.sppgId,
          options.source,
          options.matrixSource,
          options.totalKg,
          options.totalKm,
          JSON.stringify(ringkasan),
          input.actorId,
          isDemo,
        ],
      );
      let urutan = 0;
      for (const stop of stopsToPersist) {
        await manager.query(
          `INSERT INTO route_stop
             (id, plan_id, batch_id, fleet_id, urutan, jenis, fasilitas_id)
           VALUES ($1, $2, $3, $4, $5, 'ANTAR', $6)`,
          [
            generateId(),
            planId,
            stop.batchId,
            stop.fleetId,
            urutan,
            stop.fasilitasId,
          ],
        );
        urutan += 1;
      }
    });

    this.logger.log(
      `rencana rute ${planId} sppg=${input.sppgId} status=${options.status} stops=${stopsToPersist.length} unassigned=${options.unassigned.length}`,
    );
    const plan = await this.planRepository.findOneOrFail({
      where: { id: planId },
    });
    const stops = await this.stopRepository.find({
      where: { planId },
      order: { urutan: 'ASC' },
    });
    return toRoutePlanDetailDto(plan, stops);
  }

  private async buildPlan(input: BuildPlanInput): Promise<PlanRouteResult> {
    const manager = this.planRepository.manager;
    const sppg = await manager.findOne(Sppg, { where: { id: input.sppgId } });
    if (sppg === null) throw sppgNotFoundError();

    if (input.reason === null) {
      const active = await manager.query<IdRow[]>(ACTIVE_PLAN_SQL, [
        input.sppgId,
        input.date,
      ]);
      if (active.length > 0) throw routePlanActiveError();
    }

    const { batches, tanpaFasilitas } = await this.loadEligible(
      manager,
      input.sppgId,
    );
    if (batches.length === 0 && tanpaFasilitas.length === 0) {
      throw routeNoBatchesError();
    }

    const fleets = await manager.query<FleetRow[]>(FLEET_SQL);
    const sppgPoint: GeoCoordinate = { lat: sppg.lat, lng: sppg.lng };
    const readyAtIso = this.windowStartIso(input.date);
    const { speedKmh, source: speedSource } = await this.resolveSpeed();
    const cost = await this.resolveCostModel(speedKmh);
    const previousRoutes =
      input.previousPlanId === null
        ? null
        : await this.loadPreviousRoutes(manager, input.previousPlanId);
    const { vehicles, skipped } = this.buildVehicles(
      fleets,
      sppgPoint,
      readyAtIso,
    );
    const stops = this.buildStops(batches, readyAtIso);

    const facilityByBatch = new Map(
      batches.map((batch) => [batch.batchId, batch.fasilitasId] as const),
    );
    const batchIndex = this.stopIndexMapOf(batches);

    const points: GeoCoordinate[] = [
      sppgPoint,
      ...batches.map((batch) => ({
        lat: batch.fasilitasLat,
        lng: batch.fasilitasLng,
      })),
    ];
    const matrix = await this.mapsClient.buildMatrix(points, speedKmh);

    const manualEntries: RouteUnassignedEntry[] = tanpaFasilitas.map(
      (batchId) => Object.freeze({ batchId, reason: 'TANPA_FASILITAS' }),
    );

    const persistManual = async (
      reason: string,
      unassigned: readonly RouteUnassignedEntry[],
    ): Promise<PlanRouteResult> => {
      const manual: PersistStopInput[] = [
        ...batches.map((batch) => ({
          batchId: batch.batchId,
          fleetId: null,
          fasilitasId: batch.fasilitasId,
        })),
        ...tanpaFasilitas.map((batchId) => ({
          batchId,
          fleetId: null,
          fasilitasId: null,
        })),
      ];
      const totalKg = batches.reduce(
        (sum, batch) => sum + Number(batch.beratKg),
        0,
      );
      const plan = await this.persistPlan(input, tanpaFasilitas, manual, {
        status: 'NEEDS_MANUAL_SCHEDULING',
        source: 'manual',
        matrixSource: matrix.source,
        totalKg: Math.round(totalKg * 100) / 100,
        totalKm: null,
        unassigned,
        skippedVehicles: skipped,
        vehicles,
        solverStats: null,
        speedSource,
        costSource: cost.source,
      });
      this.logger.warn(
        `rencana manual ${plan.id} alasan=${reason} batch=${manual.length}`,
      );
      void this.opsNotifier.notifyThrottled(`route:${input.sppgId}`, {
        type: 'optimizer_degraded',
        severity: reason === 'TANPA_ARMADA' ? 'WARNING' : 'CRITICAL',
        message: `rute ${input.date} disusun manual (${reason}) untuk SPPG ${input.sppgId}`,
        detail: {
          sppgId: input.sppgId,
          date: input.date,
          reason,
          planId: plan.id,
          batchCount: manual.length,
        },
      });
      return { plan, degraded: true };
    };

    if (vehicles.length === 0) {
      return persistManual('TANPA_ARMADA', [
        ...manualEntries,
        ...batches.map((batch) =>
          Object.freeze({ batchId: batch.batchId, reason: 'TANPA_ARMADA' }),
        ),
      ]);
    }

    const requestStopByBatch = new Map(
      stops.map((stop) => [stop.batchId, stop] as const),
    );
    const optimizerResponse = await this.optimizerClient.solve(
      buildOptimizerRequest({
        date: input.date,
        depotId: input.sppgId,
        readyAtIso,
        timeLimitSeconds: this.timeLimitSeconds,
        travelCostPerSecond: cost.travelCostPerSecond,
        latePenaltyPerKgMinute: cost.latePenaltyPerKgMinute,
        maxRouteSeconds: this.maxRouteSeconds,
        previousRoutes,
        vehicles,
        stops,
        matrixSeconds: matrix.durationsSeconds,
      }),
      input.reason === null ? undefined : this.recoveryTimeoutMs,
    );

    if (
      optimizerResponse !== null &&
      optimizerResponse.status !== 'NO_SOLUTION'
    ) {
      const fleetIds = new Set(vehicles.map((vehicle) => vehicle.fleetId));
      const assignedBatchIds = new Set<string>();
      const stopsToPersist: PersistStopInput[] = [];
      const sequences: string[][] = [];
      for (const route of optimizerResponse.routes) {
        if (!fleetIds.has(route.fleetId)) {
          this.logger.warn(
            `rute optimizer memuat fleet tak dikenal=${route.fleetId}, dilewati`,
          );
          continue;
        }
        const sequence: string[] = [];
        for (const batchId of route.sequence) {
          if (!batchIndex.has(batchId) || assignedBatchIds.has(batchId)) {
            continue;
          }
          assignedBatchIds.add(batchId);
          sequence.push(batchId);
          stopsToPersist.push({
            batchId,
            fleetId: route.fleetId,
            fasilitasId: facilityByBatch.get(batchId) ?? null,
          });
        }
        if (sequence.length > 0) sequences.push(sequence);
      }

      const unassigned: RouteUnassignedEntry[] = [...manualEntries];
      for (const entry of optimizerResponse.unassigned) {
        if (
          batchIndex.has(entry.batchId) &&
          !assignedBatchIds.has(entry.batchId)
        ) {
          assignedBatchIds.add(entry.batchId);
          unassigned.push(
            Object.freeze({ batchId: entry.batchId, reason: entry.reason }),
          );
        }
      }
      for (const batch of batches) {
        if (!assignedBatchIds.has(batch.batchId)) {
          unassigned.push(
            Object.freeze({ batchId: batch.batchId, reason: 'SISA' }),
          );
        }
      }
      for (const entry of unassigned) {
        if (entry.reason === 'TANPA_FASILITAS') continue;
        stopsToPersist.push({
          batchId: entry.batchId,
          fleetId: null,
          fasilitasId: facilityByBatch.get(entry.batchId) ?? null,
        });
      }

      const totalKg = batches.reduce(
        (sum, batch) => sum + Number(batch.beratKg),
        0,
      );
      const plan = await this.persistPlan(
        input,
        tanpaFasilitas,
        stopsToPersist,
        {
          status: 'AKTIF',
          source: 'optimizer',
          matrixSource: matrix.source,
          totalKg: Math.round(totalKg * 100) / 100,
          totalKm: this.networkKm(
            sequences,
            batchIndex,
            matrix.distancesMeters,
          ),
          unassigned,
          skippedVehicles: skipped,
          vehicles,
          solverStats: optimizerResponse.solverStats,
          speedSource,
          costSource: cost.source,
        },
      );
      return { plan, degraded: false };
    }

    if (!input.allowGreedy) {
      return persistManual(
        optimizerResponse === null
          ? 'OPTIMIZER_TIDAK_TERSEDIA'
          : 'TANPA_SOLUSI',
        [
          ...manualEntries,
          ...batches.map((batch) =>
            Object.freeze({
              batchId: batch.batchId,
              reason:
                optimizerResponse === null
                  ? 'OPTIMIZER_TIDAK_TERSEDIA'
                  : 'TANPA_SOLUSI',
            }),
          ),
        ],
      );
    }

    const locks =
      previousRoutes?.map((route) =>
        Object.freeze({
          fleetId: route.fleetId,
          sequence: route.sequence,
        }),
      ) ?? [];

    const greedy = planGreedy({
      stops: batches.map((batch, position) => {
        const stop = requestStopByBatch.get(batch.batchId);
        return {
          batchId: batch.batchId,
          kg: Number(batch.beratKg),
          readyMs: stop === undefined ? null : Date.parse(stop.readyAt),
          deadlineMs:
            stop?.deadline === null || stop?.deadline === undefined
              ? null
              : Date.parse(stop.deadline),
          nodeIndex: position + 1,
        };
      }),
      vehicles: vehicles.map((vehicle) => ({
        fleetId: vehicle.fleetId,
        capacityKg: vehicle.capacityKg,
      })),
      durationsSeconds: matrix.durationsSeconds,
      serviceSecondsPerStop: SERVICE_SECONDS_PER_STOP,
      startEpochMs: Date.parse(readyAtIso),
      maxSeconds: this.maxRouteSeconds,
      locks,
    });

    const assignedGreedy = new Set<string>();
    const stopsToPersist: PersistStopInput[] = [];
    const sequences: string[][] = [];
    for (const assignment of greedy.assignments) {
      const sequence: string[] = [];
      for (const batchId of assignment.sequence) {
        assignedGreedy.add(batchId);
        sequence.push(batchId);
        stopsToPersist.push({
          batchId,
          fleetId: assignment.fleetId,
          fasilitasId: facilityByBatch.get(batchId) ?? null,
        });
      }
      sequences.push(sequence);
    }
    const unassigned: RouteUnassignedEntry[] = [...manualEntries];
    for (const entry of greedy.unassigned) {
      unassigned.push(
        Object.freeze({ batchId: entry.batchId, reason: entry.reason }),
      );
      stopsToPersist.push({
        batchId: entry.batchId,
        fleetId: null,
        fasilitasId: facilityByBatch.get(entry.batchId) ?? null,
      });
    }
    for (const batch of batches) {
      if (!assignedGreedy.has(batch.batchId)) {
        unassigned.push(
          Object.freeze({ batchId: batch.batchId, reason: 'SISA' }),
        );
        stopsToPersist.push({
          batchId: batch.batchId,
          fleetId: null,
          fasilitasId: batch.fasilitasId,
        });
      }
    }

    const totalKg = batches.reduce(
      (sum, batch) => sum + Number(batch.beratKg),
      0,
    );
    const plan = await this.persistPlan(input, tanpaFasilitas, stopsToPersist, {
      status: 'AKTIF',
      source: 'greedy',
      matrixSource: matrix.source,
      totalKg: Math.round(totalKg * 100) / 100,
      totalKm: this.networkKm(sequences, batchIndex, matrix.distancesMeters),
      unassigned,
      skippedVehicles: skipped,
      vehicles,
      solverStats: null,
      speedSource,
      costSource: cost.source,
    });
    void this.opsNotifier.notifyThrottled(`route:${input.sppgId}`, {
      type: 'optimizer_degraded',
      severity: 'WARNING',
      message: `rute ${input.date} memakai penyusun cadangan (greedy) untuk SPPG ${input.sppgId}`,
      detail: {
        sppgId: input.sppgId,
        date: input.date,
        reason: 'GREEDY_FALLBACK',
        planId: plan.id,
        batchCount: batches.length,
        unassignedCount: unassigned.length,
        lockRequested: locks.reduce(
          (sum, lock) => sum + lock.sequence.length,
          0,
        ),
        lockHonored: countHonoredLocks(locks, greedy.assignments),
      },
    });
    return { plan, degraded: false };
  }

  async plan(
    dto: PlanRouteDto,
    actor: AuthenticatedUser,
  ): Promise<PlanRouteResult> {
    return this.buildPlan({
      sppgId: dto.sppgId,
      date: dto.tanggal ?? jakartaDateOf(new Date()),
      actorId: actor.id,
      allowGreedy: false,
      reason: null,
      previousPlanId: null,
    });
  }

  async list(
    query: RouteListQueryDto,
    actor: AuthenticatedUser,
  ): Promise<PaginatedItems<RoutePlanDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const qb = this.planRepository
      .createQueryBuilder('rp')
      .where(query.tanggal === undefined ? '1=1' : 'rp.tanggal = :tanggal', {
        tanggal: query.tanggal,
      })
      .andWhere(query.status === undefined ? '1=1' : 'rp.status = :status', {
        status: query.status,
      })
      .andWhere(query.sppgId === undefined ? '1=1' : 'rp.sppgId = :sppgId', {
        sppgId: query.sppgId,
      });
    if (actor.role === 'driver') {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM route_stop rs WHERE rs.plan_id = rp.id AND rs.fleet_id = :fleetId)',
        { fleetId: actor.fleetId ?? '00000000-0000-0000-0000-000000000000' },
      );
    }
    const [rows, total] = await qb
      .orderBy('rp.created_at', 'DESC')
      .addOrderBy('rp.id', 'ASC')
      .take(limit)
      .skip((page - 1) * limit)
      .getManyAndCount();
    return {
      items: rows.map(toRoutePlanDto),
      nextCursor: null,
      total,
    };
  }

  private async loadPlanWithScope(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ plan: RoutePlan; stops: readonly RouteStop[] }> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (plan === null) throw routePlanNotFoundError();
    const stops = await this.stopRepository.find({
      where: { planId: id },
      order: { urutan: 'ASC' },
    });
    if (actor.role === 'driver') {
      const visible = stops.some((stop) => stop.fleetId === actor.fleetId);
      if (!visible) throw forbiddenActionError();
    }
    return { plan, stops };
  }

  async getDetail(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<RoutePlanDetailDto> {
    const { plan, stops } = await this.loadPlanWithScope(id, actor);
    return toRoutePlanDetailDto(plan, stops);
  }

  async confirmStop(
    planId: string,
    stopId: string,
    dto: ConfirmStopDto,
    actor: AuthenticatedUser,
  ): Promise<RouteStopDto> {
    const { plan } = await this.loadPlanWithScope(planId, actor);
    const stop = await this.stopRepository.findOne({
      where: { id: stopId, planId: plan.id },
    });
    if (stop === null) throw routeStopNotFoundError();
    if (actor.role === 'driver' && stop.fleetId !== actor.fleetId) {
      throw forbiddenActionError();
    }
    if (stop.status === 'SELESAI' || stop.status === 'GAGAL') {
      throw routeStopClosedError();
    }
    if (stop.status === 'SAMPAI' && dto.status === 'SAMPAI') {
      throw routeStopTransitionError();
    }
    await this.stopRepository.manager.query(
      `WITH updated AS (
         UPDATE route_stop
            SET status = $2
          WHERE id = $1
          RETURNING id
       )
       SELECT id FROM updated`,
      [stop.id, dto.status],
    );
    const updated = await this.stopRepository.findOneOrFail({
      where: { id: stop.id },
    });
    const open = await this.stopRepository.manager.query<OpenStopsRow[]>(
      CLOSE_STOPS_SQL,
      [plan.id],
    );
    if ((open[0]?.openStops ?? 1) === 0) {
      await this.planRepository.manager.query(
        `WITH closed AS (
           UPDATE route_plan
              SET status = 'SELESAI'
            WHERE id = $1
              AND status = 'AKTIF'
            RETURNING id
         )
         SELECT id FROM closed`,
        [plan.id],
      );
    }
    return toRouteStopDto(updated);
  }

  async replan(id: string, actor: AuthenticatedUser): Promise<PlanRouteResult> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (plan === null) throw routePlanNotFoundError();
    if (plan.sppgId === null) throw routePlanNotReplanableError();
    if (plan.status !== 'AKTIF' && plan.status !== 'NEEDS_MANUAL_SCHEDULING') {
      throw routePlanNotReplanableError();
    }
    const cancelled = await this.planRepository.manager.query<IdRow[]>(
      CANCEL_PLAN_SQL,
      [plan.id],
    );
    if (cancelled.length === 0) throw routePlanNotReplanableError();
    return this.buildPlan({
      sppgId: plan.sppgId,
      date: plan.tanggal,
      actorId: actor.id,
      allowGreedy: true,
      reason: 'REPLAN',
      previousPlanId: plan.id,
    });
  }

  async hasPlansWithBrokenFleet(): Promise<readonly string[]> {
    const rows =
      await this.planRepository.manager.query<{ planId: string }[]>(
        BROKEN_PLAN_SQL,
      );
    return rows.map((row) => row.planId);
  }

  async replanForRecovery(planId: string): Promise<void> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (plan === null || plan.sppgId === null || plan.status !== 'AKTIF') {
      return;
    }
    const cancelled = await this.planRepository.manager.query<IdRow[]>(
      CANCEL_PLAN_SQL,
      [plan.id],
    );
    if (cancelled.length === 0) return;
    try {
      await this.buildPlan({
        sppgId: plan.sppgId,
        date: plan.tanggal,
        actorId: null,
        allowGreedy: true,
        reason: 'ARMADA_RUSAK',
        previousPlanId: plan.id,
      });
    } catch (error) {
      this.logger.error(
        `replan otomatis gagal plan=${plan.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.planRepository.manager.query(
        `WITH flagged AS (
           UPDATE route_plan
              SET status = 'NEEDS_MANUAL_SCHEDULING'
            WHERE id = $1
              AND status = 'BATAL'
            RETURNING id
         )
         SELECT id FROM flagged`,
        [plan.id],
      );
    }
  }
}
