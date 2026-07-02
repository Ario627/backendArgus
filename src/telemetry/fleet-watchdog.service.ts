import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OperationalStatus } from "src/common/constant/operational-status.constant";
import { FleetEntity } from "src/database/entities/fleet.entity";

@Injectable()
export class FleetWatchdogService {
  private readonly logger = new Logger(FleetWatchdogService.name);
  private readonly staleThresholdSeconds: number;
  private readonly offlineThresholdSeconds: number;

  constructor(
    @InjectRepository(FleetEntity)
    private readonly fleetRepo: Repository<FleetEntity>,
    config: ConfigService,
  ) {
    const liveness = config.get<{
      staleThresholdSeconds: number;
      offlineThresholdSeconds: number;
      watchdogIntervalSeconds: number;
    }>('app.liveness')!;
    this.staleThresholdSeconds = liveness.staleThresholdSeconds;
    this.offlineThresholdSeconds = liveness.offlineThresholdSeconds;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkLiveness(): Promise<void> {
    await this.markStale();
    await this.markOffline();
  }

  private async markStale(): Promise<void> {
    const result = await this.fleetRepo
      .createQueryBuilder()
      .update()
      .set({ operationalStatus: OperationalStatus.STALE })
      .where(
        `operational_status IN (:...online) AND deleted_at IS NULL AND last_device_timestamp IS NOT NULL AND last_device_timestamp < now() - interval ':sec seconds'`, 
        {
            online: [OperationalStatus.ONLINE_NORMAL, OperationalStatus.ONLINE_BROKEN],
            sec: this.staleThresholdSeconds,
        },
      )
      .execute();

    if(result.affected && result.affected > 0) {
        this.logger.warn(`${result.affected} fleet(s) transitioned to STALE`);
    }
  }

  private async markOffline(): Promise<void> {
    const result = await this.fleetRepo
      .createQueryBuilder()
      .update()
      .set({ operationalStatus: OperationalStatus.OFFLINE })
      .where(
        `operational_status = :stale AND deleted_at IS NULL AND last_device_timestamp < now() - interval ':sec seconds'`,
        {
          stale: OperationalStatus.STALE,
          sec: this.offlineThresholdSeconds,
        },
      )
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.warn(`${result.affected} fleet(s) transitioned to OFFLINE`);
    }
  }
}