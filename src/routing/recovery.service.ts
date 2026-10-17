import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration.js';
import { RoutingService } from './routing.service.js';

@Injectable()
export class RecoveryService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RecoveryService.name);
  private readonly intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    configService: ConfigService,
    private readonly routingService: RoutingService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.intervalMs = config.route.recoveryIntervalSeconds * 1000;
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
      const planIds = await this.routingService.hasPlansWithBrokenFleet();
      for (const planId of planIds) {
        this.logger.warn(`armada rusak terdeteksi pada plan=${planId}, replan`);
        await this.routingService.replanForRecovery(planId);
      }
    } catch (error) {
      this.logger.error(
        'penyapuan recovery rute gagal',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }
}