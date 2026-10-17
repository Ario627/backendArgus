import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import type { FleetStatus } from '../common/constant/domain.constant.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import type { AuthenticatedUser } from '../common/types.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { TelemetryRow } from '../database/entities/telemetry-row.entity.js';
import { fleetNotFoundError } from '../fleet/fleet.errors.js';
import {
  toTelemetryPointDto,
  type TelemetryPointDto,
} from './telemetry.mapper.js';

const MAX_POSITION_POINTS = 500;

export interface TelemetryLatestReport {
  readonly fleetId: string;
  readonly kode: string;
  readonly status: FleetStatus;
  readonly stalenessSeconds: number | null;
  readonly latest: TelemetryPointDto | null;
}

export interface FleetPositionReport {
  readonly fleetId: string;
  readonly from: string;
  readonly to: string;
  readonly points: readonly TelemetryPointDto[];
}

const stalenessSecondsOf = (
  lastDeviceTimestamp: Date | null,
  nowMs: number,
): number | null =>
  lastDeviceTimestamp === null
    ? null
    : Math.max(0, Math.floor((nowMs - lastDeviceTimestamp.getTime()) / 1000));

@Injectable()
export class TelemetryQueryService {
  constructor(
    @InjectRepository(Fleet)
    private readonly fleetRepository: Repository<Fleet>,
    @InjectRepository(TelemetryRow)
    private readonly telemetryRepository: Repository<TelemetryRow>,
  ) {}

  private async requireFleet(
    fleetId: string,
    actor: AuthenticatedUser | null,
  ): Promise<Fleet> {
    const fleet = await this.fleetRepository.findOne({
      where: { id: fleetId },
    });
    if (fleet === null) throw fleetNotFoundError();
    if (
      actor !== null &&
      actor.role === 'driver' &&
      actor.fleetId !== fleet.id
    ) {
      throw forbiddenActionError();
    }
    return fleet;
  }

  async latest(fleetId: string): Promise<TelemetryLatestReport> {
    const fleet = await this.requireFleet(fleetId, null);
    const row = await this.telemetryRepository.findOne({
      where: { fleetId },
      order: { deviceTimestamp: 'DESC' },
    });
    return {
      fleetId,
      kode: fleet.kode,
      status: fleet.statusOperasional,
      stalenessSeconds: stalenessSecondsOf(
        fleet.lastDeviceTimestamp,
        Date.now(),
      ),
      latest: row === null ? null : toTelemetryPointDto(row),
    };
  }

  async positions(
    fleetId: string,
    minutes: number,
    actor: AuthenticatedUser,
  ): Promise<FleetPositionReport> {
    await this.requireFleet(fleetId, actor);
    const nowMs = Date.now();
    const fromMs = nowMs - minutes * 60000;
    const rows = await this.telemetryRepository.find({
      where: {
        fleetId,
        deviceTimestamp: MoreThanOrEqual(new Date(fromMs)),
      },
      order: { deviceTimestamp: 'ASC' },
      take: MAX_POSITION_POINTS,
    });
    return {
      fleetId,
      from: new Date(fromMs).toISOString(),
      to: new Date(nowMs).toISOString(),
      points: rows.map(toTelemetryPointDto),
    };
  }
}