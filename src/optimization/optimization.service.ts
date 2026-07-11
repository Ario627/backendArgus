import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { FleetEntity } from 'src/database/entities/fleet.entity';
import { DestinationEntity } from 'src/database/entities/destination.entity';
import { RoutePlanEntity, RoutePlanStop } from 'src/database/entities/route-plan.entity';
import { OperationalStatus } from 'src/common/constant/operational-status.constant';
import {
  DEFAULT_SERVICE_MINUTES_BY_TYPE,
  DestinationType,
} from 'src/common/constant/destination.constant';
import { MapsClientService } from 'src/maps/maps-client.service';
import { LlmEngineService } from 'src/llm/llm-engine.service';
import type {
  OptimizationInput,
  OptimizationOutput,
  VehicleInput,
  DestinationInput,
  OptimizationConstraints,
  RouteResult,
  GeoPoint,
  BrokenStop,
  GreedyAssignment,
} from 'src/common/types';
import { haversineKm } from 'src/common/utils/geo';

const MAX_RECOVERY_POINTS = 10;

interface ReceiverCandidate {
  fleet: FleetEntity;
  distanceKm: number;
  remainingCapacityKg: number;
}

@Injectable()
export class OptimizationService {
  private readonly logger = new Logger(OptimizationService.name);
  private readonly engineUrl: string;
  private readonly engineTimeoutMs: number;
  private readonly swarmRecoveryOptTimeoutMs: number;
  private readonly swarmRecoveryTargetMs: number;
  private readonly maxRouteMinutes: number;
  private readonly lowVolumeThreshold: number;
  private readonly skipLowVolume: boolean;
  private isDailyPlanRunning = false;

  constructor(
    @InjectRepository(FleetEntity)
    private readonly fleetRepo: Repository<FleetEntity>,
    @InjectRepository(DestinationEntity)
    private readonly destRepo: Repository<DestinationEntity>,
    @InjectRepository(RoutePlanEntity)
    private readonly planRepo: Repository<RoutePlanEntity>,
    private readonly maps: MapsClientService,
    private readonly llm: LlmEngineService,
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    const opt = config.get<{
      engineUrl: string;
      engineTimeoutMs: number;
      swarmRecoveryTargetMs: number;
      swarmRecoveryOptTimeoutMs: number;
    }>('app.optimization')!;
    this.engineUrl = opt.engineUrl;
    this.engineTimeoutMs = opt.engineTimeoutMs;
    this.swarmRecoveryOptTimeoutMs = opt.swarmRecoveryOptTimeoutMs;
    this.swarmRecoveryTargetMs = opt.swarmRecoveryTargetMs;

    const volume = config.get<{
      lowVolumeThreshold: number;
      movingAverageWindowDays: number;
    }>('app.volumeAnomaly')!;
    this.lowVolumeThreshold = volume.lowVolumeThreshold;
    this.skipLowVolume = true;
    this.maxRouteMinutes = 480;
  }

  async buildDailyPlan(): Promise<OptimizationOutput> {
    if (this.isDailyPlanRunning) {
      this.logger.warn('buildDailyPlan already running, skipping concurrent trigger');
      return { status: 'FEASIBLE', routes: [], skipped: [], solverDurationMs: 0 };
    }
    this.isDailyPlanRunning = true;

    try {
      const fleets = await this.fleetRepo.find({
        where: {
          deletedAt: IsNull(),
          deviceRevokedAt: IsNull(),
          operationalStatus: In([
            OperationalStatus.ONLINE_NORMAL,
            OperationalStatus.ONLINE_BROKEN,
          ]),
        },
      });

      const destinations = await this.destRepo.find({
        where: { deletedAt: IsNull() },
      });

      if (fleets.length === 0 || destinations.length === 0) {
        this.logger.log('No active fleet or destinations, skipping daily plan');
        return { status: 'FEASIBLE', routes: [], skipped: [], solverDurationMs: 0 };
      }

      const vehicles = fleets.map((f) => this.toVehicleInput(f));
      const dests = destinations.map((d) => this.toDestinationInput(d));

      const fleetPoints: GeoPoint[] = fleets.map((f) => ({
        id: f.id,
        lat: f.lastLat ?? 0,
        lng: f.lastLng ?? 0,
      }));
      const destPoints: GeoPoint[] = destinations.map((d) => ({
        id: d.id,
        lat: d.latitude,
        lng: d.longitude,
      }));

      const distanceMatrix = await this.maps.getFullMatrix([...fleetPoints, ...destPoints]);

      const tpaDest = destinations.find((d) => d.type === DestinationType.TPA);
      const finalDepotId = tpaDest?.id ?? '';

      const constraints: OptimizationConstraints = {
        maxRouteMinutes: this.maxRouteMinutes,
        finalDepotId,
        skipLowVolume: this.skipLowVolume,
        lowVolumeThreshold: this.lowVolumeThreshold,
      };

      const input: OptimizationInput = {
        mode: 'daily_plan',
        vehicles,
        destinations: dests,
        distanceMatrix,
        constraints,
      };

      const output = await this.callOrTools(input, this.engineTimeoutMs);
      if (!output || output.status === 'NO_SOLUTION') {
        this.logger.warn(`OR-Tools returned ${output?.status ?? 'null'} for daily plan`);
        throw new ServiceUnavailableException('Optimization engine unavailable or no solution');
      }

      await this.persistDailyPlans(output.routes, fleets, destinations, distanceMatrix.mode === 'haversine_fallback');

      this.fireAndForgetLlmSummary(output.routes);

      return output;
    } finally {
      this.isDailyPlanRunning = false;
    }
  }

  async solveMiniVRP(
    brokenFleetId: string,
    brokenStops: BrokenStop[],
    candidates: ReceiverCandidate[],
  ): Promise<OptimizationOutput | null> {
    if (brokenStops.length === 0 || candidates.length === 0) {
      return null;
    }

    const vehicles: VehicleInput[] = candidates.map((c) => ({
      id: c.fleet.id,
      startLat: c.fleet.lastLat ?? 0,
      startLng: c.fleet.lastLng ?? 0,
      capacityKg: c.fleet.capacityKg,
    }));

    const brokenDestIds = brokenStops.map((s) => s.destId);
    const destinations = await this.destRepo.find({
      where: { id: In(brokenDestIds) },
    });

    const allPoints: GeoPoint[] = [...candidates.map((c) => ({
      id: c.fleet.id,
      lat: c.fleet.lastLat ?? 0,
      lng: c.fleet.lastLng ?? 0,
    })), ...destinations.map((d) => ({
      id: d.id,
      lat: d.latitude,
      lng: d.longitude,
    }))];

    const distanceMatrix = await this.maps.getFullMatrix(allPoints.slice(0, MAX_RECOVERY_POINTS));

    const destInputs = destinations.map((d) => this.toDestinationInput(d));

    const constraints: OptimizationConstraints = {
      maxRouteMinutes: this.maxRouteMinutes,
      finalDepotId: '',
      skipLowVolume: false,
      lowVolumeThreshold: this.lowVolumeThreshold,
    };

    const input: OptimizationInput = {
      mode: 'swarm_recovery',
      vehicles,
      destinations: destInputs,
      distanceMatrix,
      constraints,
    };

    return this.callOrTools(input, this.swarmRecoveryOptTimeoutMs);
  }

  fallbackGreedyAssign(
    brokenStops: BrokenStop[],
    candidates: ReceiverCandidate[],
  ): GreedyAssignment[] {
    const sortedStops = [...brokenStops].sort((a, b) => b.priority - a.priority);
    const sortedCandidates = [...candidates].sort((a, b) => a.distanceKm - b.distanceKm);

    const assignments = new Map<string, BrokenStop[]>();
    const remaining = new Map<string, number>(
      sortedCandidates.map((c) => [c.fleet.id, c.remainingCapacityKg]),
    );

    for (const stop of sortedStops) {
      let assigned = false;
      for (const candidate of sortedCandidates) {
        const cap = remaining.get(candidate.fleet.id) ?? 0;
        if (cap >= stop.demandKg) {
          remaining.set(candidate.fleet.id, cap - stop.demandKg);
          const list = assignments.get(candidate.fleet.id) ?? [];
          list.push(stop);
          assignments.set(candidate.fleet.id, list);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        this.logger.warn(`Stop ${stop.destId} unassigned in greedy fallback`);
      }
    }

    return Array.from(assignments.entries()).map(([receiverFleetId, stops]) => ({
      receiverFleetId,
      stops,
    }));
  }

  private async callOrTools(
    input: OptimizationInput,
    timeoutMs: number,
  ): Promise<OptimizationOutput | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { data } = await firstValueFrom(
        this.http.post(`${this.engineUrl}/solve`, input, {
          signal: controller.signal,
          timeout: timeoutMs,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      if (!this.validateOutput(data)) {
        this.logger.error('OR-Tools output validation failed');
        return null;
      }

      return data as OptimizationOutput;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`OR-Tools call failed: ${msg}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private validateOutput(data: unknown): data is OptimizationOutput {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    if (typeof obj.status !== 'string') return false;
    if (!Array.isArray(obj.routes)) return false;
    if (!Array.isArray(obj.skipped)) return false;
    if (typeof obj.solverDurationMs !== 'number') return false;
    return true;
  }

  private async persistDailyPlans(
    routes: readonly RouteResult[],
    fleets: FleetEntity[],
    destinations: DestinationEntity[],
    lowConfidence: boolean,
  ): Promise<RoutePlanEntity[]> {
    const planDate = new Date().toISOString().slice(0, 10);
    const saved: RoutePlanEntity[] = [];

    for (const route of routes) {
      const fleet = fleets.find((f) => f.id === route.vehicleId);
      if (!fleet) continue;

      const stops: RoutePlanStop[] = route.stops.map((s) => ({
        destId: s.destId,
        order: s.order,
        etaEpoch: s.etaEpoch,
        cumulativeKm: s.cumulativeKm,
        status: 'pending' as const,
      }));

      const existing = await this.planRepo.findOne({
        where: { fleetId: fleet.id, planDate, status: 'active' as never },
      });

      if (existing) {
        const doneStops = existing.stops.filter((s) => s.status === 'done' || s.status === 'redistributed');
        const mergedStops = [...doneStops, ...stops];
        existing.stops = mergedStops;
        existing.totalKm = route.totalKm;
        existing.totalMinutes = route.totalMinutes;
        existing.lowConfidence = lowConfidence;
        saved.push(await this.planRepo.save(existing));
      } else {
        const plan = this.planRepo.create({
          fleetId: fleet.id,
          planDate,
          stops,
          totalKm: route.totalKm,
          totalMinutes: route.totalMinutes,
          status: 'active',
          lowConfidence,
        });
        saved.push(await this.planRepo.save(plan));
      }
    }

    return saved;
  }

  private fireAndForgetLlmSummary(routes: readonly RouteResult[]): void {
    setImmediate(() => {
      this.llm
        .summarizeRoutePlan(routes)
        .catch((err) => {
          this.logger.warn(`LLM route plan summary failed: ${(err as Error).message}`);
        });
    });
  }

  private toVehicleInput(fleet: FleetEntity): VehicleInput {
    return {
      id: fleet.id,
      startLat: fleet.lastLat ?? 0,
      startLng: fleet.lastLng ?? 0,
      capacityKg: fleet.capacityKg,
    };
  }

  private toDestinationInput(dest: DestinationEntity): DestinationInput {
    return {
      id: dest.id,
      type: dest.type,
      lat: dest.latitude,
      lng: dest.longitude,
      demandKg: dest.capacityKg,
      priority: dest.priority,
      serviceMinutes: DEFAULT_SERVICE_MINUTES_BY_TYPE[dest.type] ?? 10,
      historicalVolumeAvg: dest.lowVolumeFlag ? 0 : 0.5,
      lowVolumeFlag: dest.lowVolumeFlag,
    };
  }

}