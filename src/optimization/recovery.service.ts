import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import { FleetEntity } from 'src/database/entities/fleet.entity';
import { RoutePlanEntity, RoutePlanStop } from 'src/database/entities/route-plan.entity';
import { RecoveryLogEntity, RedistributedStop } from 'src/database/entities/recovery-log.entity';
import { DestinationEntity } from 'src/database/entities/destination.entity';
import { OperationalStatus } from 'src/common/constant/operational-status.constant';
import { OptimizationService } from './optimization.service';
import { LlmEngineService } from 'src/llm/llm-engine.service';
import type { RecoveryResult, OptimizationOutput, BrokenStop, GreedyAssignment } from 'src/common/types';
import { haversineKm } from 'src/common/utils/geo';

interface ReceiverCandidate {
  fleet: FleetEntity;
  distanceKm: number;
  remainingCapacityKg: number;
}

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);
  private readonly swarmRecoveryTargetMs: number;
  private readonly recoveryLocks = new Map<string, Promise<RecoveryResult>>();

  constructor(
    @InjectRepository(FleetEntity)
    private readonly fleetRepo: Repository<FleetEntity>,
    @InjectRepository(RoutePlanEntity)
    private readonly planRepo: Repository<RoutePlanEntity>,
    @InjectRepository(RecoveryLogEntity)
    private readonly recoveryRepo: Repository<RecoveryLogEntity>,
    @InjectRepository(DestinationEntity)
    private readonly destRepo: Repository<DestinationEntity>,
    private readonly optimization: OptimizationService,
    private readonly llm: LlmEngineService,
    config: ConfigService,
  ) {
    this.swarmRecoveryTargetMs =
      config.get<number>('app.optimization.swarmRecoveryTargetMs') ?? 60000;
  }

  async assign(
    brokenFleetId: string,
    receivingFleetIds: string[],
    redistributedStopIds: string[],
  ): Promise<RecoveryResult> {
    const t0 = Date.now();
    const detectedAt = new Date();

    const today = new Date().toISOString().slice(0, 10);
    const brokenPlan = await this.planRepo.findOne({
      where: { fleetId: brokenFleetId, planDate: today, status: 'active' as never },
    });

    const redistributed: RedistributedStop[] = [];

    if (brokenPlan) {
      const stopIdsSet = new Set(redistributedStopIds);
      brokenPlan.stops = brokenPlan.stops.map((s) =>
        stopIdsSet.has(s.destId)
          ? { ...s, status: 'redistributed' as const }
          : s,
      );
      await this.planRepo.save(brokenPlan);
    }

    for (const receiverFleetId of receivingFleetIds) {
      const receiverPlan = await this.planRepo.findOne({
        where: { fleetId: receiverFleetId, planDate: today, status: 'active' as never },
      });

      const newStops: RoutePlanStop[] = redistributedStopIds.map((destId, idx) => ({
        destId,
        order: (receiverPlan?.stops.length ?? 0) + idx + 1,
        etaEpoch: 0,
        cumulativeKm: 0,
        status: 'pending' as const,
      }));

      if (receiverPlan) {
        receiverPlan.stops = [...receiverPlan.stops, ...newStops];
        await this.planRepo.save(receiverPlan);
      } else {
        const plan = this.planRepo.create({
          fleetId: receiverFleetId,
          planDate: today,
          stops: newStops,
          totalKm: 0,
          totalMinutes: 0,
          status: 'active',
          lowConfidence: true,
        });
        await this.planRepo.save(plan);
      }

      for (const destId of redistributedStopIds) {
        redistributed.push({ destId, demandKg: 0, receiverFleetId });
      }
    }

    const durationMs = Date.now() - t0;

    const recoveryLog = await this.insertRecoveryLog({
      brokenFleetId,
      receivingFleetIds,
      redistributedStops: redistributed,
      detectedAt,
      completedAt: new Date(),
      durationMs,
      fallback: false,
      status: 'success',
    });

    const result: RecoveryResult = {
      brokenFleetId,
      receivingFleetIds,
      redistributedStopIds,
      durationMs,
      fallback: false,
      status: 'success',
      llmNarrative: null,
    };

    this.fireAndForgetLlmNarrative(result, recoveryLog.id);

    return result;
  }

  async getResult(brokenFleetId: string): Promise<RecoveryResult | null> {
    const log = await this.recoveryRepo.findOne({
      where: { brokenFleetId },
      order: { detectedAt: 'DESC' },
    });

    if (!log) return null;

    return {
      brokenFleetId: log.brokenFleetId,
      receivingFleetIds: log.receivingFleetIds,
      redistributedStopIds: log.redistributedStops.map((s) => s.destId),
      durationMs: log.durationMs ?? 0,
      fallback: log.fallback,
      status: log.status,
      llmNarrative: log.llmNarrative,
    };
  }

  async trigger(brokenFleetId: string, manual = false): Promise<RecoveryResult> {
    const existing = this.recoveryLocks.get(brokenFleetId);
    if (existing) {
      this.logger.warn(`Recovery already running for fleet ${brokenFleetId}, returning existing promise`);
      return existing;
    }

    const promise = this.executeRecovery(brokenFleetId, manual);
    this.recoveryLocks.set(brokenFleetId, promise);

    try {
      return await promise;
    } finally {
      this.recoveryLocks.delete(brokenFleetId);
    }
  }

  private async executeRecovery(
    brokenFleetId: string,
    manual: boolean,
  ): Promise<RecoveryResult> {
    const t0 = Date.now();
    const detectedAt = new Date();
    this.logger.log(
      `Recovery triggered for fleet ${brokenFleetId} (manual=${manual})`,
    );

    const brokenFleet = await this.fleetRepo.findOne({
      where: { id: brokenFleetId, deletedAt: IsNull() },
    });
    if (!brokenFleet) {
      this.logger.warn(`Broken fleet ${brokenFleetId} not found`);
      return this.buildNoReceiverResult(brokenFleetId, t0);
    }

    const brokenStops = await this.getBrokenStops(brokenFleetId);
    if (brokenStops.length === 0) {
      this.logger.log(`No pending stops for broken fleet ${brokenFleetId}`);
      return this.buildNoReceiverResult(brokenFleetId, t0);
    }

    const candidates = await this.queryCandidates(brokenFleet);
    if (candidates.length === 0) {
      this.logger.warn(`No receiver candidates for broken fleet ${brokenFleetId}`);
      await this.insertRecoveryLog({
        brokenFleetId,
        receivingFleetIds: [],
        redistributedStops: [],
        detectedAt,
        completedAt: new Date(),
        durationMs: Date.now() - t0,
        fallback: false,
        status: 'no_receiver',
      });
      return {
        brokenFleetId,
        receivingFleetIds: [],
        redistributedStopIds: [],
        durationMs: Date.now() - t0,
        fallback: false,
        status: 'no_receiver',
        llmNarrative: null,
      };
    }

    let output: OptimizationOutput | null = null;
    let fallback = false;

    try {
      output = await this.optimization.solveMiniVRP(
        brokenFleetId,
        brokenStops,
        candidates,
      );
    } catch (err) {
      this.logger.warn(
        `OR-Tools mini VRP failed for fleet ${brokenFleetId}: ${(err as Error).message}`,
      );
    }

    let assignments: GreedyAssignment[];

    if (output && output.status !== 'NO_SOLUTION') {
      assignments = this.mapOrToolsAssignments(output, candidates, brokenStops);
    } else {
      fallback = true;
      this.logger.warn(
        `Using greedy fallback for recovery of fleet ${brokenFleetId}`,
      );
      assignments = this.optimization.fallbackGreedyAssign(brokenStops, candidates);
    }

    const redistributedStops = await this.applyAssignments(
      brokenFleetId,
      assignments,
    );

    const t1 = Date.now();
    const durationMs = t1 - t0;
    const receivingFleetIds = assignments.map((a) => a.receiverFleetId);
    const redistributedStopIds = redistributedStops.map((s) => s.destId);

    if (durationMs > this.swarmRecoveryTargetMs) {
      this.logger.warn(
        `Recovery for fleet ${brokenFleetId} exceeded ${this.swarmRecoveryTargetMs}ms target: ${durationMs}ms`,
      );
    }

    const recoveryLog = await this.insertRecoveryLog({
      brokenFleetId,
      receivingFleetIds,
      redistributedStops,
      detectedAt,
      completedAt: new Date(t1),
      durationMs,
      fallback,
      status: fallback ? 'fallback_greedy' : 'success',
    });

    const result: RecoveryResult = {
      brokenFleetId,
      receivingFleetIds,
      redistributedStopIds,
      durationMs,
      fallback,
      status: fallback ? 'fallback_greedy' : 'success',
      llmNarrative: null,
    };

    this.fireAndForgetLlmNarrative(result, recoveryLog.id);

    return result;
  }

  private async getBrokenStops(brokenFleetId: string): Promise<BrokenStop[]> {
    const today = new Date().toISOString().slice(0, 10);
    const plan = await this.planRepo.findOne({
      where: { fleetId: brokenFleetId, planDate: today, status: 'active' as never },
    });
    if (!plan) return [];

    const pending = plan.stops.filter((s) => s.status === 'pending');
    const destIds = pending.map((s) => s.destId);

    const priorities = await this.fetchPriorities(destIds);

    return pending.map((s) => ({
      destId: s.destId,
      demandKg: 1000,
      priority: priorities.get(s.destId) ?? 3,
    }));
  }

  private async fetchPriorities(
    destIds: string[],
  ): Promise<Map<string, number>> {
    if (destIds.length === 0) return new Map();
    const dests = await this.destRepo.find({
      where: { id: In(destIds) },
    });
    return new Map(dests.map((d) => [d.id, d.priority]));
  }

  private async queryCandidates(
    brokenFleet: FleetEntity,
  ): Promise<ReceiverCandidate[]> {
    const fleets = await this.fleetRepo.find({
      where: {
        deletedAt: IsNull(),
        deviceRevokedAt: IsNull(),
        operationalStatus: OperationalStatus.ONLINE_NORMAL,
      },
    });

    return fleets
      .filter((f) => f.id !== brokenFleet.id)
      .map((f) => ({
        fleet: f,
        distanceKm: haversineKm(
          brokenFleet.lastLat ?? 0,
          brokenFleet.lastLng ?? 0,
          f.lastLat ?? 0,
          f.lastLng ?? 0,
        ),
        remainingCapacityKg: f.capacityKg,
      }))
      .filter((c) => c.remainingCapacityKg > 0)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private mapOrToolsAssignments(
    output: OptimizationOutput,
    candidates: ReceiverCandidate[],
    brokenStops: BrokenStop[],
  ): GreedyAssignment[] {
    const candidateMap = new Map(candidates.map((c) => [c.fleet.id, c]));
    const stopMap = new Map(brokenStops.map((s) => [s.destId, s]));
    const assignments = new Map<string, BrokenStop[]>();

    for (const route of output.routes) {
      const candidate = candidateMap.get(route.vehicleId);
      if (!candidate) continue;

      for (const stop of route.stops) {
        const brokenStop = stopMap.get(stop.destId);
        if (!brokenStop) continue;

        const list = assignments.get(route.vehicleId) ?? [];
        list.push(brokenStop);
        assignments.set(route.vehicleId, list);
      }
    }

    return Array.from(assignments.entries()).map(([receiverFleetId, stops]) => ({
      receiverFleetId,
      stops,
    }));
  }

  private async applyAssignments(
    brokenFleetId: string,
    assignments: GreedyAssignment[],
  ): Promise<RedistributedStop[]> {
    const today = new Date().toISOString().slice(0, 10);
    const redistributed: RedistributedStop[] = [];

    const brokenPlan = await this.planRepo.findOne({
      where: { fleetId: brokenFleetId, planDate: today, status: 'active' as never },
    });

    if (brokenPlan) {
      const assignedDestIds = new Set(
        assignments.flatMap((a) => a.stops.map((s) => s.destId)),
      );
      brokenPlan.stops = brokenPlan.stops.map((s) =>
        assignedDestIds.has(s.destId)
          ? { ...s, status: 'redistributed' as const }
          : s,
      );
      await this.planRepo.save(brokenPlan);
    }

    for (const assignment of assignments) {
      const receiverPlan = await this.planRepo.findOne({
        where: {
          fleetId: assignment.receiverFleetId,
          planDate: today,
          status: 'active' as never,
        },
      });

      const newStops: RoutePlanStop[] = assignment.stops.map((s, idx) => ({
        destId: s.destId,
        order: (receiverPlan?.stops.length ?? 0) + idx + 1,
        etaEpoch: 0,
        cumulativeKm: 0,
        status: 'pending' as const,
      }));

      if (receiverPlan) {
        receiverPlan.stops = [...receiverPlan.stops, ...newStops];
        await this.planRepo.save(receiverPlan);
      } else {
        const plan = this.planRepo.create({
          fleetId: assignment.receiverFleetId,
          planDate: today,
          stops: newStops,
          totalKm: 0,
          totalMinutes: 0,
          status: 'active',
          lowConfidence: true,
        });
        await this.planRepo.save(plan);
      }

      for (const stop of assignment.stops) {
        redistributed.push({
          destId: stop.destId,
          demandKg: stop.demandKg,
          receiverFleetId: assignment.receiverFleetId,
        });
      }
    }

    return redistributed;
  }

  private async insertRecoveryLog(params: {
    brokenFleetId: string;
    receivingFleetIds: string[];
    redistributedStops: RedistributedStop[];
    detectedAt: Date;
    completedAt: Date;
    durationMs: number;
    fallback: boolean;
    status: 'success' | 'no_receiver' | 'fallback_greedy';
  }): Promise<RecoveryLogEntity> {
    const log = this.recoveryRepo.create({
      brokenFleetId: params.brokenFleetId,
      receivingFleetIds: params.receivingFleetIds,
      redistributedStops: params.redistributedStops,
      detectedAt: params.detectedAt,
      completedAt: params.completedAt,
      durationMs: params.durationMs,
      fallback: params.fallback,
      status: params.status,
    });
    return this.recoveryRepo.save(log);
  }

  private buildNoReceiverResult(
    brokenFleetId: string,
    t0: number,
  ): RecoveryResult {
    return {
      brokenFleetId,
      receivingFleetIds: [],
      redistributedStopIds: [],
      durationMs: Date.now() - t0,
      fallback: false,
      status: 'no_receiver',
      llmNarrative: null,
    };
  }

  private fireAndForgetLlmNarrative(
    result: RecoveryResult,
    recoveryLogId: string,
  ): void {
    setImmediate(() => {
      this.llm
        .summarizeRecovery(result)
        .then((narrative) => {
          if (narrative) {
            return this.recoveryRepo.update(recoveryLogId, {
              llmNarrative: narrative,
            });
          }
          return undefined;
        })
        .catch((err) => {
          this.logger.warn(
            `LLM recovery narrative failed: ${(err as Error).message}`,
          );
        });
    });
  }
}