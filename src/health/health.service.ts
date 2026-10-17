import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MqttClientService } from '../mqtt/mqtt-client.service.js';

const DB_PROBE_TIMEOUT_MS = 2000;

export type ProbeState = 'ok' | 'down' | 'unknown';

export interface HealthReport {
  readonly status: 'ok' | 'degraded';
  readonly db: boolean;
  readonly mqtt: ProbeState;
  readonly optimizer: ProbeState;
  readonly uptimeSeconds: number;
}

const withTimeout = <T>(operation: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('HEALTH_PROBE_TIMEOUT'));
    }, timeoutMs);
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly mqttClient: MqttClientService,
  ) {}

  async probe(): Promise<HealthReport> {
    const db = await this.probeDatabase();
    return {
      status: db ? 'ok' : 'degraded',
      db,
      mqtt: this.mqttClient.isConnected() ? 'ok' : 'down',
      optimizer: 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  private async probeDatabase(): Promise<boolean> {
    try {
      await withTimeout(this.dataSource.query('SELECT 1'), DB_PROBE_TIMEOUT_MS);
      return true;
    } catch {
      return false;
    }
  }
}
