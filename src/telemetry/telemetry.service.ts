import {
  HttpException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { HardwareStatus } from '../common/constant/domain.constant.js';
import { validatePayload } from '../common/utils/payload-validation.util.js';
import type {
  AppConfiguration,
  TelemetryConfig,
} from '../config/configuration.js';
import { Fleet } from '../database/entities/fleet.entity.js';
import { MqttClientService } from '../mqtt/mqtt-client.service.js';
import { TrackerTelemetryDto } from './dto/tracker-telemetry.dto.js';
import {
  evaluateTrackerPolicy,
  parseTrackerTopic,
  type TelemetryDropReason,
} from './telemetry-policy.util.js';
import { TelemetryRateLimiter } from './telemetry-rate-limiter.util.js';

const TRACKER_TOPIC_FILTER = 'fleet/+/telemetry';
const MAX_PAYLOAD_BYTES = 4096;
const DROP_LOG_INTERVAL_MS = 30000;
const MAX_DROP_LOG_KEYS = 4096;

const INGEST_SQL = `
WITH ins AS (
  INSERT INTO telemetry
    (fleet_id, device_timestamp, lat, lng, speed_kmh, volume_persen, hardware_status)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (fleet_id, device_timestamp) DO NOTHING
  RETURNING fleet_id
)
UPDATE fleet f
   SET last_lat = $3,
       last_lng = $4,
       last_device_timestamp = $2,
       status_operasional = CASE
         WHEN $7 = 'broken' THEN 'ONLINE_BROKEN'
         ELSE 'ONLINE_NORMAL'
       END
 WHERE f.id = $1
   AND f.aktif = TRUE
   AND f.device_revoked_at IS NULL
   AND (f.last_device_timestamp IS NULL OR f.last_device_timestamp < $2)
   AND EXISTS (SELECT 1 FROM ins)
RETURNING f.id AS id`;

interface TrackerReading {
  readonly fleetId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly speedKmh: number | null;
  readonly volumePercent: number | null;
  readonly hardwareStatus: HardwareStatus;
  readonly deviceTimestampIso: string;
}

const readJsonObject = (payload: Buffer): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(payload.toString('utf8'));
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractValidationCodes = (error: unknown): readonly string[] => {
  if (!(error instanceof HttpException)) return ['SYSTEM'];
  const response = error.getResponse();
  if (response === null || typeof response !== 'object') return ['INVALID'];
  const details = (response as { details?: unknown }).details;
  if (!Array.isArray(details)) return ['INVALID'];
  const codes = new Set<string>();
  for (const entry of details) {
    if (entry === null || typeof entry !== 'object') continue;
    const code = (entry as { code?: unknown }).code;
    if (typeof code === 'string') codes.add(code);
  }
  return codes.size > 0 ? Object.freeze([...codes]) : ['INVALID'];
};

@Injectable()
export class TelemetryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly telemetryConfig: TelemetryConfig;
  private readonly limiter: TelemetryRateLimiter;
  private readonly dropLogAt = new Map<string, number>();

  constructor(
    configService: ConfigService,
    private readonly mqttClient: MqttClientService,
    @InjectRepository(Fleet)
    private readonly fleetRepository: Repository<Fleet>,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.telemetryConfig = config.telemetry;
    this.limiter = new TelemetryRateLimiter(
      config.telemetry.burstLimit,
      config.telemetry.refillPerSecond,
    );
  }

  onApplicationBootstrap(): void {
    this.mqttClient.subscribe(TRACKER_TOPIC_FILTER, (topic, payload) =>
      this.ingestTracker(topic, payload),
    );
  }

  private dropWithLog(
    key: string,
    reason: TelemetryDropReason,
    nowMs: number,
  ): void {
    if (reason === 'RATE_LIMITED') {
      const lastLoggedAt = this.dropLogAt.get(key) ?? 0;
      if (nowMs - lastLoggedAt < DROP_LOG_INTERVAL_MS) return;
      if (this.dropLogAt.size >= MAX_DROP_LOG_KEYS) {
        const oldest = this.dropLogAt.keys().next().value;
        if (oldest !== undefined) this.dropLogAt.delete(oldest);
      }
      this.dropLogAt.set(key, nowMs);
    }
    this.logger.warn(`telemetri dibuang kunci=${key} alasan=${reason}`);
  }

  private async loadFleet(fleetId: string): Promise<Fleet | null> {
    return this.fleetRepository.findOne({ where: { id: fleetId } });
  }

  private async storeReading(reading: TrackerReading): Promise<void> {
    await this.fleetRepository.manager.query(INGEST_SQL, [
      reading.fleetId,
      reading.deviceTimestampIso,
      reading.latitude,
      reading.longitude,
      reading.speedKmh,
      reading.volumePercent,
      reading.hardwareStatus,
    ]);
  }

  private async ingestTracker(topic: string, payload: Buffer): Promise<void> {
    if (payload.length === 0 || payload.length > MAX_PAYLOAD_BYTES) {
      this.logger.warn(`telemetri dibuang topik=${topic} alasan=UKURAN`);
      return;
    }
    const fleetIdFromTopic = parseTrackerTopic(topic);
    const body = readJsonObject(payload);
    if (body === null) {
      this.logger.warn(`telemetri dibuang topik=${topic} alasan=BUKAN_JSON`);
      return;
    }
    let dto: TrackerTelemetryDto;
    try {
      dto = await validatePayload(TrackerTelemetryDto, body);
    } catch (error) {
      const codes = extractValidationCodes(error).join(',');
      this.logger.warn(
        `telemetri dibuang topik=${topic} alasan=BENTUK_INVALID kode=${codes}`,
      );
      return;
    }

    const nowMs = Date.now();
    const verdict = evaluateTrackerPolicy({
      fleetIdFromTopic,
      payloadFleetId: dto.fleetId,
      deviceTimestampMs: Date.parse(dto.deviceTimestamp),
      nowMs,
      futureSkewSeconds: this.telemetryConfig.futureSkewSeconds,
      maxAgeSeconds: this.telemetryConfig.maxAgeSeconds,
    });
    if (!verdict.ok) {
      this.dropWithLog(fleetIdFromTopic ?? topic, verdict.reason, nowMs);
      return;
    }
    if (!this.limiter.tryConsume(dto.fleetId, nowMs)) {
      this.dropWithLog(dto.fleetId, 'RATE_LIMITED', nowMs);
      return;
    }

    const fleet = await this.loadFleet(dto.fleetId);
    if (fleet === null) {
      this.logger.warn(
        `telemetri dibuang fleet=${dto.fleetId} alasan=FLEET_TIDAK_DIKENAL`,
      );
      return;
    }
    if (fleet.deviceRevokedAt !== null) {
      this.logger.warn(
        `telemetri dibuang fleet=${dto.fleetId} alasan=PERANGKAT_DICABUT`,
      );
      return;
    }
    if (!fleet.aktif) {
      this.logger.warn(
        `telemetri dibuang fleet=${dto.fleetId} alasan=ARMADA_NONAKTIF`,
      );
      return;
    }

    await this.storeReading({
      fleetId: dto.fleetId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speedKmh: dto.speedKmh ?? null,
      volumePercent: dto.volumePercent ?? null,
      hardwareStatus: dto.hardwareStatus,
      deviceTimestampIso: new Date(
        Date.parse(dto.deviceTimestamp),
      ).toISOString(),
    });
  }
}