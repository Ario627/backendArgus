import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FleetStatus } from '../common/constant/domain.constant.js';
import type { AppConfiguration } from '../config/configuration.js';
import { Fleet } from '../database/entities/fleet.entity.js';

const WATCHDOG_SQL = `
WITH target AS (
  SELECT id,
         kode,
         status_operasional AS sebelum,
         CASE
           WHEN last_device_timestamp IS NULL THEN 'OFFLINE'
           WHEN last_device_timestamp < now() - make_interval(secs => $2) THEN 'OFFLINE'
           WHEN last_device_timestamp < now() - make_interval(secs => $1) THEN 'STALE'
           ELSE status_operasional
         END AS sesudah
    FROM fleet
   WHERE aktif = TRUE
     AND status_operasional IN ('ONLINE_NORMAL', 'ONLINE_BROKEN', 'STALE')
), transition AS (
  UPDATE fleet f
     SET status_operasional = target.sesudah
    FROM target
   WHERE f.id = target.id
     AND f.status_operasional <> target.sesudah
  RETURNING target.kode AS kode, target.sebelum AS sebelum, f.status_operasional AS sesudah
)
SELECT kode, sebelum, sesudah FROM transition`;

interface TransitionRow {
  readonly kode: string;
  readonly sebelum: FleetStatus;
  readonly sesudah: FleetStatus;
}

@Injectable()
export class FleetWatchdogService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(FleetWatchdogService.name);
  private readonly staleSeconds: number;
  private readonly offlineSeconds: number;
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    configService: ConfigService,
    @InjectRepository(Fleet)
    private readonly fleetRepository: Repository<Fleet>,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.staleSeconds = config.liveness.staleThresholdSeconds;
    this.offlineSeconds = config.liveness.offlineThresholdSeconds;
    this.intervalMs = config.liveness.watchdogIntervalSeconds * 1000;
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => {
      void this.sweep();
    }, this.intervalMs);
    void this.sweep();
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.fleetRepository.manager.query<TransitionRow[]>(
        WATCHDOG_SQL,
        [this.staleSeconds, this.offlineSeconds],
      );
      for (const row of rows) {
        this.logger.log(
          `liveness armada ${row.kode}: ${row.sebelum} -> ${row.sesudah}`,
        );
      }
    } catch (error) {
      this.logger.error(
        'penyapuan watchdog armada gagal',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}