import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { HardwareStatus } from 'src/common/constant/operational-status.constant';
import { OperationalStatus } from 'src/common/constant/operational-status.constant';
import { FleetEntity } from 'src/database/entities/fleet.entity';
import { TelemetryEntity } from 'src/database/entities/telemetry.entity';
import { RecoveryService } from 'src/optimization/recovery.service';
import { TelemetryEventsService } from './telemetry-events.service';
import type { TelemetryPayload, FleetPosition } from 'src/common/types';

const EMA_ALPHA = 0.3;
const CHUNK_SIZE = 50;
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;
const STALE_DATA_MS = 7 * 24 * 60 * 60 * 1000;

interface VolumeEma {
  value: number;
  hasData: boolean;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly lowVolumeThreshold: number;
  private readonly staleThresholdSeconds: number;
  private readonly emaCache = new Map<string, VolumeEma>();

  constructor(
    @InjectRepository(TelemetryEntity)
    private readonly repo: Repository<TelemetryEntity>,
    @InjectRepository(FleetEntity)
    private readonly fleetRepo: Repository<FleetEntity>,
    private readonly recoveryService: RecoveryService,
    config: ConfigService,
    @Optional() private readonly events?: TelemetryEventsService,
  ) {
    const va = config.get<{ lowVolumeThreshold: number }>('app.volumeAnomaly')!;
    const liveness = config.get<{ staleThresholdSeconds: number }>(
      'app.liveness',
    )!;
    this.lowVolumeThreshold = va.lowVolumeThreshold;
    this.staleThresholdSeconds = liveness.staleThresholdSeconds;
  }

  async ingest(payload: TelemetryPayload): Promise<void> {
    const fleet = await this.findActiveFleet(payload.fleetId);
    if (!fleet) return;

    const deviceTs = new Date(payload.deviceTimestamp);
    if (this.isClockSkewInvalid(deviceTs)) {
      this.logger.warn(
        `Telemetry discarded — clock skew for fleet ${payload.fleetId}`,
      );
      return;
    }

    await this.batchInsert([{ ...payload, fleetId: fleet.id }]);
    await this.updateFleetCache(fleet.id, payload, deviceTs);
    this.detectVolumeAnomaly(fleet.id, payload.volumePercent);

    if (this.isBrokenTransition(fleet, payload.hardwareStatus)) {
      this.logger.warn(
        `Broken transition detected for fleet ${fleet.plateNumber}`,
      );
      this.triggerRecoveryAsync(fleet.id);
    }

    this.emitFleetPosition(fleet.id, fleet.plateNumber);
  }

  async ingestBatch(payloads: readonly TelemetryPayload[]): Promise<void> {
    const valid = await this.filterValidPayloads(payloads);
    if (!valid.length) return;

    for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
      const chunk = valid.slice(i, i + CHUNK_SIZE);
      await this.batchInsert(chunk);
    }

    const latestPerFleet = this.latestPerFleet(valid);
    for (const [fleetId, payload] of latestPerFleet) {
      const fleet = await this.findActiveFleet(fleetId);
      if (!fleet) continue;
      const deviceTs = new Date(payload.deviceTimestamp);
      await this.updateFleetCache(fleetId, payload, deviceTs);
      this.detectVolumeAnomaly(fleetId, payload.volumePercent);
      if (this.isBrokenTransition(fleet, payload.hardwareStatus)) {
        this.logger.warn(
          `Broken transition (batch) for fleet ${fleet.plateNumber}`,
        );
        this.triggerRecoveryAsync(fleetId);
      }
    }
  }

  private async findActiveFleet(fleetId: string): Promise<FleetEntity | null> {
    const fleet = await this.fleetRepo.findOne({ where: { id: fleetId } });
    if (!fleet || fleet.deletedAt || fleet.deviceRevokedAt) {
      this.logger.warn(
        `Telemetry discarded — fleet ${fleetId} not found/revoked`,
      );
      return null;
    }
    return fleet;
  }

  private isClockSkewInvalid(deviceTs: Date): boolean {
    const now = Date.now();
    const diff = deviceTs.getTime();
    return diff > now + CLOCK_SKEW_TOLERANCE_MS || diff < now - STALE_DATA_MS;
  }

  private async batchInsert(
    rows: readonly (TelemetryPayload & { fleetId: string })[],
  ): Promise<void> {
    try {
      await this.repo
        .createQueryBuilder()
        .insert()
        .values(rows.map((r) => this.toEntity(r)))
        .orIgnore('ON CONFLICT (fleet_id, device_timestamp) DO NOTHING')
        .execute();
    } catch (err) {
      this.logger.error(`Batch insert failed: ${(err as Error).message}`);
    }
  }

  private toEntity(
    r: TelemetryPayload & { fleetId: string },
  ): Partial<TelemetryEntity> {
    return {
      fleetId: r.fleetId,
      latitude: r.latitude,
      longitude: r.longitude,
      speedKmh: r.speedKmh,
      volumePercent: r.volumePercent,
      hardwareStatus: r.hardwareStatus,
      deviceTimestamp: new Date(r.deviceTimestamp),
    };
  }

  private async updateFleetCache(
    fleetId: string,
    p: TelemetryPayload,
    deviceTs: Date,
  ): Promise<void> {
    const newStatus =
      p.hardwareStatus === HardwareStatus.BROKEN
        ? OperationalStatus.ONLINE_BROKEN
        : OperationalStatus.ONLINE_NORMAL;

    await this.fleetRepo
      .createQueryBuilder()
      .update()
      .set({
        lastLat: p.latitude,
        lastLng: p.longitude,
        lastDeviceTimestamp: deviceTs,
        lastVolumePercent: p.volumePercent,
        lastHardwareStatus: p.hardwareStatus,
        operationalStatus: newStatus,
      })
      .where(
        'id = :id AND (last_device_timestamp IS NULL OR last_device_timestamp < :ts)',
        {
          id: fleetId,
          ts: deviceTs,
        },
      )
      .execute();
  }

  private isBrokenTransition(
    fleet: FleetEntity,
    newHw: HardwareStatus,
  ): boolean {
    if (newHw !== HardwareStatus.BROKEN) return false;
    return fleet.lastHardwareStatus !== HardwareStatus.BROKEN;
  }

  private detectVolumeAnomaly(fleetId: string, volume: number): void {
    const prev = this.emaCache.get(fleetId) ?? { value: 0, hasData: false };
    const ema = prev.hasData
      ? prev.value + EMA_ALPHA * (volume - prev.value)
      : volume;
    this.emaCache.set(fleetId, { value: ema, hasData: true });

    if (prev.hasData && ema < this.lowVolumeThreshold) {
      this.logger.warn(
        `Volume anomaly (EMA=${ema.toFixed(2)}) for fleet ${fleetId}`,
      );
    }
  }

  private latestPerFleet(
    payloads: readonly TelemetryPayload[],
  ): Map<string, TelemetryPayload> {
    const latest = new Map<string, TelemetryPayload>();
    for (const p of payloads) {
      const existing = latest.get(p.fleetId);
      if (!existing || p.deviceTimestamp > existing.deviceTimestamp) {
        latest.set(p.fleetId, p);
      }
    }
    return latest;
  }

  private async filterValidPayloads(
    payloads: readonly TelemetryPayload[],
  ): Promise<TelemetryPayload[]> {
    const valid: TelemetryPayload[] = [];
    for (const p of payloads) {
      const fleet = await this.findActiveFleet(p.fleetId);
      if (!fleet) continue;
      if (this.isClockSkewInvalid(new Date(p.deviceTimestamp))) continue;
      valid.push({ ...p, fleetId: fleet.id });
    }
    return valid;
  }

  private triggerRecoveryAsync(fleetId: string): void {
    this.logger.log(`Recovery triggered for fleet ${fleetId}`);
    this.recoveryService
      .trigger(fleetId)
      .then((result) => {
        this.logger.log(
          `Recovery completed for fleet ${fleetId} — status=${result.status}, duration=${result.durationMs}ms`,
        );
      })
      .catch((err) => {
        this.logger.error(
          `Recovery failed for fleet ${fleetId}: ${(err as Error).message}`,
        );
      });
  }

  private async emitFleetPosition(fleetId: string, plateNumber: string): Promise<void> {
    if (!this.events) return;
    try {
      const fleet = await this.fleetRepo.findOne({ where: { id: fleetId } });
      if (!fleet) return;
      const now = Date.now();
      const stalenessSeconds = fleet.lastDeviceTimestamp
        ? Math.floor((now - fleet.lastDeviceTimestamp.getTime()) / 1000)
        : 0;
      this.events.emitFleetPosition({
        fleetId: fleet.id,
        plateNumber: fleet.plateNumber,
        latitude: fleet.lastLat ?? 0,
        longitude: fleet.lastLng ?? 0,
        operationalStatus: fleet.operationalStatus,
        lastDeviceTimestamp: fleet.lastDeviceTimestamp ?? new Date(0),
        stalenessSeconds,
        isRealTime: stalenessSeconds < this.staleThresholdSeconds,
        volumePercent: fleet.lastVolumePercent ?? 0,
        hardwareStatus: fleet.lastHardwareStatus ?? fleet.statusHardware,
      });
    } catch (err) {
      this.logger.warn(`Failed to emit fleet position: ${(err as Error).message}`);
    }
  }
}
