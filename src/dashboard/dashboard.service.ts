import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Repository, MoreThanOrEqual } from "typeorm";
import { OperationalStatus } from "src/common/constant/operational-status.constant";
import { FleetEntity } from "src/database/entities/fleet.entity";
import { RecoveryLogEntity } from "src/database/entities/recovery-log.entity";
import { RoutePlanEntity } from "src/database/entities/route-plan.entity";
import { LlmEngineService } from "src/llm/llm-engine.service";
import type { DashboardSummary, FleetPosition, PaginatedResponse } from "src/common/types";

const STATUS_COUNT_KEYS: ReadonlyArray<OperationalStatus> = [
  OperationalStatus.ONLINE_NORMAL,
  OperationalStatus.ONLINE_BROKEN,
  OperationalStatus.STALE,
  OperationalStatus.OFFLINE,
];

const MAX_PAGE_SIZE = 100;


@Injectable()
export class DashboardService {
  private readonly staleThresholdSeconds: number;

  constructor(
    @InjectRepository(FleetEntity)
    private readonly fleetRepo: Repository<FleetEntity>,
    @InjectRepository(RecoveryLogEntity)
    private readonly recoveryRepo: Repository<RecoveryLogEntity>,
    @InjectRepository(RoutePlanEntity)
    private readonly planRepo: Repository<RoutePlanEntity>,
    private readonly llm: LlmEngineService,
    config: ConfigService,
  ) {
    this.staleThresholdSeconds = config.get<number>(
      'app.liveness.staleThresholdSeconds',
    )!;
  }

  async getFleetPositions(page = 1, limit = 50, fleetId?: string): Promise<PaginatedResponse<FleetPosition>> {
    const safeLimit = Math.min(limit, MAX_PAGE_SIZE);
    const where = fleetId ? {id: fleetId, deletedAt: null as never} : {deletedAt: null as never};
    const [fleets, total] = await this.fleetRepo.findAndCount({
      where,
      skip: (page - 1) * safeLimit,
      take: safeLimit,
      order: { operationalStatus: 'ASC' },
    });

    return {
        data: fleets.map((f) => this.toFleetPosition(f)),
        total,
        page,
        limit: safeLimit,
        hasNext: page * safeLimit < total,
    }
  }

  async getSummary(): Promise<DashboardSummary> {
    const fleets = await this.fleetRepo.find({ where: {deletedAt: null as never} });
    const counts = this.countByStatus(fleets);
    const recoveryCountToday = await this.countRecoveryToday();
    const avgDistanceKm = await this.calcAvgDistanceKm();
    const llmSummary = await this.generateLlmSummary(fleets.length, recoveryCountToday);

    return {
      totalFleet: fleets.length,
      onlineNormal: counts[OperationalStatus.ONLINE_NORMAL] ?? 0,
      onlineBroken: counts[OperationalStatus.ONLINE_BROKEN] ?? 0,
      stale: counts[OperationalStatus.STALE] ?? 0,
      offline: counts[OperationalStatus.OFFLINE] ?? 0,
      recoveryCountToday,
      avgRouteEfficiency: avgDistanceKm,
      llmSummary,
      generatedAt: new Date(),
    };
  }

  private toFleetPosition(f: FleetEntity): FleetPosition {
    const stalenessSeconds = f.lastDeviceTimestamp
        ? Math.floor((Date.now() - f.lastDeviceTimestamp.getTime()) / 1000)
        : 0;

    return {
      fleetId: f.id,
      plateNumber: f.plateNumber,
      latitude: f.lastLat ?? 0,
      longitude: f.lastLng ?? 0,
      operationalStatus: f.operationalStatus,
      lastDeviceTimestamp: f.lastDeviceTimestamp ?? new Date(0),
      stalenessSeconds,
      isRealTime: stalenessSeconds < this.staleThresholdSeconds,
      volumePercent: f.lastVolumePercent ?? 0,
      hardwareStatus: f.lastHardwareStatus ?? f.statusHardware,
    };
  }

  private countByStatus(fleets: FleetEntity[]): Record<OperationalStatus, number> {
    const counts = {} as Record<OperationalStatus, number>;
    for (const key of STATUS_COUNT_KEYS) counts[key] = 0;
    for (const f of fleets) counts[f.operationalStatus] = (counts[f.operationalStatus] ?? 0) + 1;
    return counts;
  }

  private async countRecoveryToday(): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.recoveryRepo.count({ where: { detectedAt: MoreThanOrEqual(start) } });
  }

  private async calcAvgDistanceKm(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const plans = await this.planRepo.find({ where: { planDate: today, status: 'active' as never } });
    if (!plans.length) return 0;
    const totalKm = plans.reduce((sum, p) => sum + Number(p.totalKm), 0);
    return totalKm / plans.length;
  }

  private async generateLlmSummary(fleetCount: number, recoveryCount: number): Promise<string | null> {
    const prompt = `Ringkas dashboard: ${fleetCount} armada, ${recoveryCount} recovery hari ini. Insight singkat (max 100 kata).`;
    return this.llm.summarizeRoutePlan([]).catch(() => null) ?? null;
  }
}