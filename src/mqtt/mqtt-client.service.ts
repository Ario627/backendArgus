import { readFileSync } from 'node:fs';
import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type IClientOptions, type MqttClient } from 'mqtt';
import { topicMatchesFilter } from '../common/utils/topic-match.util.js';
import type { AppConfiguration, MqttConfig } from '../config/configuration.js';

export type MqttMessageHandler = (
  topic: string,
  payload: Buffer,
) => void | Promise<void>;

const MAX_INBOUND_PAYLOAD_BYTES = 8192;

const buildClientOptions = (mqtt: MqttConfig): IClientOptions => ({
  protocolVersion: 5,
  clean: false,
  properties: { sessionExpiryInterval: mqtt.sessionExpirySeconds },
  clientId: mqtt.clientId,
  username: mqtt.username,
  password: mqtt.password,
  keepalive: 60,
  reconnectPeriod: mqtt.reconnectPeriodMs,
  connectTimeout: mqtt.connectTimeoutMs,
  resubscribe: false,
  rejectUnauthorized: true,
  ...(mqtt.caPath === null ? {} : { ca: readFileSync(mqtt.caPath) }),
});

@Injectable()
export class MqttClientService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MqttClientService.name);
  private readonly handlers = new Map<string, MqttMessageHandler[]>();
  private client: MqttClient | null = null;
  private connected = false;

  constructor(private readonly configService: ConfigService) {}

  isConnected(): boolean {
    return this.connected;
  }

  subscribe(filter: string, handler: MqttMessageHandler): void {
    const filters = this.handlers.get(filter) ?? [];
    this.handlers.set(filter, [...filters, handler]);
    if (this.client !== null && this.connected) {
      this.subscribeFilter(this.client, filter);
    }
  }

  onApplicationBootstrap(): void {
    const config = this.configService.getOrThrow<AppConfiguration>('app');
    const client = connect(config.mqtt.url, buildClientOptions(config.mqtt));
    this.client = client;
    client.on('connect', () => {
      this.connected = true;
      this.logger.log('mqtt terhubung ke broker');
      for (const filter of this.handlers.keys()) {
        this.subscribeFilter(client, filter);
      }
    });
    client.on('close', () => {
      this.connected = false;
      this.logger.warn('koneksi mqtt terputus');
    });
    client.on('reconnect', () => {
      this.logger.debug('mencoba menyambung ulang mqtt');
    });
    client.on('error', (error) => {
      this.logger.error(`mqtt error: ${error.message}`);
    });
    client.on('message', (topic, payload) => {
      this.dispatch(topic, payload);
    });
  }

  async onApplicationShutdown(): Promise<void> {
    this.connected = false;
    const client = this.client;
    this.client = null;
    await client?.endAsync();
  }

  private subscribeFilter(client: MqttClient, filter: string): void {
    client.subscribe(filter, { qos: 1 }, (error) => {
      if (error !== null) {
        this.logger.error(`langganan mqtt gagal filter=${filter}`);
      }
    });
  }

  private dispatch(topic: string, payload: Buffer): void {
    if (payload.length === 0 || payload.length > MAX_INBOUND_PAYLOAD_BYTES) {
      this.logger.warn(`pesan mqtt dibuang topik=${topic} alasan=UKURAN`);
      return;
    }
    for (const [filter, filterHandlers] of this.handlers) {
      if (!topicMatchesFilter(filter, topic)) continue;
      for (const handler of filterHandlers) {
        Promise.resolve()
          .then(() => handler(topic, payload))
          .catch((error: unknown) => {
            this.logger.error(
              `penanganan mqtt gagal topik=${topic}`,
              error instanceof Error ? error.stack : undefined,
            );
          });
      }
    }
  }
}