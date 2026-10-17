import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration.js';

export type OpsAlertType =
  | 'chain_verify_failed'
  | 'anomaly_critical'
  | 'retention_failed';

export type OpsAlertSeverity = 'WARNING' | 'CRITICAL';

export interface OpsAlert {
  readonly type: OpsAlertType;
  readonly severity: OpsAlertSeverity;
  readonly message: string;
  readonly detail: Record<string, unknown>;
}

const MAX_MESSAGE_LENGTH = 300;

@Injectable()
export class OpsNotifierService {
  private readonly logger = new Logger(OpsNotifierService.name);
  private readonly webhookUrl: string | null;
  private readonly timeoutMs: number;
  private readonly nodeEnv: string;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.webhookUrl = config.ops.webhookUrl;
    this.timeoutMs = config.ops.webhookTimeoutMs;
    this.nodeEnv = config.nodeEnv;
  }

  get enabled(): boolean {
    return this.webhookUrl !== null;
  }

  async notify(alert: OpsAlert): Promise<boolean> {
    if (this.webhookUrl === null) {
      return false;
    }
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'argus-backend',
          env: this.nodeEnv,
          type: alert.type,
          severity: alert.severity,
          message: alert.message.slice(0, MAX_MESSAGE_LENGTH),
          detail: alert.detail,
          ts: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        this.logger.warn(`webhook ops menolak: status=${response.status}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn(
        `webhook ops gagal: ${error instanceof Error ? error.message : 'non-error'}`,
      );
      return false;
    }
  }
}