import {
  HttpException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { LEDGER_EVENTS_BY_BATCH_STATUS } from '../common/constant/transitions.constant.js';
import { DropThrottle } from '../common/utils/drop-throttle.util.js';
import { parseJsonObject } from '../common/utils/json-object.util.js';
import {
  validatePayload,
  validationCodesOf,
} from '../common/utils/payload-validation.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { Device } from '../database/entities/device.entity.js';
import { DeviceService } from '../device/device.service.js';
import { MqttClientService } from '../mqtt/mqtt-client.service.js';
import { ScaleWeightDto } from './dto/scale-weight.dto.js';
import {
  buildScaleSignatureBasis,
  parseScaleTopic,
  verifyScaleSignature,
} from './scale-payload.util.js';
import type { ScaleDropReason } from './scale.errors.js';
import { ScalePendingService } from './scale-pending.service.js';
import { TelemetryRateLimiter } from './telemetry-rate-limiter.util.js';

const SCALE_TOPIC_FILTER = 'scale/+/weight';
const MAX_PAYLOAD_BYTES = 1024;
const DROP_LOG_INTERVAL_MS = 30000;
const THROTTLED_REASONS: ReadonlySet<ScaleDropReason> = new Set([
  'RATE_LIMITED',
  'REPLAY',
]);
const SCALE_BURST_LIMIT = 10;
const SCALE_REFILL_PER_SECOND = 0.1;

const DITIMBANG_STATUSES: readonly string[] = Object.freeze(
  Object.entries(LEDGER_EVENTS_BY_BATCH_STATUS)
    .filter(([, events]) => (events as readonly string[]).includes('DITIMBANG'))
    .map(([status]) => status),
);

const CANDIDATE_SQL = `
SELECT id
  FROM batch
 WHERE sppg_id = $1
   AND status = ANY($2::text[])
   AND created_at >= now() - make_interval(secs => $3)
   AND created_at <= now()
 ORDER BY created_at DESC`;

const CLAIM_SQL = `
WITH claimed AS (
  UPDATE device
     SET last_weight_at = $2,
         last_seen_at = now()
   WHERE id = $1
     AND revoked_at IS NULL
     AND (last_weight_at IS NULL OR last_weight_at < $2)
  RETURNING id
)
SELECT id FROM claimed`;

interface IdRow {
  readonly id: string;
}

type WeighingOutcome = 'LINKED' | 'QUEUED' | 'REPLAY';

@Injectable()
export class ScaleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScaleService.name);
  private readonly scaleTimeSkewSeconds: number;
  private readonly autoLinkWindowSeconds: number;
  private readonly limiter = new TelemetryRateLimiter(
    SCALE_BURST_LIMIT,
    SCALE_REFILL_PER_SECOND,
  );
  private readonly throttle = new DropThrottle(DROP_LOG_INTERVAL_MS);

  constructor(
    configService: ConfigService,
    private readonly mqttClient: MqttClientService,
    private readonly deviceService: DeviceService,
    private readonly pendingService: ScalePendingService,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.scaleTimeSkewSeconds = config.mqtt.scaleTimeSkewSeconds;
    this.autoLinkWindowSeconds = config.device.autoLinkWindowSeconds;
  }

  onApplicationBootstrap(): void {
    this.mqttClient.subscribe(SCALE_TOPIC_FILTER, (topic, payload) =>
      this.ingestWeight(topic, payload),
    );
  }

  private drop(key: string, reason: ScaleDropReason, nowMs: number): void {
    if (THROTTLED_REASONS.has(reason) && !this.throttle.shouldLog(key, nowMs)) {
      return;
    }
    this.logger.warn(`timbangan dibuang kunci=${key} alasan=${reason}`);
  }

  private async claimMonotonic(
    manager: EntityManager,
    deviceId: string,
    occurredAt: Date,
  ): Promise<boolean> {
    const claimed = await manager.query<IdRow[]>(CLAIM_SQL, [
      deviceId,
      occurredAt,
    ]);
    return claimed.length > 0;
  }

  private async findCandidates(
    manager: EntityManager,
    sppgId: string,
  ): Promise<readonly IdRow[]> {
    return manager.query<IdRow[]>(CANDIDATE_SQL, [
      sppgId,
      DITIMBANG_STATUSES,
      this.autoLinkWindowSeconds,
    ]);
  }

  private async allocate(
    device: Device,
    weightKg: number,
    occurredAtRaw: string,
    occurredAt: Date,
  ): Promise<WeighingOutcome> {
    const sppgId = device.sppgId ?? '';
    return this.deviceRepository.manager.transaction(async (manager) => {
      const claimed = await this.claimMonotonic(manager, device.id, occurredAt);
      if (!claimed) return 'REPLAY';
      const candidates = await this.findCandidates(manager, sppgId);
      const target = candidates.length === 1 ? candidates[0] : undefined;
      if (target !== undefined) {
        try {
          await this.pendingService.appendDeviceWeighingWithin(
            manager,
            target.id,
            {
              deviceId: device.id,
              sppgId,
              weightKg,
              occurredAtRaw,
              occurredAt,
            },
          );
          return 'LINKED';
        } catch (error) {
          if (!(error instanceof HttpException)) throw error;
          this.logger.warn(
            `tautan otomatis gagal batch=${target.id} kode=${error.getStatus()}, masuk antrean`,
          );
        }
      }
      await this.pendingService.enqueueWithin(manager, {
        deviceId: device.id,
        sppgId,
        weightKg,
        occurredAtRaw,
        occurredAt,
      });
      return 'QUEUED';
    });
  }

  private async ingestWeight(topic: string, payload: Buffer): Promise<void> {
    if (payload.length === 0 || payload.length > MAX_PAYLOAD_BYTES) {
      this.logger.warn(`timbangan dibuang topik=${topic} alasan=UKURAN`);
      return;
    }
    const deviceIdFromTopic = parseScaleTopic(topic);
    const body = parseJsonObject(payload);
    if (body === null) {
      this.logger.warn(`timbangan dibuang topik=${topic} alasan=BUKAN_JSON`);
      return;
    }

    let dto: ScaleWeightDto;
    try {
      dto = await validatePayload(ScaleWeightDto, body);
    } catch (error) {
      const codes = validationCodesOf(error).join(',');
      this.logger.warn(
        `timbangan dibuang topik=${topic} alasan=BENTUK_INVALID kode=${codes}`,
      );
      return;
    }

    const nowMs = Date.now();
    if (deviceIdFromTopic !== dto.deviceId) {
      this.drop(deviceIdFromTopic ?? topic, 'DEVICE_MISMATCH', nowMs);
      return;
    }
    if (!this.limiter.tryConsume(dto.deviceId, nowMs)) {
      this.drop(dto.deviceId, 'RATE_LIMITED', nowMs);
      return;
    }

    const device = await this.deviceRepository.findOne({
      where: { id: dto.deviceId },
    });
    if (
      device === null ||
      device.tipe !== 'timbangan' ||
      device.sppgId === null
    ) {
      this.logger.warn(
        `timbangan dibuang device=${dto.deviceId} alasan=DEVICE_TIDAK_DIKENAL`,
      );
      return;
    }
    if (device.revokedAt !== null) {
      this.logger.warn(
        `timbangan dibuang device=${dto.deviceId} alasan=PERANGKAT_DICABUT`,
      );
      return;
    }

    const secret = await this.deviceService.resolveDeviceSecret(device.id);
    if (secret === null) {
      this.logger.error(
        `timbangan dibuang device=${dto.deviceId} alasan=SECRET_TAK_TERBACA`,
      );
      return;
    }
    const basis = buildScaleSignatureBasis(
      dto.deviceId,
      dto.weightKg,
      dto.occurredAt,
    );
    if (!verifyScaleSignature(secret, basis, dto.sig)) {
      this.drop(dto.deviceId, 'SIG_INVALID', nowMs);
      return;
    }

    const occurredAtMs = Date.parse(dto.occurredAt);
    if (Math.abs(nowMs - occurredAtMs) > this.scaleTimeSkewSeconds * 1000) {
      this.drop(dto.deviceId, 'TIME_SKEW', nowMs);
      return;
    }

    const outcome = await this.allocate(
      device,
      dto.weightKg,
      dto.occurredAt,
      new Date(occurredAtMs),
    );
    if (outcome === 'REPLAY') {
      this.drop(dto.deviceId, 'REPLAY', nowMs);
    }
  }
}